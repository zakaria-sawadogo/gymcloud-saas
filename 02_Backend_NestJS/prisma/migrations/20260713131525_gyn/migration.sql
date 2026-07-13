-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('SYSTEM', 'INTERNAL');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIF', 'SUSPENDU', 'EN_ATTENTE_VALIDATION', 'DESACTIVE');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('FR', 'EN');

-- CreateEnum
CREATE TYPE "SaasPlanStatus" AS ENUM ('ACTIF', 'SUSPENDU', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "SaasSubscriptionStatus" AS ENUM ('ACTIF', 'EN_GRACE', 'SUSPENDU', 'EXPIRE');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MENSUEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "SaasInvoiceStatus" AS ENUM ('EMISE', 'PAYEE', 'EN_RETARD', 'ANNULEE');

-- CreateEnum
CREATE TYPE "SalleStatus" AS ENUM ('ACTIF', 'EN_GRACE', 'SUSPENDU', 'EXPIRE');

-- CreateEnum
CREATE TYPE "AdherentStatus" AS ENUM ('ACTIF', 'EN_GRACE', 'SUSPENDU', 'EXPIRE', 'INACTIF');

-- CreateEnum
CREATE TYPE "AbonnementInstanceStatus" AS ENUM ('ACTIF', 'EN_GRACE', 'SUSPENDU', 'EXPIRE');

-- CreateEnum
CREATE TYPE "AccessMethod" AS ENUM ('QR_CODE', 'MANUEL');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('SEANCE_INDIVIDUELLE', 'COURS_COLLECTIF');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMEE', 'EN_ATTENTE', 'ANNULEE', 'TERMINEE', 'ABSENCE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'WAVE', 'CARTE_BANCAIRE', 'VIREMENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('EN_ATTENTE', 'VALIDE', 'REJETE', 'REMBOURSE');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ABONNEMENT', 'SEANCE', 'AUTRE');

-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('SMS', 'EMAIL', 'WHATSAPP', 'PUSH');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('BROUILLON', 'PLANIFIEE', 'ENVOYEE', 'ECHOUEE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'SMS', 'EMAIL', 'WHATSAPP', 'IN_APP');

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "RoleScope" NOT NULL,
    "isDeletable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIF',
    "language" "Language" NOT NULL DEFAULT 'FR',
    "roleId" TEXT NOT NULL,
    "countryId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "SaasPlanStatus" NOT NULL DEFAULT 'ACTIF',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "priceMonthly" DECIMAL(12,2) NOT NULL,
    "priceAnnual" DECIMAL(12,2) NOT NULL,
    "extraSalleFee" DECIMAL(12,2) NOT NULL,
    "annualDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "taxRatePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "quotaSalles" INTEGER NOT NULL,
    "quotaGestionnaires" INTEGER,
    "quotaCoachs" INTEGER,
    "quotaAdherents" INTEGER,
    "modules" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_country_pricing" (
    "id" TEXT NOT NULL,
    "saasPlanId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "priceMonthly" DECIMAL(12,2) NOT NULL,
    "priceAnnual" DECIMAL(12,2) NOT NULL,
    "extraSalleFee" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "saas_country_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_addons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "saas_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_plan_addons" (
    "saasPlanId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,

    CONSTRAINT "saas_plan_addons_pkey" PRIMARY KEY ("saasPlanId","addonId")
);

-- CreateTable
CREATE TABLE "saas_subscriptions" (
    "id" TEXT NOT NULL,
    "proprietaireId" TEXT NOT NULL,
    "saasPlanId" TEXT NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MENSUEL',
    "status" "SaasSubscriptionStatus" NOT NULL DEFAULT 'ACTIF',
    "startDate" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "graceEndsAt" TIMESTAMP(3),
    "promotionalDiscountPct" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_subscription_addons" (
    "subscriptionId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_subscription_addons_pkey" PRIMARY KEY ("subscriptionId","addonId")
);

