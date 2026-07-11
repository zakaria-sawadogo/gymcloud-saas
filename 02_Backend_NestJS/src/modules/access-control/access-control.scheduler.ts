import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccessControlService } from './access-control.service';

/**
 * §6.8 — Fermeture automatique des présences oubliées.
 * Tourne plus fréquemment que le job Adhérents (toutes les heures)
 * car un oubli de check-out doit être détecté rapidement pour ne pas
 * fausser la vue « occupation en temps réel » du gestionnaire.
 */
@Injectable()
export class AccessControlSchedulerService {
  private readonly logger = new Logger(AccessControlSchedulerService.name);

  constructor(private readonly accessControlService: AccessControlService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleForgottenSessions() {
    const { closed } = await this.accessControlService.autoCloseForgottenSessions();
    if (closed > 0) {
      this.logger.log(`${closed} session(s) fermée(s) automatiquement.`);
    }
  }
}
