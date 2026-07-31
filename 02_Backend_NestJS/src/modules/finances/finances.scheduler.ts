import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FinancesService } from './finances.service';

/**
 * §14.x — Exécuté chaque nuit : régénère automatiquement les dépenses
 * récurrentes à montant fixe (loyer...), et rappelle (à partir du 5 du
 * mois) les dépenses récurrentes à montant variable (électricité...)
 * pas encore saisies ce mois-ci.
 */
@Injectable()
export class FinancesSchedulerService {
  private readonly logger = new Logger(FinancesSchedulerService.name);

  constructor(private readonly financesService: FinancesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleRecurringExpenses() {
    this.logger.log('Génération des dépenses récurrentes à montant fixe...');
    const generated = await this.financesService.generateFixedRecurringExpenses();
    this.logger.log(`Terminé : ${generated.generated} dépense(s) générée(s).`);

    this.logger.log('Rappel des dépenses récurrentes à montant variable...');
    const reminded = await this.financesService.remindVariableRecurringExpenses();
    this.logger.log(`Terminé : ${reminded.reminded} salle(s) notifiée(s).`);
  }
}
