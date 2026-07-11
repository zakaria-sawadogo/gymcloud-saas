import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdherentsService } from './adherents.service';

/**
 * §5.12 — Gestion automatique du cycle de vie des abonnements.
 *
 * Exécuté chaque nuit : fait transiter les abonnements expirés vers
 * EN_GRACE puis EXPIRE, et aligne le statut de l'adhérent en
 * conséquence. Le module Notifications (à développer) s'abonnera au
 * résultat pour envoyer les rappels de réabonnement (§10.x).
 */
@Injectable()
export class AdherentsSchedulerService {
  private readonly logger = new Logger(AdherentsSchedulerService.name);

  constructor(private readonly adherentsService: AdherentsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleExpirations() {
    this.logger.log('Traitement quotidien des expirations d\'abonnements...');
    const result = await this.adherentsService.processExpirations();
    this.logger.log(
      `Terminé : ${result.movedToGrace} passages en grâce, ${result.movedToExpired} expirations définitives.`,
    );
  }
}
