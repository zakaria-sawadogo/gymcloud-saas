-- CreateTable
CREATE TABLE "daily_caisse_closings" (
    "id" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "byMethodJson" JSONB NOT NULL,
    "salesCount" INTEGER NOT NULL,
    "closedByUserId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_caisse_closings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_caisse_closings_salleId_businessDate_idx" ON "daily_caisse_closings"("salleId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "daily_caisse_closings_salleId_businessDate_key" ON "daily_caisse_closings"("salleId", "businessDate");

-- AddForeignKey
ALTER TABLE "daily_caisse_closings" ADD CONSTRAINT "daily_caisse_closings_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "salles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_caisse_closings" ADD CONSTRAINT "daily_caisse_closings_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
