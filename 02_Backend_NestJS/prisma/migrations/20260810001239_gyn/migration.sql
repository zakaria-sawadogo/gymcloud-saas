-- CreateTable
CREATE TABLE "daily_payments_closings" (
    "id" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "cashAmount" DECIMAL(10,2) NOT NULL,
    "mobileMoneyAmount" DECIMAL(10,2) NOT NULL,
    "paymentsCount" INTEGER NOT NULL,
    "closedByUserId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_payments_closings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_payments_closings_salleId_businessDate_idx" ON "daily_payments_closings"("salleId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "daily_payments_closings_salleId_businessDate_key" ON "daily_payments_closings"("salleId", "businessDate");

-- AddForeignKey
ALTER TABLE "daily_payments_closings" ADD CONSTRAINT "daily_payments_closings_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_payments_closings" ADD CONSTRAINT "daily_payments_closings_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
