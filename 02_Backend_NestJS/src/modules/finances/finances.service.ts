import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantContext } from '../../common/decorators/current-user.decorator';
import { CreateExpenseDto, UpdateExpenseDto, SetBudgetDto } from './dto/finances.dto';

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
    private readonly notifications: NotificationsService,
  ) {}

  private async assertHasFinancesAccess(salleId: string) {
    const salle = await this.prisma.salle.findUnique({
      where: { id: salleId },
      select: {
        addons: { select: { status: true, addon: { select: { code: true } } } },
      },
    });
    const hasAccess =
      salle?.addons.some(
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
        recurringAmountVaries: dto.recurringAmountVaries ?? true,
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
        recurringAmountVaries: original.recurringAmountVaries,
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
        ...(dto.recurringAmountVaries !== undefined ? { recurringAmountVaries: dto.recurringAmountVaries } : {}),
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
  /**
   * §14.x — Réservé propriétaire/SUPER_ADMIN : revenus d'abonnement,
   * dépenses et résultat net donnent une vue complète de la rentabilité
   * de la salle, jamais destinée à un gestionnaire (voir
   * getBoutiqueRevenueSummary pour son équivalent restreint).
   */
  async getNetResult(salleId: string, year: number, month: number, actor: TenantContext) {
    await this.assertHasFinancesAccess(salleId);
    if (actor.roleCode === 'GESTIONNAIRE') {
      throw new ForbiddenException('Cette vue est réservée au propriétaire de la salle');
    }
    const current = await this.computeMonthlyFinancials(salleId, year, month);

    // §14.x — comparaison au mois précédent : contexte immédiat sans
    // effort de lecture supplémentaire.
    const prevDate = new Date(year, month - 2, 1);
    const previous = await this.computeMonthlyFinancials(salleId, prevDate.getFullYear(), prevDate.getMonth() + 1);
    const variationPct =
      previous.resultatNet !== 0
        ? Math.round(((current.resultatNet - previous.resultatNet) / Math.abs(previous.resultatNet)) * 100)
        : null;

    // §14.x — budget indicatif par catégorie : simple alerte si
    // dépassé, jamais un blocage.
    const budgets = await this.prisma.expenseBudget.findMany({ where: { salleId } });
    const budgetAlerts = budgets
      .map((b: { category: string; monthlyLimit: unknown }) => {
        const spent = current.depensesParCategorie[b.category] ?? 0;
        const limit = Number(b.monthlyLimit);
        return { category: b.category, spent, limit, isOverBudget: spent > limit };
      })
      .filter((b: { isOverBudget: boolean }) => b.isOverBudget);

    return { year, month, ...current, resultatNetPrecedent: previous.resultatNet, variationPct, budgetAlerts };
  }

  private async computeMonthlyFinancials(salleId: string, year: number, month: number) {
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
      revenusAbonnements,
      revenusBoutique,
      totalRevenus,
      totalDepenses,
      depensesParCategorie: Object.fromEntries(byCategory),
      resultatNet: totalRevenus - totalDepenses,
    };
  }

  /**
   * §14.x — Graphique d'évolution : agrège les mêmes chiffres que
   * getNetResult sur plusieurs mois consécutifs — réservé
   * propriétaire/SUPER_ADMIN, même raison que getNetResult.
   */
  async getMonthlyTrend(salleId: string, monthsBack: number, actor: TenantContext) {
    await this.assertHasFinancesAccess(salleId);
    if (actor.roleCode === 'GESTIONNAIRE') {
      throw new ForbiddenException('Cette vue est réservée au propriétaire de la salle');
    }
    const now = new Date();
    const months: { year: number; month: number }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    const results = await Promise.all(
      months.map(async ({ year, month }) => {
        const data = await this.computeMonthlyFinancials(salleId, year, month);
        return { year, month, totalRevenus: data.totalRevenus, totalDepenses: data.totalDepenses, resultatNet: data.resultatNet };
      }),
    );
    return results;
  }

  /**
   * §14.x — Équivalent restreint pour un gestionnaire : uniquement les
   * revenus boutique (qu'il enregistre lui-même via les ventes au
   * comptoir), jamais les revenus d'abonnement, dépenses ou résultat
   * net qui donneraient une vue complète de la rentabilité de la salle.
   */
  async getBoutiqueRevenueSummary(salleId: string, year: number, month: number) {
    await this.assertHasFinancesAccess(salleId);
    const { start, end } = this.monthRange(year, month);
    const revenusBoutique = await this.sumBoutiqueRevenue(salleId, start, end);
    const productSales = await this.prisma.productSale.count({ where: { salleId, createdAt: { gte: start, lte: end } } });

    // §14.x — comparaison au mois précédent : contexte immédiat sans
    // effort de lecture supplémentaire.
    const prevDate = new Date(year, month - 2, 1);
    const prevRange = this.monthRange(prevDate.getFullYear(), prevDate.getMonth() + 1);
    const revenusBoutiquePrecedent = await this.sumBoutiqueRevenue(salleId, prevRange.start, prevRange.end);
    const variationPct =
      revenusBoutiquePrecedent > 0
        ? Math.round(((revenusBoutique - revenusBoutiquePrecedent) / revenusBoutiquePrecedent) * 100)
        : null;

    return { year, month, revenusBoutique, ventesCount: productSales, revenusBoutiquePrecedent, variationPct };
  }

  private async sumBoutiqueRevenue(salleId: string, start: Date, end: Date): Promise<number> {
    const sales = await this.prisma.productSale.findMany({
      where: { salleId, createdAt: { gte: start, lte: end } },
      select: { totalAmount: true },
    });
    return sales.reduce((sum: number, s: { totalAmount: unknown }) => sum + Number(s.totalAmount), 0);
  }

  /**
   * §14.x — Export CSV, réservé propriétaire/SUPER_ADMIN — jamais au
   * gestionnaire, même si le contenu était filtré : un fichier qu'on
   * peut emporter mérite une restriction plus stricte qu'un simple
   * filtre d'affichage.
   */
  async exportExpensesCsv(salleId: string, year: number, month: number, actor: TenantContext): Promise<string> {
    if (actor.roleCode === 'GESTIONNAIRE') {
      throw new ForbiddenException('Cet export est réservé au propriétaire de la salle');
    }
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

  /**
   * §14.x — Réservé propriétaire/SUPER_ADMIN, comme l'export CSV —
   * un fichier téléchargeable est plus sensible qu'un simple écran de
   * consultation filtré.
   */
  async exportGestionnaireExcel(salleId: string, year: number, month: number, actor: TenantContext): Promise<Buffer> {
    await this.assertHasFinancesAccess(salleId);
    if (actor.roleCode === 'GESTIONNAIRE') {
      throw new ForbiddenException('Cet export est réservé au propriétaire de la salle');
    }
    const { start, end } = this.monthRange(year, month);

    // §14.x — payments (abonnements adhérents) manquait de cet export
    // jusqu'ici, alors que c'est la principale source de revenus d'une
    // salle — seules les ventes boutique et les dépenses y figuraient,
    // ce qui en faisait un export comptable incomplet dans les faits.
    const [productSales, expenses, payments] = await Promise.all([
      this.prisma.productSale.findMany({
        where: { salleId, createdAt: { gte: start, lte: end } },
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.listExpenses(salleId, year, month, actor),
      this.prisma.payment.findMany({
        where: { salleId, status: 'VALIDE', createdAt: { gte: start, lte: end } },
        include: { adherent: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();

    type PaymentRow = {
      createdAt: Date;
      adherent: { user: { firstName: string; lastName: string } } | null;
      type: string;
      method: string;
      amount: unknown;
      reference: string | null;
    };
    const totalPayments = payments.reduce((sum: number, p: PaymentRow) => sum + Number(p.amount), 0);
    const totalBoutique = productSales.reduce(
      (sum: number, s: { totalAmount: unknown }) => sum + Number(s.totalAmount),
      0,
    );
    const totalExpenses = expenses.reduce(
      (sum: number, e: { amount: unknown }) => sum + Number(e.amount),
      0,
    );

    const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
      new Date(year, month - 1, 1),
    );
    const summarySheetData = [
      ['Synthèse comptable', monthLabel],
      [],
      ['Paiements adhérents (abonnements, séances)', totalPayments],
      ['Revenus boutique', totalBoutique],
      ['Total revenus', totalPayments + totalBoutique],
      [],
      ['Dépenses', totalExpenses],
      [],
      ['Résultat net', totalPayments + totalBoutique - totalExpenses],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summarySheetData), 'Synthèse');

    const paymentsSheetData = [
      ['Date', 'Adhérent', 'Type', 'Méthode', 'Montant', 'Référence'],
      ...payments.map((p: PaymentRow) => [
        p.createdAt.toISOString().split('T')[0],
        p.adherent ? `${p.adherent.user.firstName} ${p.adherent.user.lastName}` : '',
        p.type,
        p.method,
        Number(p.amount),
        p.reference ?? '',
      ]),
      [],
      ['Total', '', '', '', totalPayments, ''],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(paymentsSheetData), 'Paiements adhérents');

    const revenueSheetData = [
      ['Date', 'Produit', 'Quantité', 'Montant'],
      ...productSales.map((s: { createdAt: Date; product: { name: string }; quantity: number; totalAmount: unknown }) => [
        s.createdAt.toISOString().split('T')[0],
        s.product.name,
        s.quantity,
        Number(s.totalAmount),
      ]),
      [],
      ['Total', '', '', totalBoutique],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(revenueSheetData), 'Revenus boutique');

    const expensesSheetData = [
      ['Date', 'Catégorie', 'Montant', 'Description'],
      ...expenses.map((e: { date: Date; category: string; amount: unknown; description: string | null }) => [
        e.date.toISOString().split('T')[0],
        e.category,
        Number(e.amount),
        e.description ?? '',
      ]),
      [],
      ['Total', '', totalExpenses, ''],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(expensesSheetData), 'Dépenses');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /**
   * §14.x — Appelé chaque nuit : pour chaque salle, régénère
   * automatiquement les dépenses récurrentes à MONTANT FIXE (loyer...)
   * si aucune entrée n'existe encore ce mois-ci pour cette catégorie —
   * reprend le montant de la plus récente. Les dépenses à montant
   * VARIABLE (électricité...) ne sont jamais générées automatiquement,
   * juste rappelées (voir remindVariableRecurringExpenses).
   */
  async generateFixedRecurringExpenses() {
    const salles = await this.prisma.salle.findMany({ where: { status: 'ACTIF' }, select: { id: true } });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let generated = 0;

    for (const salle of salles) {
      const recentFixed = await this.prisma.expense.findMany({
        where: { salleId: salle.id, isRecurring: true, recurringAmountVaries: false },
        orderBy: { date: 'desc' },
      });
      const seenCategories = new Set<string>();
      for (const template of recentFixed) {
        if (seenCategories.has(template.category)) continue; // seule la plus récente par catégorie sert de modèle
        seenCategories.add(template.category);

        const alreadyThisMonth = await this.prisma.expense.findFirst({
          where: { salleId: salle.id, category: template.category, isRecurring: true, date: { gte: monthStart } },
        });
        if (alreadyThisMonth) continue;

        await this.prisma.expense.create({
          data: {
            id: randomUUID(),
            salleId: salle.id,
            category: template.category,
            amount: template.amount,
            description: template.description,
            date: monthStart,
            isRecurring: true,
            recurringAmountVaries: false,
            isConfidential: template.isConfidential,
            createdByUserId: template.createdByUserId,
          },
        });
        generated++;
      }
    }
    return { generated };
  }

  /**
   * §14.x — Appelé chaque nuit à partir du 5 du mois : pour toute
   * dépense récurrente à montant VARIABLE dont aucune entrée n'existe
   * encore ce mois-ci, notifie le propriétaire (jamais le
   * gestionnaire, même si c'est lui qui l'a saisie à l'origine — un
   * rappel touchant potentiellement des catégories confidentielles).
   */
  async remindVariableRecurringExpenses() {
    const now = new Date();
    if (now.getDate() < 5) return { reminded: 0 };
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const salles = await this.prisma.salle.findMany({
      where: { status: 'ACTIF' },
      select: { id: true, name: true, proprietaire: { select: { userId: true } } },
    });
    let reminded = 0;

    for (const salle of salles) {
      const recentVariable = await this.prisma.expense.findMany({
        where: { salleId: salle.id, isRecurring: true, recurringAmountVaries: true },
        orderBy: { date: 'desc' },
      });
      const seenCategories = new Set<string>();
      const missingCategories: string[] = [];
      for (const template of recentVariable) {
        if (seenCategories.has(template.category)) continue;
        seenCategories.add(template.category);
        const alreadyThisMonth = await this.prisma.expense.findFirst({
          where: { salleId: salle.id, category: template.category, isRecurring: true, date: { gte: monthStart } },
        });
        if (!alreadyThisMonth) missingCategories.push(template.category);
      }
      if (missingCategories.length > 0 && salle.proprietaire) {
        await this.notifications.create(
          salle.proprietaire.userId,
          'Dépenses récurrentes à saisir',
          `${salle.name} — pensez à saisir ce mois-ci : ${missingCategories.join(', ')}.`,
        );
        reminded++;
      }
    }
    return { reminded };
  }

  /**
   * §14.x — Budgets indicatifs par catégorie : une simple alerte si
   * dépassé, jamais un blocage ni une règle comptable. Réservé
   * propriétaire/SUPER_ADMIN — c'est le pilotage global de la salle.
   */
  async listBudgets(salleId: string, actor: TenantContext) {
    await this.assertHasFinancesAccess(salleId);
    if (actor.roleCode === 'GESTIONNAIRE') {
      throw new ForbiddenException('Cette vue est réservée au propriétaire de la salle');
    }
    return this.prisma.expenseBudget.findMany({ where: { salleId }, orderBy: { category: 'asc' } });
  }

  async setBudget(salleId: string, dto: SetBudgetDto, actor: TenantContext) {
    await this.assertHasFinancesAccess(salleId);
    if (actor.roleCode === 'GESTIONNAIRE') {
      throw new ForbiddenException('Cette action est réservée au propriétaire de la salle');
    }
    return this.prisma.expenseBudget.upsert({
      where: { salleId_category: { salleId, category: dto.category } },
      update: { monthlyLimit: dto.monthlyLimit },
      create: { id: randomUUID(), salleId, category: dto.category, monthlyLimit: dto.monthlyLimit },
    });
  }

  async deleteBudget(salleId: string, category: string, actor: TenantContext) {
    if (actor.roleCode === 'GESTIONNAIRE') {
      throw new ForbiddenException('Cette action est réservée au propriétaire de la salle');
    }
    await this.prisma.expenseBudget
      .delete({ where: { salleId_category: { salleId, category } } })
      .catch(() => null);
    return { success: true };
  }
}
