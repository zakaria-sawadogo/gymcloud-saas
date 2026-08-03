/*
  Warnings:

  - A unique constraint covering the columns `[referralCode]` on the table `proprietaires` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('EN_ATTENTE', 'RECOMPENSE');

-- AlterTable
ALTER TABLE "proprietaires" ADD COLUMN     "referralCode" TEXT;

-- AlterTable
ALTER TABLE "saas_subscription_requests" ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerProprietaireId" TEXT NOT NULL,
    "referredProprietaireId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardedAt" TIMESTAMP(3),

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referredProprietaireId_key" ON "referrals"("referredProprietaireId");

-- CreateIndex
CREATE INDEX "referrals_referrerProprietaireId_idx" ON "referrals"("referrerProprietaireId");

-- CreateIndex
CREATE UNIQUE INDEX "proprietaires_referralCode_key" ON "proprietaires"("referralCode");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerProprietaireId_fkey" FOREIGN KEY ("referrerProprietaireId") REFERENCES "proprietaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredProprietaireId_fkey" FOREIGN KEY ("referredProprietaireId") REFERENCES "proprietaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
