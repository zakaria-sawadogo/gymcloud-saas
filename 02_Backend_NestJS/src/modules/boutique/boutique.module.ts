import { Module } from '@nestjs/common';
import { BoutiqueController } from './boutique.controller';
import { BoutiqueService } from './boutique.service';
import { BoutiqueSchedulerService } from './boutique.scheduler';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [BoutiqueController],
  providers: [BoutiqueService, BoutiqueSchedulerService],
})
export class BoutiqueModule {}
