import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportingService } from './reporting.service';

// Mêmes couleurs que invoice-pdf.service.ts / payment-receipt-pdf.service.ts —
// cohérence visuelle entre tous les documents générés par la plateforme.
const COLOR_PRIMARY = '#0F6E56';
const COLOR_PRIMARY_TINT = '#E8F5F1'; // fond de carte, dérivé de COLOR_PRIMARY
const COLOR_INK = '#14181B';
const COLOR_INK_MED = '#494F54';
const COLOR_INK_LIGHT = '#71767A';
const COLOR_LINE = '#E5E7E8';
const COLOR_WARN = '#D85A30';
const COLOR_WARN_TINT = '#FBEEE8';

/** `.toLocaleString('fr-FR')` insère un espace insécable Unicode (U+202F)
 * que la police par défaut de pdfkit n'affiche pas correctement —
 * formatage manuel avec un espace ASCII, comme dans les autres services PDF. */
function formatThousands(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * §11, §14.x — Génération de rapports PDF pour les trois niveaux de
 * tableau de bord (Gestionnaire, Propriétaire, SUPER_ADMIN). Réutilise
 * les données déjà calculées par ReportingService (mêmes chiffres
 * qu'à l'écran) plutôt que de dupliquer les requêtes.
 *
 * Mise en page volontairement travaillée (cartes chiffrées colorées,
 * pas de simples lignes texte) — le PDF fait partie de "rapports
 * avancés", un argument de montée en gamme entre plans : il doit
 * donner envie, pas juste informer (§14.x, retour utilisateur).
 *
 * Générés à la demande (streaming direct), pas de stockage durable —
 * même choix que pour les factures et reçus (§9.13).
 */
@Injectable()
export class ReportPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportingService: ReportingService,
  ) {}

  private newDoc() {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    return { doc, done };
  }

  /** Bandeau d'en-tête avec fond coloré plein — pose le ton "document
   * soigné" dès la première ligne, plutôt qu'un simple texte sur fond blanc. */
  private drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
    doc.rect(0, 0, 595, 96).fill(COLOR_PRIMARY);
    doc.fontSize(21).fillColor('#FFFFFF').text('GymCloud', 50, 32);
    doc.fontSize(10).fillColor('#FFFFFF').opacity(0.85).text(title, 50, 60);
    doc.opacity(1);

    const dateFormat = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
    doc.fontSize(9).fillColor('#FFFFFF').opacity(0.85).text(`Généré le ${dateFormat}`, 300, 34, {
      align: 'right',
      width: 245,
    });
    doc.fontSize(13).fillColor('#FFFFFF').opacity(1).text(subtitle, 300, 52, { align: 'right', width: 245 });

    return 130;
  }

  private drawSectionTitle(doc: PDFKit.PDFDocument, y: number, title: string): number {
    doc.rect(50, y, 4, 15).fill(COLOR_PRIMARY);
    doc.fontSize(13).fillColor(COLOR_INK).text(title, 62, y - 1);
    return y + 26;
  }

  /**
   * Grille de cartes chiffrées colorées — 3 par ligne, fond teinté,
   * la valeur en gros et en gras attire l'œil bien plus qu'une ligne
   * "libellé .......... valeur". Réservée aux chiffres CLÉS d'une
   * section (4-6 max) ; les listes plus longues/détaillées restent
   * sur drawStatGrid, plus compact.
   */
  private drawStatCards(
    doc: PDFKit.PDFDocument,
    y: number,
    cards: Array<{ label: string; value: string; warn?: boolean }>,
  ): number {
    const cardWidth = 158;
    const cardHeight = 60;
    const gap = 10;
    let x = 50;
    let rowMaxY = y;

    cards.forEach((card, i) => {
      if (i > 0 && i % 3 === 0) {
        x = 50;
        y = rowMaxY + gap;
      }
      const bg = card.warn ? COLOR_WARN_TINT : COLOR_PRIMARY_TINT;
      const fg = card.warn ? COLOR_WARN : COLOR_PRIMARY;
      doc.roundedRect(x, y, cardWidth, cardHeight, 8).fill(bg);
      doc.fontSize(8.5).fillColor(COLOR_INK_MED).text(card.label, x + 12, y + 10, { width: cardWidth - 24 });
      doc.fontSize(18).fillColor(fg).text(card.value, x + 12, y + 28, { width: cardWidth - 24 });
      x += cardWidth + gap;
      rowMaxY = y + cardHeight;
    });

    return rowMaxY + 20;
  }

  /** Ligne "Libellé .......... Valeur" — pour les listes détaillées
   * plus longues, où des cartes prendraient trop de place verticale. */
  private drawStatRow(doc: PDFKit.PDFDocument, y: number, label: string, value: string, x = 50, width = 495): number {
    doc.fontSize(10).fillColor(COLOR_INK_MED).text(label, x, y, { width: width * 0.65 });
    doc.fontSize(10).fillColor(COLOR_INK).text(value, x + width * 0.65, y, { width: width * 0.35, align: 'right' });
    doc
      .moveTo(x, y + 16)
      .lineTo(x + width, y + 16)
      .strokeColor(COLOR_LINE)
      .stroke();
    return y + 22;
  }

  private drawStatGrid(doc: PDFKit.PDFDocument, y: number, pairs: Array<[string, string]>): number {
    for (const [label, value] of pairs) {
      y = this.drawStatRow(doc, y, label, value);
    }
    return y + 8;
  }

  private percent(n: number | null): string {
    return n == null ? 'N/A' : `${(n * 100).toFixed(1)} %`;
  }

  /**
   * §14.x — Graphique en barres dessiné à la main (pdfkit ne propose
   * pas de moteur de graphiques intégré, et une librairie externe
   * pour quelques barres serait disproportionné). Volontairement
   * simple : 6 barres maximum (agrégation hebdomadaire), une valeur
   * par barre — assez pour montrer une tendance d'un coup d'œil,
   * sans reproduire un vrai outil d'analyse.
   */
  private drawBarChart(
    doc: PDFKit.PDFDocument,
    y: number,
    bars: Array<{ label: string; value: number }>,
  ): number {
    const chartWidth = 495;
    const chartHeight = 110;
    const barGap = 14;
    const barWidth = (chartWidth - barGap * (bars.length - 1)) / bars.length;
    const maxValue = Math.max(...bars.map((b) => b.value), 1);

    // axe de base
    doc
      .moveTo(50, y + chartHeight)
      .lineTo(50 + chartWidth, y + chartHeight)
      .strokeColor(COLOR_LINE)
      .stroke();

    let x = 50;
    for (const bar of bars) {
      const barHeight = Math.max((bar.value / maxValue) * (chartHeight - 24), 2);
      doc.roundedRect(x, y + chartHeight - barHeight, barWidth, barHeight, 3).fill(COLOR_PRIMARY);
      doc
        .fontSize(8)
        .fillColor(COLOR_INK)
        .text(formatThousands(bar.value), x, y + chartHeight - barHeight - 13, { width: barWidth, align: 'center' });
      doc
        .fontSize(8)
        .fillColor(COLOR_INK_LIGHT)
        .text(bar.label, x, y + chartHeight + 6, { width: barWidth, align: 'center' });
      x += barWidth + barGap;
    }

    return y + chartHeight + 24;
  }

  /** Regroupe un détail jour-par-jour (clé "AAAA-MM-JJ") en totaux
   * hebdomadaires — 6 points maximum, plus lisible que 30 barres
   * quotidiennes sur la largeur d'une page A4. */
  private groupByWeek(byDay: Record<string, number>, weeks = 6): Array<{ label: string; value: number }> {
    const buckets = new Map<string, number>();
    for (const [dayKey, value] of Object.entries(byDay)) {
      const date = new Date(dayKey);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const bucketKey = weekStart.toISOString().slice(0, 10);
      buckets.set(bucketKey, (buckets.get(bucketKey) ?? 0) + value);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-weeks)
      .map(([weekStart, value]) => ({
        label: new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(new Date(weekStart)),
        value,
      }));
  }

  // ─────────────────────────────────────────────────────────────
  // Rapport Gestionnaire — une salle
  // ─────────────────────────────────────────────────────────────

  async generateGestionnaireReportPdf(salleId: string): Promise<Buffer> {
    const salle = await this.prisma.salle.findUniqueOrThrow({ where: { id: salleId } });
    const dashboard = await this.reportingService.getGestionnaireDashboard(salleId);
    const retention = await this.reportingService.getRetentionReport(salleId);
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    const revenueTrend = await this.reportingService.getRevenueReport(salleId, sixWeeksAgo, new Date());
    const occupancyTrend = await this.reportingService.getOccupancyTrends(salleId, sixWeeksAgo, new Date());

    const { doc, done } = this.newDoc();
    let y = this.drawHeader(doc, 'Rapport de salle', salle.name);

    y = this.drawSectionTitle(doc, y, 'Adhérents');
    y = this.drawStatCards(doc, y, [
      { label: 'Adhérents actifs', value: String(dashboard.adherents.actifs) },
      { label: 'En période de grâce', value: String(dashboard.adherents.enGrace) },
      { label: 'Expirés', value: String(dashboard.adherents.expires), warn: dashboard.adherents.expires > 0 },
      { label: 'Suspendus', value: String(dashboard.adherents.suspendus) },
      { label: 'Nouveaux ce mois-ci', value: String(dashboard.adherents.nouveauxCeMois) },
      { label: 'Total', value: String(dashboard.adherents.total) },
    ]);

    y = this.drawSectionTitle(doc, y, 'Revenus');
    y = this.drawStatCards(doc, y, [
      { label: "Aujourd'hui", value: `${formatThousands(dashboard.revenus.aujourdHui)} XOF` },
      { label: 'Ce mois-ci', value: `${formatThousands(dashboard.revenus.ceMois)} XOF` },
    ]);

    // §14.x — regroupement des 6 méthodes de paiement possibles en
    // 3 catégories lisibles, plutôt que 6 petites cartes : c'est la
    // question que se pose réellement un propriétaire ("majoritairement
    // Mobile Money ou espèces ?"), pas la répartition exacte par
    // opérateur (Orange/Moov/Wave), moins parlante à ce niveau.
    const byMethod = revenueTrend.byMethod as Record<string, number>;
    const mobileMoneyTotal = (byMethod.ORANGE_MONEY ?? 0) + (byMethod.MOOV_MONEY ?? 0) + (byMethod.WAVE ?? 0);
    const especesTotal = byMethod.ESPECES ?? 0;
    const autresTotal = (byMethod.CARTE_BANCAIRE ?? 0) + (byMethod.VIREMENT ?? 0);
    if (mobileMoneyTotal + especesTotal + autresTotal > 0) {
      const methodCards = [
        { label: 'Mobile Money (6 semaines)', value: `${formatThousands(mobileMoneyTotal)} XOF` },
        { label: 'Espèces (6 semaines)', value: `${formatThousands(especesTotal)} XOF` },
      ];
      if (autresTotal > 0) {
        methodCards.push({ label: 'Autres (carte, virement)', value: `${formatThousands(autresTotal)} XOF` });
      }
      y = this.drawStatCards(doc, y, methodCards);
    }

    const weeklyRevenue = this.groupByWeek(revenueTrend.byDay);
    if (weeklyRevenue.length > 1) {
      if (y > 560) {
        doc.addPage();
        y = 50;
      }
      doc.fontSize(9).fillColor(COLOR_INK_LIGHT).text('Tendance sur 6 semaines (XOF, semaine du...)', 50, y);
      y += 16;
      y = this.drawBarChart(doc, y, weeklyRevenue);
    }

    if (y > 600) {
      doc.addPage();
      y = 50;
    }
    y = this.drawSectionTitle(doc, y, 'Fréquentation & réservations');
    y = this.drawStatCards(doc, y, [
      { label: "Visites aujourd'hui", value: String(dashboard.frequentation.visitesAujourdHui) },
      { label: 'Présents actuellement', value: String(dashboard.frequentation.presentsActuellement) },
      { label: 'Réservations (7 jours)', value: String(dashboard.reservations.confirmeesSeptJoursAVenir) },
    ]);

    const weeklyOccupancy = this.groupByWeek(occupancyTrend.byDay);
    if (weeklyOccupancy.length > 1) {
      if (y > 560) {
        doc.addPage();
        y = 50;
      }
      doc.fontSize(9).fillColor(COLOR_INK_LIGHT).text('Visites sur 6 semaines (semaine du...)', 50, y);
      y += 16;
      y = this.drawBarChart(doc, y, weeklyOccupancy);
    }

    if (retention) {
      y = this.drawSectionTitle(doc, y, 'Rétention');
      y = this.drawStatCards(doc, y, [
        { label: 'Taux de rétention (approximatif)', value: this.percent(retention.tauxRetentionApproximatif) },
        { label: 'Réabonnements', value: String(retention.nombreDeReabonnements) },
      ]);
    }

    doc.end();
    return done;
  }

  // ─────────────────────────────────────────────────────────────
  // Rapport Propriétaire — vue consolidée multi-salles
  // ─────────────────────────────────────────────────────────────

  async generateProprietaireReportPdf(proprietaireId: string): Promise<Buffer> {
    const proprietaire = await this.prisma.proprietaire.findUniqueOrThrow({
      where: { id: proprietaireId },
      include: { user: true },
    });
    const dashboard = await this.reportingService.getProprietaireDashboard(proprietaireId);

    const { doc, done } = this.newDoc();
    let y = this.drawHeader(
      doc,
      'Rapport consolidé',
      `${proprietaire.user.firstName} ${proprietaire.user.lastName}`,
    );

    y = this.drawSectionTitle(doc, y, 'Vue consolidée — toutes salles');
    y = this.drawStatCards(doc, y, [
      { label: 'Adhérents actifs (total)', value: String(dashboard.consolidated.totalAdherentsActifs) },
      { label: "Revenus aujourd'hui", value: `${formatThousands(dashboard.consolidated.revenusAujourdHui)} XOF` },
      { label: 'Revenus ce mois-ci', value: `${formatThousands(dashboard.consolidated.revenusCeMois)} XOF` },
      { label: 'Présents actuellement', value: String(dashboard.consolidated.presentsActuellement) },
    ]);

    for (const salle of dashboard.salles) {
      if (y > 640) {
        doc.addPage();
        y = 50;
      }
      y = this.drawSectionTitle(doc, y, `Salle — ${salle.salleName}`);
      y = this.drawStatGrid(doc, y, [
        ['Adhérents actifs', String(salle.adherents.actifs)],
        ['Revenus ce mois-ci', `${formatThousands(salle.revenus.ceMois)} XOF`],
        ['Présents actuellement', String(salle.frequentation.presentsActuellement)],
      ]);
    }

    doc.end();
    return done;
  }

  // ─────────────────────────────────────────────────────────────
  // Rapport SUPER_ADMIN — santé globale de la plateforme
  // ─────────────────────────────────────────────────────────────

  async generateSuperAdminReportPdf(): Promise<Buffer> {
    const dashboard = await this.reportingService.getSuperAdminDashboard();
    const kpis = await this.reportingService.getSaasKpis();

    const { doc, done } = this.newDoc();
    let y = this.drawHeader(doc, 'Rapport plateforme', 'Vue globale GymCloud');

    y = this.drawSectionTitle(doc, y, 'Plateforme');
    y = this.drawStatCards(doc, y, [
      { label: 'Salles', value: String(dashboard.plateforme.totalSalles) },
      { label: 'Propriétaires', value: String(dashboard.plateforme.totalProprietaires) },
      { label: 'Gestionnaires', value: String(dashboard.plateforme.totalGestionnaires) },
      { label: 'Coachs', value: String(dashboard.plateforme.totalCoachs) },
      { label: 'Adhérents', value: String(dashboard.plateforme.totalAdherents) },
      { label: 'Nouvelles salles ce mois-ci', value: String(dashboard.plateforme.nouvellesSallesCeMois) },
    ]);

    y = this.drawSectionTitle(doc, y, 'Activité SaaS');
    y = this.drawStatCards(doc, y, [
      { label: 'Salles actives', value: String(dashboard.activiteSaas.sallesActives) },
      { label: 'En période de grâce', value: String(dashboard.activiteSaas.sallesEnGrace) },
      {
        label: 'Suspendues',
        value: String(dashboard.activiteSaas.sallesSuspendues),
        warn: dashboard.activiteSaas.sallesSuspendues > 0,
      },
      { label: 'Renouvellements ce mois-ci', value: String(dashboard.activiteSaas.renouvellementsCeMois) },
      { label: 'Montées en gamme ce mois-ci', value: String(dashboard.activiteSaas.upgradesCeMois) },
      { label: 'Baisses de gamme ce mois-ci', value: String(dashboard.activiteSaas.downgradesCeMois) },
    ]);

    if (y > 560) {
      doc.addPage();
      y = 50;
    }
    y = this.drawSectionTitle(doc, y, 'Revenus SaaS');
    y = this.drawStatCards(doc, y, [
      { label: "Aujourd'hui", value: `${formatThousands(dashboard.revenus.aujourdHui)} XOF` },
      { label: 'Ce mois-ci', value: `${formatThousands(dashboard.revenus.ceMois)} XOF` },
      { label: 'Cette année', value: `${formatThousands(dashboard.revenus.cetteAnnee)} XOF` },
      {
        label: 'En attente de règlement',
        value: `${formatThousands(dashboard.revenus.enAttente)} XOF`,
        warn: dashboard.revenus.enAttente > 0,
      },
      {
        label: 'Salles supplémentaires ce mois-ci',
        value: `${formatThousands(dashboard.revenus.sallesSupplementairesCeMois)} XOF`,
      },
    ]);

    if (y > 560) {
      doc.addPage();
      y = 50;
    }
    y = this.drawSectionTitle(doc, y, 'Indicateurs stratégiques SaaS (§9.15)');
    y = this.drawStatCards(doc, y, [
      { label: 'MRR (revenu mensuel récurrent)', value: `${formatThousands(kpis.revenus.mrr)} XOF` },
      { label: 'ARR (revenu annuel récurrent)', value: `${formatThousands(kpis.revenus.arr)} XOF` },
      { label: 'Revenu moyen par salle', value: `${formatThousands(kpis.revenus.revenuMoyenParSalle)} XOF` },
      { label: 'Revenu moyen par propriétaire', value: `${formatThousands(kpis.revenus.revenuMoyenParProprietaire)} XOF` },
      { label: 'Taux de rétention', value: this.percent(kpis.fidelisation.tauxRetention) },
      {
        label: 'Taux de churn',
        value: this.percent(kpis.fidelisation.churnRate),
        warn: (kpis.fidelisation.churnRate ?? 0) > 0.1,
      },
    ]);

    doc.fontSize(8).fillColor(COLOR_INK_LIGHT).text(
      "Répartition des plans, croissance et LTV disponibles dans le tableau de bord en ligne — ce rapport synthétise l'essentiel pour archivage ou partage hors-ligne.",
      50,
      y + 4,
      { width: 495 },
    );

    doc.end();
    return done;
  }
}
