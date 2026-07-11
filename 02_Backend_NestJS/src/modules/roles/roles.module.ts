import { Module } from '@nestjs/common';
import { RolesController, RolesService } from './roles.controller';

@Module({
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
