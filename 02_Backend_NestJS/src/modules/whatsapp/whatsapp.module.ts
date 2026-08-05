import { Module } from '@nestjs/common';
import { WhatsAppController, WhatsAppAdminController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';

@Module({
  controllers: [WhatsAppController, WhatsAppAdminController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
