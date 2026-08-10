import { Module } from '@nestjs/common';
import { ApiCredentialsController } from './api-credentials.controller';
import { ApiCredentialsService } from './api-credentials.service';

@Module({
  controllers: [ApiCredentialsController],
  providers: [ApiCredentialsService],
  exports: [ApiCredentialsService],
})
export class ApiCredentialsModule {}
