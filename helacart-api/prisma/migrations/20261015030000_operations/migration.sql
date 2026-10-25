CREATE TYPE "NotificationType" AS ENUM ('ORDER_PLACED', 'ORDER_UPDATED', 'RETURN_REQUESTED', 'RETURN_REVIEWED', 'COD_RECONCILED');
CREATE TABLE "Notification" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "type" "NotificationType" NOT NULL,
  "subjectId" UUID NOT NULL, "message" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMPTZ(3), CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RESOLVED');
CREATE TABLE "ReturnRequest" (
  "id" UUID NOT NULL, "sellerOrderId" UUID NOT NULL, "buyerId" UUID NOT NULL,
  "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING', "reason" TEXT NOT NULL,
  "reviewReason" TEXT, "resolutionNote" TEXT, "reviewerUserId" UUID, "resolverUserId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMPTZ(3), "resolvedAt" TIMESTAMPTZ(3),
  CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReturnRequest_sellerOrderId_key" ON "ReturnRequest"("sellerOrderId");
CREATE INDEX "ReturnRequest_buyerId_createdAt_idx" ON "ReturnRequest"("buyerId", "createdAt");
CREATE INDEX "ReturnRequest_status_createdAt_idx" ON "ReturnRequest"("status", "createdAt");
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_resolverUserId_fkey" FOREIGN KEY ("resolverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "CodReconciliationDecision" AS ENUM ('RECONCILED', 'DISPUTED');
CREATE TABLE "CodReconciliation" (
  "id" UUID NOT NULL, "sellerOrderId" UUID NOT NULL, "reviewerUserId" UUID NOT NULL,
  "decision" "CodReconciliationDecision" NOT NULL, "amountReceivedMinor" INTEGER NOT NULL,
  "reference" TEXT NOT NULL, "note" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CodReconciliation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CodReconciliation_amount_valid" CHECK ("amountReceivedMinor" >= 0)
);
CREATE UNIQUE INDEX "CodReconciliation_sellerOrderId_reference_key" ON "CodReconciliation"("sellerOrderId", "reference");
CREATE INDEX "CodReconciliation_sellerOrderId_createdAt_idx" ON "CodReconciliation"("sellerOrderId", "createdAt");
CREATE INDEX "CodReconciliation_decision_createdAt_idx" ON "CodReconciliation"("decision", "createdAt");
ALTER TABLE "CodReconciliation" ADD CONSTRAINT "CodReconciliation_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CodReconciliation" ADD CONSTRAINT "CodReconciliation_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
