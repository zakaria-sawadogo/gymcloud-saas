import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { ProprietairesController } from './proprietaires.controller';
import { GestionnairesController } from './gestionnaires.controller';
import { CoachsController } from './coachs.controller';
import { InternalUsersController } from './internal-users.controller';
import { SallesModule } from '../salles/salles.module';
import { StorageModule } from '../../common/storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SaasBillingModule } from '../saas-billing/saas-billing.module';
import { AuthModule } from '../auth/auth.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [SallesModule, StorageModule, NotificationsModule, SaasBillingModule, AuthModule, WhatsAppModule],
  controllers: [ProprietairesController, GestionnairesController, CoachsController, InternalUsersController],
  providers: [UsersService],
  exports: [UsersService], // consommé par le futur module Adhérents (auto-complétion propriétaire)
})
export class UsersModule {}
