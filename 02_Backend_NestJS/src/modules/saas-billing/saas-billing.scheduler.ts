import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SaasBillingService } from './saas-billing.service';

/**
 * §9.7, §9.10 — Gestion automatique du cycle de vie des abonnements
 * SaaS (distinct du scheduler équivalent côté adhérents).
 *
 * Exécuté chaque nuit : fait transiter les souscriptions expirées
 * vers EN_GRACE (avec génération de la facture de renouvellement),
 * puis vers SUSPENDU après 15 jours de grâce sans paiement. Le mode
 * dégradé intermédiaire (J+8 à J+15) est calculé en temps réel par
 * SubscriptionAccessGuard à partir des mêmes dates — ce job n'a donc
 * besoin de gérer que les deux transitions "dures".
 */
@Injectable()
export class SaasBillingSchedulerService {
  private readonly logger = new Logger(SaasBillingSchedulerService.name);

  constructor(private readonly saasBillingService: SaasBillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleSubscriptionLifecycle() {
    this.logger.log('Traitement quotidien du cycle de vie des abonnements SaaS...');
    const result = await this.saasBillingService.processSubscriptionLifecycle();
    this.logger.log(
      `Terminé : ${result.movedToGrace} passage(s) en grâce (facture générée), ${result.movedToSuspended} suspension(s) après grâce.`,
    );
  }
}
