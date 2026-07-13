import { ForbiddenException, Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/decorators/current-user.decorator';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  VIREMENT: 'Virement bancaire',
  ESPECES: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CHEQUE: 'Chèque',
  ESSAI_GRATUIT: 'Essai gratuit',
};

/**
 * §9.13 — Génération de factures SaaS au format PDF. Générée à la
 * demande (streaming direct dans la réponse HTTP) plutôt que
 * pré-générée et stockée : aucun stockage d'objets (S3/MinIO) n'est
 * encore câblé pour héberger des fichiers durables, et une génération
 * à la volée reste rapide pour un document aussi simple.
 */
@Injectable()
export class InvoicePdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generatePdf(invoiceId: string, actor?: TenantContext): Promise<Buffer> {
    const invoice = await this.prisma.saasInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: { proprietaire: { include: { user: true } }, saasPlan: true },
        },
      },
    });

    // §9.13 — Un PROPRIETAIRE ne peut télécharger que SES PROPRES
    // factures ; seul le SUPER_ADMIN/RESPONSABLE_FINANCE (accès global)
    // peut télécharger celle de n'importe quel propriétaire.
    if (actor && !actor.isGlobalAccess && invoice.subscription.proprietaireId !== actor.proprietaireId) {
      throw new ForbiddenException('Vous ne pouvez télécharger que vos propres factures');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const dateFormat = (d: Date) =>
      new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
    // `.toLocaleString('fr-FR')` insère un espace insécable Unicode
    // (U+202F) comme séparateur de milliers — la police par défaut de
    // pdfkit (Helvetica/WinAnsiEncoding) ne le supporte pas et
    // l'affiche de travers (ex: "9/333" au lieu de "9 333"). Formatage
    // manuel avec un espace ASCII classique, garanti sans risque.
    const formatThousands = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const money = (n: number | string) => `${formatThousands(Number(n))} ${invoice.currency}`;

    // En-tête
    doc.fontSize(20).fillColor('#0F6E56').text('GymCloud', 50, 50);
    doc.fontSize(10).fillColor('#71767A').text('Facture SaaS', 50, 75);

    doc.fontSize(10).fillColor('#14181B');
    doc.text(`Facture N° ${invoice.invoiceNumber}`, 350, 50, { align: 'right' });
    doc.text(`Émise le ${dateFormat(invoice.issuedAt)}`, 350, 65, { align: 'right' });
    doc.text(
      `Période : ${dateFormat(invoice.periodStart)} — ${dateFormat(invoice.periodEnd)}`,
      350,
      80,
      { align: 'right' },
    );

    doc.moveDown(3);
    doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#E5E7E8').stroke();

    // Destinataire
    const proprietaire = invoice.subscription.proprietaire;
    doc.fontSize(11).fillColor('#14181B').text('Facturé à', 50, 140);
    doc.fontSize(10).fillColor('#494F54');
    doc.text(`${proprietaire.user.firstName} ${proprietaire.user.lastName}`, 50, 158);
    if (proprietaire.companyName) doc.text(proprietaire.companyName, 50, 173);
    if (proprietaire.address) doc.text(proprietaire.address, 50, 188);
    doc.text(proprietaire.user.phone, 50, 203);

    doc.fontSize(11).fillColor('#14181B').text('Plan souscrit', 350, 140);
    doc.fontSize(10).fillColor('#494F54').text(invoice.subscription.saasPlan.name, 350, 158);

    // Tableau des lignes
    let y = 250;
    doc.fontSize(10).fillColor('#71767A');
    doc.text('Description', 50, y);
    doc.text('Montant', 450, y, { width: 95, align: 'right' });
    y += 18;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E5E7E8').stroke();
    y += 12;

    doc.fillColor('#14181B');
    doc.text(`Abonnement ${invoice.subscription.saasPlan.name}`, 50, y);
    doc.text(money(Number(invoice.baseAmount)), 450, y, { width: 95, align: 'right' });
    y += 20;

    if (invoice.extraSallesCount > 0) {
      doc.text(`Salles supplémentaires (×${invoice.extraSallesCount})`, 50, y);
      doc.text(money(Number(invoice.extraSallesAmount)), 450, y, { width: 95, align: 'right' });
      y += 20;
    }

    if (Number(invoice.taxAmount) > 0) {
      doc.text('Taxes', 50, y);
      doc.text(money(Number(invoice.taxAmount)), 450, y, { width: 95, align: 'right' });
      y += 20;
    }

    y += 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E5E7E8').stroke();
    y += 15;

    doc.fontSize(12).fillColor('#0F6E56');
    doc.text('Total', 50, y);
    doc.text(money(Number(invoice.totalAmount)), 450, y, { width: 95, align: 'right' });

    // Statut de paiement
    y += 40;
    doc.fontSize(10).fillColor('#71767A');
    if (invoice.status === 'PAYEE') {
      doc.fillColor('#0F6E56').text(
        `✓ Payée le ${invoice.paidAt ? dateFormat(invoice.paidAt) : ''} — ${
          PAYMENT_METHOD_LABELS[invoice.paymentMethod ?? ''] ?? invoice.paymentMethod ?? ''
        }${invoice.paymentReference ? ` (réf. ${invoice.paymentReference})` : ''}`,
        50,
        y,
      );
    } else {
      doc.fillColor('#D85A30').text('En attente de règlement', 50, y);
    }

    doc.end();
    return done;
  }
}
