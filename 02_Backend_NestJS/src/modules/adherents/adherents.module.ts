import { Module } from '@nestjs/common';
import { AdherentsService } from './adherents.service';
import { AdherentsController } from './adherents.controller';
import { AbonnementCatalogueController } from './abonnement-catalogue.controller';
import { AdherentsSchedulerService } from './adherents.scheduler';
import { MembershipCardPdfService } from './membership-card-pdf.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [AdherentsController, AbonnementCatalogueController],
  providers: [AdherentsService, AdherentsSchedulerService, MembershipCardPdfService],
  exports: [AdherentsService], // consommé par les modules Contrôle d'accès, Réservations
})
export class AdherentsModule {}
