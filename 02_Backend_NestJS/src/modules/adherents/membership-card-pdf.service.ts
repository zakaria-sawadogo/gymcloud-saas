import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/decorators/current-user.decorator';

/**
 * §5.1, §6.3 — Carte membre imprimable, générée après l'encaissement
 * du premier paiement (voir AdherentsService.createWithSubscription).
 * Format compact (format carte, ~85×54mm — norme carte bancaire/badge)
 * plutôt qu'une page A4 : pensé pour être imprimé et découpé, ou lu
 * directement à l'écran d'un téléphone à l'accueil.
 *
 * Contient le même `qrCodeToken` que celui scanné au tourniquet
 * (§6.3) — la carte n'est qu'une représentation physique de ce jeton,
 * pas une donnée distincte.
 */
@Injectable()
export class MembershipCardPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generateCard(adherentId: string, actor?: TenantContext): Promise<Buffer> {
    const adherent = await this.prisma.adherentProfile.findUnique({
      where: { id: adherentId },
      include: { user: true, salle: true },
    });
    if (!adherent) throw new NotFoundException('Adhérent introuvable');

    if (actor && !actor.isGlobalAccess && actor.salleId && actor.salleId !== adherent.salleId) {
      throw new ForbiddenException('Cet adhérent n\'appartient pas à votre salle');
    }

    const qrDataUrl = await QRCode.toDataURL(adherent.qrCodeToken, { margin: 1, width: 300 });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

    // Format carte : 85mm × 54mm converti en points PDF (1mm ≈ 2.8346pt)
    const width = 85 * 2.8346;
    const height = 54 * 2.8346;

    const doc = new PDFDocument({ size: [width, height], margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Fond
    doc.rect(0, 0, width, height).fill('#0F6E56');

    // Bandeau salle
    doc.fillColor('#FFFFFF').fontSize(11).text(adherent.salle.name, 12, 10, { width: width - 90 });
    doc.fontSize(7).fillColor('#C3E5DA').text('CARTE MEMBRE', 12, 26);

    // Identité
    doc.fillColor('#FFFFFF').fontSize(13).text(`${adherent.user.firstName} ${adherent.user.lastName}`, 12, 44, {
      width: width - 90,
    });
    doc.fontSize(8).fillColor('#C3E5DA').text(adherent.memberCode, 12, 62);
    doc.fontSize(7).fillColor('#C3E5DA').text(
      `Membre depuis le ${new Intl.DateTimeFormat('fr-FR').format(adherent.joinedAt)}`,
      12,
      height - 20,
    );

    // QR code
    const qrSize = 70;
    doc.image(qrBuffer, width - qrSize - 10, height / 2 - qrSize / 2, { width: qrSize, height: qrSize });

    doc.end();
    return done;
  }
}
