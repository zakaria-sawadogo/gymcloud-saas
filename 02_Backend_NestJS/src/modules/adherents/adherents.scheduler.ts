import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdherentsService } from './adherents.service';

/**
 * §5.12, §10.x — Gestion automatique du cycle de vie des abonnements.
 *
 * Exécuté chaque nuit : fait transiter les abonnements expirés vers
 * EN_GRACE puis EXPIRE, aligne le statut de l'adhérent en conséquence,
 * et envoie un rappel WhatsApp aux adhérents dont l'abonnement arrive
 * à échéance dans quelques jours (si l'add-on WhatsApp est actif pour
 * leur salle).
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

    const reminders = await this.adherentsService.sendUpcomingExpiryReminders();
    this.logger.log(`Rappels d'échéance WhatsApp envoyés : ${reminders.sent}.`);
  }
}
