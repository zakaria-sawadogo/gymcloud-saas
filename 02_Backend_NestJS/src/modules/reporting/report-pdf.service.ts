import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportingService } from './reporting.service';

// Mêmes couleurs que invoice-pdf.service.ts / payment-receipt-pdf.service.ts —
// cohérence visuelle entre tous les documents générés par la plateforme.
const COLOR_PRIMARY = '#0F6E56';
const COLOR_INK = '#14181B';
const COLOR_INK_MED = '#494F54';
const COLOR_INK_LIGHT = '#71767A';
const COLOR_LINE = '#E5E7E8';
const COLOR_WARN = '#D85A30';

/** `.toLocaleString('fr-FR')` insère un espace insécable Unicode (U+202F)
 * que la police par défaut de pdfkit n'affiche pas correctement —
 * formatage manuel avec un espace ASCII, comme dans les autres services PDF. */
function formatThousands(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * §11 — Génération de rapports PDF pour les trois niveaux de tableau
 * de bord (Gestionnaire, Propriétaire, SUPER_ADMIN). Réutilise les
 * données déjà calculées par ReportingService (mêmes chiffres qu'à
 * l'écran) plutôt que de dupliquer les requêtes — un rapport PDF
 * généré à un instant T reflète exactement ce que l'utilisateur
 * voyait dans son tableau de bord à ce moment-là.
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

  private drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
    doc.fontSize(20).fillColor(COLOR_PRIMARY).text('GymCloud', 50, 50);
    doc.fontSize(10).fillColor(COLOR_INK_LIGHT).text(title, 50, 75);

    const dateFormat = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
    doc.fontSize(10).fillColor(COLOR_INK).text(`Généré le ${dateFormat}`, 350, 50, { align: 'right' });
    doc.fontSize(10).fillColor(COLOR_INK_LIGHT).text(subtitle, 350, 65, { align: 'right', width: 195 });

    doc.moveDown(3);
    doc.moveTo(50, 110).lineTo(545, 110).strokeColor(COLOR_LINE).stroke();
    return 130;
  }

  private drawSectionTitle(doc: PDFKit.PDFDocument, y: number, title: string): number {
    doc.fontSize(13).fillColor(COLOR_PRIMARY).text(title, 50, y);
    return y + 24;
  }

  /** Ligne "Libellé .......... Valeur" — deux colonnes alignées. */
  private drawStatRow(doc: PDFKit.PDFDocument, y: number, label: string, value: string, x = 50, width = 495): number {
    doc.fontSize(10).fillColor(COLOR_INK_MED).text(label, x, y, { width: width * 0.65 });
    doc.fontSize(10).fillColor(COLOR_INK).text(value, x + width * 0.65, y, { width: width * 0.35, align: 'right' });
    return y + 18;
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

  // ─────────────────────────────────────────────────────────────
  // Rapport Gestionnaire — une salle
  // ─────────────────────────────────────────────────────────────

  async generateGestionnaireReportPdf(salleId: string): Promise<Buffer> {
    const salle = await this.prisma.salle.findUniqueOrThrow({ where: { id: salleId } });
    const dashboard = await this.reportingService.getGestionnaireDashboard(salleId);
    const retention = await this.reportingService.getRetentionReport(salleId);

    const { doc, done } = this.newDoc();
    let y = this.drawHeader(doc, 'Rapport de salle', salle.name);

    y = this.drawSectionTitle(doc, y, 'Adhérents');
    y = this.drawStatGrid(doc, y, [
      ['Adhérents actifs', String(dashboard.adherents.actifs)],
      ['En période de grâce', String(dashboard.adherents.enGrace)],
      ['Expirés', String(dashboard.adherents.expires)],
      ['Suspendus', String(dashboard.adherents.suspendus)],
      ['Nouveaux ce mois-ci', String(dashboard.adherents.nouveauxCeMois)],
      ['Total', String(dashboard.adherents.total)],
    ]);

    y = this.drawSectionTitle(doc, y, 'Revenus');
    y = this.drawStatGrid(doc, y, [
      ["Aujourd'hui", `${formatThousands(dashboard.revenus.aujourdHui)} XOF`],
      ['Ce mois-ci', `${formatThousands(dashboard.revenus.ceMois)} XOF`],
    ]);

    y = this.drawSectionTitle(doc, y, 'Fréquentation & réservations');
    y = this.drawStatGrid(doc, y, [
      ["Visites aujourd'hui", String(dashboard.frequentation.visitesAujourdHui)],
      ['Présents actuellement', String(dashboard.frequentation.presentsActuellement)],
      ['Réservations confirmées (7 jours)', String(dashboard.reservations.confirmeesSeptJoursAVenir)],
    ]);

    if (retention) {
      y = this.drawSectionTitle(doc, y, 'Rétention');
      y = this.drawStatGrid(doc, y, [
        ['Taux de rétention (approximatif)', this.percent(retention.tauxRetentionApproximatif)],
        ['Nombre de réabonnements', String(retention.nombreDeReabonnements)],
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
    y = this.drawStatGrid(doc, y, [
      ['Adhérents actifs (total)', String(dashboard.consolidated.totalAdherentsActifs)],
      ["Revenus aujourd'hui", `${formatThousands(dashboard.consolidated.revenusAujourdHui)} XOF`],
      ['Revenus ce mois-ci', `${formatThousands(dashboard.consolidated.revenusCeMois)} XOF`],
      ['Présents actuellement (toutes salles)', String(dashboard.consolidated.presentsActuellement)],
    ]);

    for (const salle of dashboard.salles) {
      if (y > 680) {
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
    y = this.drawStatGrid(doc, y, [
      ['Salles', String(dashboard.plateforme.totalSalles)],
      ['Propriétaires', String(dashboard.plateforme.totalProprietaires)],
      ['Gestionnaires', String(dashboard.plateforme.totalGestionnaires)],
      ['Coachs', String(dashboard.plateforme.totalCoachs)],
      ['Adhérents', String(dashboard.plateforme.totalAdherents)],
      ['Nouvelles salles ce mois-ci', String(dashboard.plateforme.nouvellesSallesCeMois)],
      ['Nouveaux propriétaires ce mois-ci', String(dashboard.plateforme.nouveauxProprietairesCeMois)],
    ]);

    y = this.drawSectionTitle(doc, y, 'Activité SaaS');
    y = this.drawStatGrid(doc, y, [
      ['Salles actives', String(dashboard.activiteSaas.sallesActives)],
      ['Salles en période de grâce', String(dashboard.activiteSaas.sallesEnGrace)],
      ['Salles suspendues', String(dashboard.activiteSaas.sallesSuspendues)],
      ['Renouvellements ce mois-ci', String(dashboard.activiteSaas.renouvellementsCeMois)],
      ["Changements vers un plan supérieur ce mois-ci", String(dashboard.activiteSaas.upgradesCeMois)],
      ['Changements vers un plan inférieur ce mois-ci', String(dashboard.activiteSaas.downgradesCeMois)],
    ]);

    y = this.drawSectionTitle(doc, y, 'Revenus SaaS');
    y = this.drawStatGrid(doc, y, [
      ["Aujourd'hui", `${formatThousands(dashboard.revenus.aujourdHui)} XOF`],
      ['Ce mois-ci', `${formatThousands(dashboard.revenus.ceMois)} XOF`],
      ['Cette année', `${formatThousands(dashboard.revenus.cetteAnnee)} XOF`],
      ['En attente de règlement', `${formatThousands(dashboard.revenus.enAttente)} XOF`],
      ['Salles supplémentaires ce mois-ci', `${formatThousands(dashboard.revenus.sallesSupplementairesCeMois)} XOF`],
    ]);

    if (y > 620) {
      doc.addPage();
      y = 50;
    }
    y = this.drawSectionTitle(doc, y, 'Indicateurs stratégiques SaaS (§9.15)');
    y = this.drawStatGrid(doc, y, [
      ['MRR (revenu mensuel récurrent)', `${formatThousands(kpis.revenus.mrr)} XOF`],
      ['ARR (revenu annuel récurrent)', `${formatThousands(kpis.revenus.arr)} XOF`],
      ['Revenu moyen par salle', `${formatThousands(kpis.revenus.revenuMoyenParSalle)} XOF`],
      ['Revenu moyen par propriétaire', `${formatThousands(kpis.revenus.revenuMoyenParProprietaire)} XOF`],
      ['Taux de rétention', this.percent(kpis.fidelisation.tauxRetention)],
      ['Taux de churn', this.percent(kpis.fidelisation.churnRate)],
      ['Taux de renouvellement (90 jours)', this.percent(kpis.fidelisation.tauxRenouvellement)],
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
