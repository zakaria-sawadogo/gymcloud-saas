import { Module } from '@nestjs/common';
import { AdherentsService } from './adherents.service';
import { AdherentsController } from './adherents.controller';
import { AbonnementCatalogueController } from './abonnement-catalogue.controller';
import { AdherentsSchedulerService } from './adherents.scheduler';

@Module({
  controllers: [AdherentsController, AbonnementCatalogueController],
  providers: [AdherentsService, AdherentsSchedulerService],
  exports: [AdherentsService], // consommé par les modules Contrôle d'accès, Paiements, Réservations
})
export class AdherentsModule {}
