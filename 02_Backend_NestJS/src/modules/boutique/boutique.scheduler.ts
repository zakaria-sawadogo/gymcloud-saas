import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BoutiqueService } from './boutique.service';

/**
 * §14.x — Purge nocturne de l'historique des ajustements manuels de
 * stock de plus de 2 mois (voir BoutiqueService.purgeOldStockMovements
 * pour le principe). Ne touche jamais ProductSale (historique des
 * ventes), conservé indéfiniment.
 */
@Injectable()
export class BoutiqueSchedulerService {
  private readonly logger = new Logger(BoutiqueSchedulerService.name);

  constructor(private readonly boutiqueService: BoutiqueService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleStockMovementsPurge() {
    this.logger.log('Purge nocturne de l\'historique des ajustements de stock...');
    const result = await this.boutiqueService.purgeOldStockMovements();
    this.logger.log(`Terminé : ${result.deleted} entrée(s) de plus de 2 mois supprimée(s).`);
  }
}
