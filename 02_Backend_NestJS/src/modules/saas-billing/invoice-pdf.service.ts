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
          include: { proprietaire: { include: { user: true, country: true } }, saasPlan: true },
        },
      },
    });

    // §9.13 — Un PROPRIETAIRE ne peut télécharger que SES PROPRES
    // factures ; seul le SUPER_ADMIN/RESPONSABLE_FINANCE (accès global)
    // peut télécharger celle de n'importe quel propriétaire.
    if (actor && !actor.isGlobalAccess && invoice.subscription.proprietaireId !== actor.proprietaireId) {
      throw new ForbiddenException('Vous ne pouvez télécharger que vos propres factures');
    }

    // §14.x — le nom en en-tête de facture est configurable par le
    // SUPER_ADMIN (Paramètres) — "GymCloud" reste la valeur par
    // défaut si jamais paramétré.
    const platformSettings = await this.prisma.platformSettings.findUnique({ where: { id: 'platform' } });
    const invoiceIssuerName = platformSettings?.invoiceIssuerName || 'GymCloud';

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
    doc.fontSize(20).fillColor('#0F6E56').text(invoiceIssuerName, 50, 50);
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

    // Tableau des lignes — en-tête avec fond distinctif
    const tableTop = 250;
    const tableLeft = 50;
    const tableWidth = 495;
    let y = tableTop;

    doc.rect(tableLeft, y, tableWidth, 24).fill('#F5F6F6');
    doc.fontSize(9).fillColor('#71767A');
    doc.text('DESCRIPTION', tableLeft + 12, y + 8);
    doc.text('MONTANT', tableLeft, y + 8, { width: tableWidth - 12, align: 'right' });
    y += 24;

    const priceCatalogue =
      invoice.subscription.billingCycle === 'ANNUEL'
        ? Number(invoice.subscription.saasPlan.priceAnnual)
        : Number(invoice.subscription.saasPlan.priceMonthly);
    const hasDiscount = Number(invoice.discountAmount) > 0;
    // §14.x — même source que le calcul réel de taxAmount : le taux
    // du PAYS du propriétaire, jamais celui du plan (bug réel
    // corrigé — le libellé affichait un pourcentage incohérent avec
    // le montant réellement facturé).
    const taxRatePct = Number(invoice.subscription.proprietaire.country?.taxRatePct ?? 0);

    const addRow = (label: string, amount: string, options?: { muted?: boolean; negative?: boolean }) => {
      y += 10;
      doc.fontSize(10).fillColor(options?.negative ? '#B54708' : options?.muted ? '#71767A' : '#14181B');
      doc.text(label, tableLeft + 12, y);
      doc.text(amount, tableLeft, y, { width: tableWidth - 12, align: 'right' });
      y += 16;
    };

    // §9.8 — Une facture d'add-on activé en cours de cycle (baseAmount
    // à 0, voir SaasBillingService.attachAddon) ne facture jamais
    // l'abonnement lui-même, déjà facturé sur une facture séparée :
    // afficher la ligne "Abonnement" dans ce cas induirait en erreur,
    // son montant n'étant compté dans aucun total de cette facture-ci.
    const chargesSubscription = Number(invoice.baseAmount) > 0;
    if (chargesSubscription) {
      addRow(
        `Abonnement ${invoice.subscription.saasPlan.name} (${invoice.subscription.billingCycle === 'ANNUEL' ? 'annuel' : 'mensuel'})`,
        money(priceCatalogue),
      );
      if (hasDiscount) {
        addRow('Réduction appliquée', `- ${money(Number(invoice.discountAmount))}`, { negative: true });
      }
    }
    if (invoice.extraSallesCount > 0) {
      addRow(`Salles supplémentaires (×${invoice.extraSallesCount})`, money(Number(invoice.extraSallesAmount)));
    }
    if (Number(invoice.addonsAmount) > 0) {
      const addonLabel = invoice.pendingAddonId
        ? await this.prisma.saasAddon
            .findUnique({ where: { id: invoice.pendingAddonId }, select: { name: true } })
            .then((a: { name: string } | null) => (a ? `Add-on : ${a.name}` : 'Add-ons'))
        : 'Add-ons';
      addRow(addonLabel, money(Number(invoice.addonsAmount)));
    }

    y += 8;
    doc.moveTo(tableLeft, y).lineTo(tableLeft + tableWidth, y).strokeColor('#E5E7E8').stroke();
    y += 12;

    const sousTotal = Number(invoice.baseAmount) + Number(invoice.extraSallesAmount) + Number(invoice.addonsAmount);
    addRow('Sous-total HT', money(sousTotal), { muted: true });
    if (Number(invoice.taxAmount) > 0) {
      addRow(`TVA (${taxRatePct}%)`, money(Number(invoice.taxAmount)), { muted: true });
    }

    y += 8;
    doc.rect(tableLeft, y, tableWidth, 32).fill('#0F6E56');
    doc.fontSize(12).fillColor('#FFFFFF');
    doc.text('TOTAL TTC', tableLeft + 12, y + 10);
    doc.text(money(Number(invoice.totalAmount)), tableLeft, y + 10, { width: tableWidth - 12, align: 'right' });
    y += 32;

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
