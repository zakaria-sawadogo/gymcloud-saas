import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/decorators/current-user.decorator';

const METHOD_LABELS: Record<string, string> = {
  ESPECES: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  WAVE: 'Wave',
  CARTE_BANCAIRE: 'Carte bancaire',
  VIREMENT: 'Virement',
};

/**
 * §8.x — Reçu de paiement adhérent → salle au format PDF, généré à la
 * demande, sur le même principe que InvoicePdfService (factures SaaS)
 * — document distinct, l'un concerne GymCloud→propriétaire, l'autre
 * salle→adhérent.
 */
@Injectable()
export class PaymentReceiptPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReceipt(paymentId: string, actor?: TenantContext): Promise<Buffer> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { salle: true, adherent: { include: { user: true } }, receipt: true },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');

    if (actor && !actor.isGlobalAccess && actor.salleId && actor.salleId !== payment.salleId) {
      throw new ForbiddenException('Ce paiement n\'appartient pas à votre salle');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const formatThousands = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const dateFormat = (d: Date) =>
      new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);

    doc.fontSize(20).fillColor('#0F6E56').text(payment.salle.name, 50, 50);
    doc.fontSize(10).fillColor('#71767A').text('Reçu de paiement', 50, 75);

    doc.fontSize(10).fillColor('#14181B');
    if (payment.receipt) {
      doc.text(`Reçu N° ${payment.receipt.number}`, 350, 50, { align: 'right' });
    }
    doc.text(`Émis le ${dateFormat(payment.createdAt)}`, 350, 65, { align: 'right' });

    doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#E5E7E8').stroke();

    if (payment.adherent) {
      doc.fontSize(11).fillColor('#14181B').text('Adhérent', 50, 130);
      doc.fontSize(10).fillColor('#494F54').text(
        `${payment.adherent.user.firstName} ${payment.adherent.user.lastName}`,
        50,
        148,
      );
      doc.text(payment.adherent.user.phone, 50, 163);
    }

    let y = 210;
    doc.fontSize(10).fillColor('#71767A');
    doc.text('Description', 50, y);
    doc.text('Montant', 450, y, { width: 95, align: 'right' });
    y += 18;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E5E7E8').stroke();
    y += 12;

    doc.fillColor('#14181B');
    doc.text(payment.type, 50, y);
    doc.text(`${formatThousands(Number(payment.amount))} ${payment.currency}`, 450, y, { width: 95, align: 'right' });
    y += 30;

    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E5E7E8').stroke();
    y += 15;
    doc.fontSize(12).fillColor('#0F6E56');
    doc.text('Total payé', 50, y);
    doc.text(`${formatThousands(Number(payment.amount))} ${payment.currency}`, 450, y, { width: 95, align: 'right' });

    y += 40;
    doc.fontSize(9).fillColor('#71767A').text(`Moyen de paiement : ${METHOD_LABELS[payment.method] ?? payment.method}`, 50, y);

    doc.end();
    return done;
  }
}
