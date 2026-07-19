import { Module } from '@nestjs/common';
import { SalleContentService } from './salle-content.service';
import { SalleContentController } from './salle-content.controller';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [SalleContentController],
  providers: [SalleContentService],
})
export class SalleContentModule {}
