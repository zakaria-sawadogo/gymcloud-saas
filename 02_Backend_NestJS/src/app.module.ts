import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { AbilityFactory } from './common/casl/ability.factory';
import { PoliciesGuard } from './common/casl/policies.guard';
import { QuotaGuard } from './common/guards/quota.guard';
import { SubscriptionAccessGuard } from './common/guards/subscription-access.guard';
import { AuthModule } from './modules/auth/auth.module';
import { SaasBillingModule } from './modules/saas-billing/saas-billing.module';
import { SallesModule } from './modules/salles/salles.module';
import { UsersModule } from './modules/users/users.module';
import { AdherentsModule } from './modules/adherents/adherents.module';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { CountriesModule } from './modules/countries/countries.module';
import { RolesModule } from './modules/roles/roles.module';

// Module restant à ajouter au fur et à mesure du développement :
// NotificationsModule (transverse — SMS/Email/WhatsApp/Push)

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // active les tâches @Cron (§5.12, §6.8)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]), // anti-brute-force global (§13.3)
    JwtModule.register({ global: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    SaasBillingModule,
    SallesModule,
    UsersModule,
    AdherentsModule,
    AccessControlModule,
    BookingsModule,
    PaymentsModule,
    MarketingModule,
    ReportingModule,
    CountriesModule,
    RolesModule,
  ],
  providers: [
    AbilityFactory,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: PoliciesGuard },
    { provide: APP_GUARD, useClass: QuotaGuard },
    { provide: APP_GUARD, useClass: SubscriptionAccessGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/refresh', method: RequestMethod.POST },
        { path: 'auth/forgot-password', method: RequestMethod.POST },
        { path: 'payments/mobile-money/webhook', method: RequestMethod.POST },
        { path: 'api/docs', method: RequestMethod.GET }, // monté via SwaggerModule.setup(), pas un contrôleur — garde son préfixe littéral
      )
      .forRoutes('*');
  }
}
