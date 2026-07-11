import { Module } from '@nestjs/common';
import { SallesService } from './salles.service';
import { SallesController } from './salles.controller';
import { SaasBillingModule } from '../saas-billing/saas-billing.module';

@Module({
  imports: [SaasBillingModule],
  controllers: [SallesController],
  providers: [SallesService],
  exports: [SallesService],
})
export class SallesModule {}
