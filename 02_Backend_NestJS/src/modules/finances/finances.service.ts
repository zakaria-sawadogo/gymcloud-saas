import { Injectable, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/finances.dto';

/**
 * §14.x — "GymCloud Finances" : suivi des dépenses par catégorie et
 * vue revenus/dépenses/résultat net. Volontairement un OUTIL DE SUIVI,
 * pas un logiciel de comptabilité SYSCOHADA-conforme — voir la note
 * dans le modèle Prisma Expense. Réservé aux salles ayant l'add-on
 * FINANCES actif.
 */
@Injectable()
export class FinancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  private async assertHasFinancesAccess(salleId: string) {
    const salle = await this.prisma.salle.findUnique({
      where: { id: salleId },
      select: {
        subscription: { select: { addons: { select: { status: true, addon: { select: { code: true } } } } } },
      },
    });
    const hasAccess =
      salle?.subscription.addons.some(
        (sa: { status: string; addon: { code: string } }) => sa.addon.code === 'FINANCES' && sa.status === 'ACTIF',
      ) ?? false;
    if (!hasAccess) {
      throw new ForbiddenException(
        'L\'add-on "GymCloud Finances" n\'est pas actif pour cette salle — à activer depuis "Mon abonnement".',
      );
    }
  }

  private monthRange(year: number, month: number) {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  async listExpenses(salleId: string, year: number, month: number) {
    await this.assertHasFinancesAccess(salleId);
    const { start, end } = this.monthRange(year, month);
    return this.prisma.expense.findMany({
      where: { salleId, date: { gte: start, lte: end } },
      orderBy: { date: 'desc' },
    });
  }

  async createExpense(salleId: string, dto: CreateExpenseDto, actorUserId: string) {
    await this.assertHasFinancesAccess(salleId);
    const expense = await this.prisma.expense.create({
      data: {
        id: randomUUID(),
        salleId,
        category: dto.category,
        amount: dto.amount,
        description: dto.description,
        date: new Date(dto.date),
        isRecurring: dto.isRecurring ?? false,
        createdByUserId: actorUserId,
      },
    });
    await this.audit.log({
      userId: actorUserId,
      action: 'expense.create',
      entityType: 'Expense',
      entityId: expense.id,
      salleId,
    });
    return expense;
  }

  /**
   * §14.x — Reprend une dépense existante comme point de départ pour
   * le mois courant (au lieu d'une resaisie manuelle) — pour les
   * dépenses marquées récurrentes (loyer, salaires...). Volontairement
   * PAS de génération automatique : le gestionnaire garde la main sur
   * chaque montant, qui peut varier d'un mois à l'autre.
   */
  async duplicateExpense(expenseId: string, actorUserId: string) {
    const original = await this.prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });
    await this.assertHasFinancesAccess(original.salleId);
    const duplicate = await this.prisma.expense.create({
      data: {
        id: randomUUID(),
        salleId: original.salleId,
        category: original.category,
        amount: original.amount,
        description: original.description,
        date: new Date(),
        isRecurring: original.isRecurring,
        createdByUserId: actorUserId,
      },
    });
    await this.audit.log({
      userId: actorUserId,
      action: 'expense.duplicate',
      entityType: 'Expense',
      entityId: duplicate.id,
      salleId: original.salleId,
      metadata: { fromExpenseId: expenseId },
    });
    return duplicate;
  }

  async updateExpense(expenseId: string, dto: UpdateExpenseDto, actorUserId: string) {
    const expense = await this.prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });
    await this.assertHasFinancesAccess(expense.salleId);
    const updated = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
        ...(dto.isRecurring !== undefined ? { isRecurring: dto.isRecurring } : {}),
      },
    });
    await this.audit.log({
      userId: actorUserId,
      action: 'expense.update',
      entityType: 'Expense',
      entityId: expenseId,
      salleId: expense.salleId,
    });
    return updated;
  }

  async deleteExpense(expenseId: string, actorUserId: string) {
    const expense = await this.prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });
    await this.assertHasFinancesAccess(expense.salleId);
    await this.prisma.expense.delete({ where: { id: expenseId } });
    await this.audit.log({
      userId: actorUserId,
      action: 'expense.delete',
      entityType: 'Expense',
      entityId: expenseId,
      salleId: expense.salleId,
    });
    return { success: true };
  }

  async uploadReceipt(
    expenseId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    actorUserId: string,
  ) {
    const expense = await this.prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });
    await this.assertHasFinancesAccess(expense.salleId);
    const receiptUrl = await this.storage.uploadFile(
      file.buffer,
      `expenses/${expenseId}`,
      file.originalname,
      file.mimetype,
    );
    await this.prisma.expense.update({ where: { id: expenseId }, data: { receiptUrl } });
    if (expense.receiptUrl) await this.storage.deleteFileByUrl(expense.receiptUrl);
    return { receiptUrl };
  }

  /**
   * §14.x — Revenus (abonnements + boutique) - dépenses = résultat net,
   * pour un mois donné. Jamais présenté comme un état financier
   * officiel — juste une vue de pilotage.
   */
  async getNetResult(salleId: string, year: number, month: number) {
    await this.assertHasFinancesAccess(salleId);
    const { start, end } = this.monthRange(year, month);

    const [payments, productSales, expenses] = await Promise.all([
      this.prisma.payment.findMany({
        where: { salleId, status: 'VALIDE', createdAt: { gte: start, lte: end } },
        select: { amount: true },
      }),
      this.prisma.productSale.findMany({
        where: { salleId, createdAt: { gte: start, lte: end } },
        select: { totalAmount: true },
      }),
      this.prisma.expense.findMany({
        where: { salleId, date: { gte: start, lte: end } },
        select: { category: true, amount: true },
      }),
    ]);

    const revenusAbonnements = payments.reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);
    const revenusBoutique = productSales.reduce(
      (sum: number, s: { totalAmount: unknown }) => sum + Number(s.totalAmount),
      0,
    );
    const totalRevenus = revenusAbonnements + revenusBoutique;

    const byCategory = new Map<string, number>();
    let totalDepenses = 0;
    for (const e of expenses) {
      const amount = Number(e.amount);
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amount);
      totalDepenses += amount;
    }

    return {
      year,
      month,
      revenusAbonnements,
      revenusBoutique,
      totalRevenus,
      totalDepenses,
      depensesParCategorie: Object.fromEntries(byCategory),
      resultatNet: totalRevenus - totalDepenses,
    };
  }

  /**
   * §14.x — Export CSV simple (date, catégorie, montant, description)
   * à transmettre à un comptable — jamais un état financier officiel.
   */
  async exportExpensesCsv(salleId: string, year: number, month: number): Promise<string> {
    const expenses = await this.listExpenses(salleId, year, month);
    const header = 'Date,Catégorie,Montant,Description\n';
    const rows = expenses
      .map((e: { date: Date; category: string; amount: unknown; description: string | null }) => {
        const date = e.date.toISOString().split('T')[0];
        const description = (e.description ?? '').replace(/"/g, '""');
        return `${date},"${e.category}",${Number(e.amount)},"${description}"`;
      })
      .join('\n');
    return header + rows;
  }
}
