import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { ProprietairesController } from './proprietaires.controller';
import { GestionnairesController } from './gestionnaires.controller';
import { CoachsController } from './coachs.controller';
import { InternalUsersController } from './internal-users.controller';
import { SallesModule } from '../salles/salles.module';

@Module({
  imports: [SallesModule],
  controllers: [ProprietairesController, GestionnairesController, CoachsController, InternalUsersController],
  providers: [UsersService],
  exports: [UsersService], // consommé par le futur module Adhérents (auto-complétion propriétaire)
})
export class UsersModule {}
