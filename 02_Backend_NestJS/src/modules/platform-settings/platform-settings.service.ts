import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const SETTINGS_ID = 'platform';

/**
 * §14.x — Coordonnées de contact de la plateforme (support, adresse
 * d'envoi des e-mails...), éditables par le SUPER_ADMIN. Table
 * singleton : `get()` la crée avec des valeurs par défaut si elle
 * n'existe pas encore (premier accès), pour ne jamais avoir besoin
 * d'une migration de données séparée.
 */
@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const existing = await this.prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (existing) return existing;

    return this.prisma.platformSettings.create({
      data: { id: SETTINGS_ID, supportEmail: 'gymcloudsys@gmail.com', supportPhone: '+226 68 46 11 19' },
    });
  }

  async update(
    dto: { supportEmail?: string; supportPhone?: string; whatsappNumber?: string },
    actorUserId: string,
  ) {
    await this.get(); // garantit que la ligne existe avant la mise à jour
    return this.prisma.platformSettings.update({
      where: { id: SETTINGS_ID },
      data: { ...dto, updatedByUserId: actorUserId },
    });
  }
}