-- CreateTable
CREATE TABLE "saas_invoices" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "extraSallesCount" INTEGER NOT NULL DEFAULT 0,
    "extraSallesAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "addonsAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "SaasInvoiceStatus" NOT NULL DEFAULT 'EMISE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "pdfUrl" TEXT,
    "pendingOtpCode" TEXT,
    "pendingOtpExpiresAt" TIMESTAMP(3),
    "pendingPaymentMethod" TEXT,
    "pendingPhoneNumber" TEXT,

    CONSTRAINT "saas_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proprietaires" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "address" TEXT,
    "countryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proprietaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salles" (
    "id" TEXT NOT NULL,
    "proprietaireId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "slogan" TEXT,
    "description" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "phoneAlt" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "countryId" TEXT NOT NULL,
    "website" TEXT,
    "socialLinks" JSONB,
    "primaryColor" TEXT DEFAULT '#0F3B4D',
    "secondaryColor" TEXT DEFAULT '#2E75B6',
    "coverImageUrl" TEXT,
    "receiptName" TEXT,
    "cardName" TEXT,
    "isSalleSupplementaire" BOOLEAN NOT NULL DEFAULT false,
    "status" "SalleStatus" NOT NULL DEFAULT 'ACTIF',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingHours" JSONB,
    "paymentMethods" TEXT[],
    "notificationSettings" JSONB,
    "reservationSettings" JSONB,
    "securitySettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salle_documents" (
    "id" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salle_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestionnaire_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gestionnaire_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "bio" TEXT,
    "specialties" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_availabilities" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "coach_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adherent_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "memberCode" TEXT NOT NULL,
    "qrCodeToken" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "address" TEXT,
    "emergencyContact" TEXT,
    "status" "AdherentStatus" NOT NULL DEFAULT 'ACTIF',
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adherent_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abonnement_catalogues" (
    "id" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationDays" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abonnement_catalogues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adherent_abonnements" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "abonnementCatalogueId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AbonnementInstanceStatus" NOT NULL DEFAULT 'ACTIF',
    "isRenewal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adherent_abonnements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_logs" (
    "id" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "method" "AccessMethod" NOT NULL DEFAULT 'QR_CODE',
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "autoClosed" BOOLEAN NOT NULL DEFAULT false,
    "anomalyFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cours_collectifs" (
    "id" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cours_collectifs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "coachId" TEXT,
    "coursCollectifId" TEXT,
    "type" "BookingType" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMEE',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "attendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waiting_list_entries" (
    "id" TEXT NOT NULL,
    "coursCollectifId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waiting_list_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "adherentId" TEXT,
    "adherentAbonnementId" TEXT,
    "type" "PaymentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "reference" TEXT,
    "validatedByUserId" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "targetSegment" JSONB,
    "content" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'BROUILLON',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "salleId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_credentials" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeRefId" TEXT,
    "encryptedValue" TEXT NOT NULL,
    "lastRotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "login_history_userId_idx" ON "login_history"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "saas_plans_code_key" ON "saas_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "saas_country_pricing_saasPlanId_countryId_key" ON "saas_country_pricing"("saasPlanId", "countryId");

-- CreateIndex
CREATE UNIQUE INDEX "saas_addons_code_key" ON "saas_addons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "saas_subscriptions_proprietaireId_key" ON "saas_subscriptions"("proprietaireId");

-- CreateIndex
CREATE UNIQUE INDEX "saas_invoices_invoiceNumber_key" ON "saas_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "saas_invoices_subscriptionId_idx" ON "saas_invoices"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "proprietaires_userId_key" ON "proprietaires"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "salles_slug_key" ON "salles"("slug");

-- CreateIndex
CREATE INDEX "salles_proprietaireId_idx" ON "salles"("proprietaireId");

-- CreateIndex
CREATE INDEX "salles_subscriptionId_idx" ON "salles"("subscriptionId");

-- CreateIndex
CREATE INDEX "salle_documents_salleId_idx" ON "salle_documents"("salleId");

-- CreateIndex
CREATE UNIQUE INDEX "gestionnaire_profiles_userId_key" ON "gestionnaire_profiles"("userId");

-- CreateIndex
CREATE INDEX "gestionnaire_profiles_salleId_idx" ON "gestionnaire_profiles"("salleId");

-- CreateIndex
CREATE UNIQUE INDEX "coach_profiles_userId_key" ON "coach_profiles"("userId");

-- CreateIndex
CREATE INDEX "coach_profiles_salleId_idx" ON "coach_profiles"("salleId");

-- CreateIndex
CREATE INDEX "coach_availabilities_coachId_idx" ON "coach_availabilities"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "adherent_profiles_userId_key" ON "adherent_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "adherent_profiles_memberCode_key" ON "adherent_profiles"("memberCode");

-- CreateIndex
CREATE UNIQUE INDEX "adherent_profiles_qrCodeToken_key" ON "adherent_profiles"("qrCodeToken");

-- CreateIndex
CREATE INDEX "adherent_profiles_salleId_idx" ON "adherent_profiles"("salleId");

-- CreateIndex
CREATE INDEX "abonnement_catalogues_salleId_idx" ON "abonnement_catalogues"("salleId");

-- CreateIndex
CREATE INDEX "adherent_abonnements_adherentId_idx" ON "adherent_abonnements"("adherentId");

-- CreateIndex
CREATE INDEX "access_logs_salleId_checkInAt_idx" ON "access_logs"("salleId", "checkInAt");

-- CreateIndex
CREATE INDEX "access_logs_adherentId_idx" ON "access_logs"("adherentId");

-- CreateIndex
CREATE INDEX "cours_collectifs_salleId_startAt_idx" ON "cours_collectifs"("salleId", "startAt");

-- CreateIndex
CREATE INDEX "bookings_salleId_startAt_idx" ON "bookings"("salleId", "startAt");

-- CreateIndex
CREATE INDEX "bookings_adherentId_idx" ON "bookings"("adherentId");

-- CreateIndex
CREATE INDEX "bookings_coachId_idx" ON "bookings"("coachId");

-- CreateIndex
CREATE INDEX "waiting_list_entries_coursCollectifId_idx" ON "waiting_list_entries"("coursCollectifId");

-- CreateIndex
CREATE INDEX "payments_salleId_createdAt_idx" ON "payments"("salleId", "createdAt");

-- CreateIndex
CREATE INDEX "payments_adherentId_idx" ON "payments"("adherentId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_paymentId_key" ON "receipts"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_number_key" ON "receipts"("number");

-- CreateIndex
CREATE INDEX "message_templates_salleId_idx" ON "message_templates"("salleId");

-- CreateIndex
CREATE INDEX "marketing_campaigns_salleId_idx" ON "marketing_campaigns"("salleId");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_salleId_idx" ON "coupons"("salleId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "audit_logs_salleId_createdAt_idx" ON "audit_logs"("salleId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "api_credentials_provider_scope_idx" ON "api_credentials"("provider", "scope");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_country_pricing" ADD CONSTRAINT "saas_country_pricing_saasPlanId_fkey" FOREIGN KEY ("saasPlanId") REFERENCES "saas_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_country_pricing" ADD CONSTRAINT "saas_country_pricing_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_plan_addons" ADD CONSTRAINT "saas_plan_addons_saasPlanId_fkey" FOREIGN KEY ("saasPlanId") REFERENCES "saas_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_plan_addons" ADD CONSTRAINT "saas_plan_addons_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "saas_addons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_proprietaireId_fkey" FOREIGN KEY ("proprietaireId") REFERENCES "proprietaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_saasPlanId_fkey" FOREIGN KEY ("saasPlanId") REFERENCES "saas_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscription_addons" ADD CONSTRAINT "saas_subscription_addons_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "saas_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscription_addons" ADD CONSTRAINT "saas_subscription_addons_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "saas_addons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "saas_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietaires" ADD CONSTRAINT "proprietaires_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietaires" ADD CONSTRAINT "proprietaires_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salles" ADD CONSTRAINT "salles_proprietaireId_fkey" FOREIGN KEY ("proprietaireId") REFERENCES "proprietaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salles" ADD CONSTRAINT "salles_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "saas_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salles" ADD CONSTRAINT "salles_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salle_documents" ADD CONSTRAINT "salle_documents_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestionnaire_profiles" ADD CONSTRAINT "gestionnaire_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestionnaire_profiles" ADD CONSTRAINT "gestionnaire_profiles_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_availabilities" ADD CONSTRAINT "coach_availabilities_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adherent_profiles" ADD CONSTRAINT "adherent_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adherent_profiles" ADD CONSTRAINT "adherent_profiles_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonnement_catalogues" ADD CONSTRAINT "abonnement_catalogues_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adherent_abonnements" ADD CONSTRAINT "adherent_abonnements_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adherent_abonnements" ADD CONSTRAINT "adherent_abonnements_abonnementCatalogueId_fkey" FOREIGN KEY ("abonnementCatalogueId") REFERENCES "abonnement_catalogues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cours_collectifs" ADD CONSTRAINT "cours_collectifs_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cours_collectifs" ADD CONSTRAINT "cours_collectifs_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_coursCollectifId_fkey" FOREIGN KEY ("coursCollectifId") REFERENCES "cours_collectifs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiting_list_entries" ADD CONSTRAINT "waiting_list_entries_coursCollectifId_fkey" FOREIGN KEY ("coursCollectifId") REFERENCES "cours_collectifs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_adherentAbonnementId_fkey" FOREIGN KEY ("adherentAbonnementId") REFERENCES "adherent_abonnements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
