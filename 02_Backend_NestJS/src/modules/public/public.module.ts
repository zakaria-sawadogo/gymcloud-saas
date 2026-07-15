import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicPlatformController } from './public-platform.controller';
import { PublicService } from './public.service';

@Module({
  controllers: [PublicController, PublicPlatformController],
  providers: [PublicService],
})
export class PublicModule {}
