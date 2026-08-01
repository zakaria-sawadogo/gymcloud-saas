import { Module, forwardRef } from '@nestjs/common';
import { SallesService } from './salles.service';
import { SallesController } from './salles.controller';
import { SaasBillingModule } from '../saas-billing/saas-billing.module';

@Module({
  imports: [forwardRef(() => SaasBillingModule)],
  controllers: [SallesController],
  providers: [SallesService],
  exports: [SallesService],
})
export class SallesModule {}
