import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import { TenantContext } from '../../common/decorators/current-user.decorator';
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

  async listExpenses(salleId: string, year: number, month: number, actor: TenantContext) {
    await this.assertHasFinancesAccess(salleId);
    const { start, end } = this.monthRange(year, month);
    return this.prisma.expense.findMany({
      where: {
        salleId,
        date: { gte: start, lte: end },
        // §14.x — un gestionnaire ne voit jamais les dépenses
        // confidentielles (salaires, loyer...) saisies par le
        // propriétaire ; le propriétaire et le SUPER_ADMIN voient tout.
        ...(actor.roleCode === 'GESTIONNAIRE' ? { isConfidential: false } : {}),
      },
      orderBy: { date: 'desc' },
    });
  }

  async createExpense(salleId: string, dto: CreateExpenseDto, actor: TenantContext) {
    await this.assertHasFinancesAccess(salleId);
    // §14.x — seul un propriétaire (ou SUPER_ADMIN) peut marquer une
    // dépense confidentielle ; un gestionnaire qui tenterait de le
    // faire est silencieusement ramené à false, jamais une erreur qui
    // révélerait l'existence de cette option.
    const isConfidential = actor.roleCode === 'GESTIONNAIRE' ? false : (dto.isConfidential ?? false);
    const expense = await this.prisma.expense.create({
      data: {
        id: randomUUID(),
        salleId,
        category: dto.category,
        amount: dto.amount,
        description: dto.description,
        date: new Date(dto.date),
        isRecurring: dto.isRecurring ?? false,
        isConfidential,
        createdByUserId: actor.userId,
      },
    });
    await this.audit.log({
      userId: actor.userId,
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
  async duplicateExpense(expenseId: string, actor: TenantContext) {
    const original = await this.prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });
    await this.assertHasFinancesAccess(original.salleId);
    this.assertVisibleTo(original, actor);
    const duplicate = await this.prisma.expense.create({
      data: {
        id: randomUUID(),
        salleId: original.salleId,
        category: original.category,
        amount: original.amount,
        description: original.description,
        date: new Date(),
        isRecurring: original.isRecurring,
        isConfidential: original.isConfidential,
        createdByUserId: actor.userId,
      },
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'expense.duplicate',
      entityType: 'Expense',
      entityId: duplicate.id,
      salleId: original.salleId,
      metadata: { fromExpenseId: expenseId },
    });
    return duplicate;
  }

  /**
   * §14.x — Un gestionnaire qui tenterait d'agir sur une dépense
   * confidentielle (deviné son ID, par exemple) reçoit la même erreur
   * "introuvable" que si elle n'existait pas — jamais une erreur
   * distincte qui révélerait son existence.
   */
  private assertVisibleTo(expense: { isConfidential: boolean }, actor: TenantContext) {
    if (expense.isConfidential && actor.roleCode === 'GESTIONNAIRE') {
      throw new NotFoundException('Dépense introuvable');
    }
  }

  async updateExpense(expenseId: string, dto: UpdateExpenseDto, actor: TenantContext) {
    const expense = await this.prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });
    await this.assertHasFinancesAccess(expense.salleId);
    this.assertVisibleTo(expense, actor);
    const updated = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
        ...(dto.isRecurring !== undefined ? { isRecurring: dto.isRecurring } : {}),
        // §14.x — un gestionnaire ne peut jamais rendre une dépense
        // confidentielle (ni l'inverse, puisqu'il ne peut de toute
        // façon pas atteindre celles qui le sont déjà).
        ...(dto.isConfidential !== undefined && actor.roleCode !== 'GESTIONNAIRE'
          ? { isConfidential: dto.isConfidential }
          : {}),
      },
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'expense.update',
      entityType: 'Expense',
      entityId: expenseId,
      salleId: expense.salleId,
    });
    return updated;
  }

  async deleteExpense(expenseId: string, actor: TenantContext) {
    const expense = await this.prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });
    await this.assertHasFinancesAccess(expense.salleId);
    this.assertVisibleTo(expense, actor);
    await this.prisma.expense.delete({ where: { id: expenseId } });
    await this.audit.log({
      userId: actor.userId,
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
    actor: TenantContext,
  ) {
    const expense = await this.prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });
    await this.assertHasFinancesAccess(expense.salleId);
    this.assertVisibleTo(expense, actor);
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
  async getNetResult(salleId: string, year: number, month: number, actor: TenantContext) {
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
        where: {
          salleId,
          date: { gte: start, lte: end },
          // §14.x — la répartition par catégorie ne doit jamais laisser
          // deviner l'existence ou le montant d'une dépense
          // confidentielle à un gestionnaire, même sans le détail ligne
          // par ligne.
          ...(actor.roleCode === 'GESTIONNAIRE' ? { isConfidential: false } : {}),
        },
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
  async exportExpensesCsv(salleId: string, year: number, month: number, actor: TenantContext): Promise<string> {
    const expenses = await this.listExpenses(salleId, year, month, actor);
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
