-- CreateEnum
CREATE TYPE "CommissionPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'COMMISSION_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'COMMISSION_REVIEWED';
ALTER TYPE "NotificationType" ADD VALUE 'COMMISSION_REMINDER';

-- AlterTable
ALTER TABLE "SellerOrder" ADD COLUMN     "commissionPaymentDays" INTEGER,
ADD COLUMN     "commissionPolicyVersion" INTEGER,
ADD COLUMN     "commissionRateBps" INTEGER,
ADD COLUMN     "commissionReturnDays" INTEGER;

-- CreateTable
CREATE TABLE "CommissionPolicy" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rateBps" INTEGER NOT NULL DEFAULT 0,
    "paymentDays" INTEGER NOT NULL DEFAULT 14,
    "bankName" VARCHAR(100),
    "accountName" VARCHAR(150),
    "accountNumber" VARCHAR(50),
    "instructions" VARCHAR(1000),
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CommissionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPolicyChange" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "actorId" UUID NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPolicyChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionCharge" (
    "id" UUID NOT NULL,
    "sellerOrderId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "baseMinor" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "holdUntil" TIMESTAMPTZ(3) NOT NULL,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPayment" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "submitterId" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "paidOn" VARCHAR(10) NOT NULL,
    "status" "CommissionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "note" VARCHAR(500),
    "reviewerId" UUID,
    "reviewNote" VARCHAR(500),
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRefund" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "chargeId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "baseMinor" INTEGER NOT NULL,
    "creditMinor" INTEGER NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionReminder" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPolicyChange_version_key" ON "CommissionPolicyChange"("version");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionCharge_sellerOrderId_key" ON "CommissionCharge"("sellerOrderId");

-- CreateIndex
CREATE INDEX "CommissionCharge_sellerId_createdAt_idx" ON "CommissionCharge"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "CommissionCharge_dueAt_idx" ON "CommissionCharge"("dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPayment_reference_key" ON "CommissionPayment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPayment_storageKey_key" ON "CommissionPayment"("storageKey");

-- CreateIndex
CREATE INDEX "CommissionPayment_sellerId_createdAt_idx" ON "CommissionPayment"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "CommissionPayment_status_createdAt_idx" ON "CommissionPayment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPayment_sellerId_requestKey_key" ON "CommissionPayment"("sellerId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRefund_requestKey_key" ON "CommissionRefund"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRefund_reference_key" ON "CommissionRefund"("reference");

-- CreateIndex
CREATE INDEX "CommissionRefund_sellerId_createdAt_idx" ON "CommissionRefund"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "CommissionRefund_chargeId_idx" ON "CommissionRefund"("chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionReminder_sellerId_day_key" ON "CommissionReminder"("sellerId", "day");

-- AddForeignKey
ALTER TABLE "CommissionPolicyChange" ADD CONSTRAINT "CommissionPolicyChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionCharge" ADD CONSTRAINT "CommissionCharge_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionCharge" ADD CONSTRAINT "CommissionCharge_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRefund" ADD CONSTRAINT "CommissionRefund_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRefund" ADD CONSTRAINT "CommissionRefund_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "CommissionCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRefund" ADD CONSTRAINT "CommissionRefund_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionReminder" ADD CONSTRAINT "CommissionReminder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionReminder" ADD CONSTRAINT "CommissionReminder_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Opt in explicitly. No fees are backfilled onto historical orders.
INSERT INTO "CommissionPolicy" (id,"updatedAt") VALUES ('platform',CURRENT_TIMESTAMP);
ALTER TABLE "CommissionPolicy" ADD CONSTRAINT "commission_policy_valid" CHECK (
  id='platform' AND "rateBps" BETWEEN 0 AND 10000 AND "paymentDays" BETWEEN 1 AND 90 AND version>=0
  AND (NOT enabled OR ("rateBps">0 AND length(trim("bankName"))>0 AND length(trim("accountName"))>0 AND length(trim("accountNumber"))>0
    AND "bankName" IS NOT NULL AND "accountName" IS NOT NULL AND "accountNumber" IS NOT NULL))
);
ALTER TABLE "SellerOrder" ADD CONSTRAINT "commission_snapshot_valid" CHECK (
  ("commissionRateBps" IS NULL AND "commissionPolicyVersion" IS NULL AND "commissionReturnDays" IS NULL AND "commissionPaymentDays" IS NULL)
  OR ("commissionRateBps" IS NOT NULL AND "commissionPolicyVersion" IS NOT NULL AND "commissionReturnDays" IS NOT NULL AND "commissionPaymentDays" IS NOT NULL
    AND "commissionRateBps" BETWEEN 1 AND 10000 AND "commissionPolicyVersion">=1 AND "commissionReturnDays" BETWEEN 1 AND 365 AND "commissionPaymentDays" BETWEEN 1 AND 90)
);
ALTER TABLE "CommissionCharge" ADD CONSTRAINT "commission_charge_valid" CHECK (
  "baseMinor">0 AND "rateBps" BETWEEN 1 AND 10000 AND "amountMinor">0
  AND "amountMinor"=(("baseMinor"::bigint*"rateBps"+5000)/10000) AND "dueAt">="holdUntil"
);
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "commission_payment_valid" CHECK (
  "amountMinor" BETWEEN 1 AND 1000000000 AND "byteSize" BETWEEN 1 AND 5242880
  AND "contentType" IN ('image/jpeg','image/png','image/webp') AND "storageKey" LIKE 'commission-receipts/%'
  AND ((status='PENDING' AND "reviewerId" IS NULL AND "reviewedAt" IS NULL AND "reviewNote" IS NULL)
    OR (status<>'PENDING' AND "reviewerId" IS NOT NULL AND "reviewerId"<>"submitterId" AND "reviewedAt" IS NOT NULL AND length(trim("reviewNote"))>=10))
);
ALTER TABLE "CommissionRefund" ADD CONSTRAINT "commission_refund_valid" CHECK ("baseMinor">0 AND "creditMinor">=0);
ALTER TABLE "CommissionReminder" ADD CONSTRAINT "commission_reminder_valid" CHECK ("amountMinor">0);

-- A rejected claim may be corrected and resubmitted with the same bank reference.
DROP INDEX "CommissionPayment_reference_key";
CREATE INDEX "CommissionPayment_reference_idx" ON "CommissionPayment"(reference);
CREATE UNIQUE INDEX "CommissionPayment_active_reference_key" ON "CommissionPayment"(reference) WHERE status<>'REJECTED';

CREATE FUNCTION protect_commission_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Commission history is append only';
END $$;
CREATE TRIGGER "commission_charge_immutable" BEFORE UPDATE OR DELETE ON "CommissionCharge" FOR EACH ROW EXECUTE FUNCTION protect_commission_record();
CREATE TRIGGER "commission_refund_immutable" BEFORE UPDATE OR DELETE ON "CommissionRefund" FOR EACH ROW EXECUTE FUNCTION protect_commission_record();
CREATE TRIGGER "commission_policy_history_immutable" BEFORE UPDATE OR DELETE ON "CommissionPolicyChange" FOR EACH ROW EXECUTE FUNCTION protect_commission_record();
CREATE TRIGGER "commission_reminder_immutable" BEFORE UPDATE OR DELETE ON "CommissionReminder" FOR EACH ROW EXECUTE FUNCTION protect_commission_record();

CREATE FUNCTION protect_commission_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment history cannot be deleted'; END IF;
  IF OLD.status<>'PENDING' OR NEW.status='PENDING' OR
    (to_jsonb(NEW)-ARRAY['status','reviewerId','reviewedAt','reviewNote']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','reviewerId','reviewedAt','reviewNote'])
  THEN RAISE EXCEPTION 'A payment permits one review and no financial edits'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "commission_payment_review_once" BEFORE UPDATE OR DELETE ON "CommissionPayment" FOR EACH ROW EXECUTE FUNCTION protect_commission_payment();

CREATE FUNCTION protect_order_commission_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."commissionRateBps",NEW."commissionPolicyVersion",NEW."commissionReturnDays",NEW."commissionPaymentDays") IS DISTINCT FROM
     ROW(OLD."commissionRateBps",OLD."commissionPolicyVersion",OLD."commissionReturnDays",OLD."commissionPaymentDays")
  THEN RAISE EXCEPTION 'Order commission snapshots cannot be changed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "order_commission_snapshot_immutable" BEFORE UPDATE ON "SellerOrder" FOR EACH ROW EXECUTE FUNCTION protect_order_commission_snapshot();

CREATE FUNCTION validate_commission_charge() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "SellerOrder" o WHERE o.id=NEW."sellerOrderId" AND o."sellerId"=NEW."sellerId"
    AND o.status='DELIVERED' AND o."paymentCollectedAt" IS NOT NULL AND o."subtotalLkrMinor"=NEW."baseMinor"
    AND o."commissionRateBps"=NEW."rateBps" AND NEW."holdUntil"=o."paymentCollectedAt"+o."commissionReturnDays"*INTERVAL '1 day'
    AND NEW."dueAt"=NEW."holdUntil"+o."commissionPaymentDays"*INTERVAL '1 day')
  THEN RAISE EXCEPTION 'Commission charge must match its delivered COD order snapshot'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "commission_charge_matches_order" BEFORE INSERT ON "CommissionCharge" FOR EACH ROW EXECUTE FUNCTION validate_commission_charge();

CREATE FUNCTION validate_commission_refund() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "CommissionCharge"%ROWTYPE; refunded bigint; credited bigint;
BEGIN
  PERFORM 1 FROM "Seller" WHERE id=NEW."sellerId" FOR UPDATE;
  SELECT * INTO c FROM "CommissionCharge" WHERE id=NEW."chargeId" AND "sellerId"=NEW."sellerId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund must belong to the charged shop'; END IF;
  SELECT COALESCE(SUM("baseMinor"),0),COALESCE(SUM("creditMinor"),0) INTO refunded,credited FROM "CommissionRefund" WHERE "chargeId"=NEW."chargeId";
  IF refunded+NEW."baseMinor">c."baseMinor" OR NEW."creditMinor"<>((refunded+NEW."baseMinor")*c."rateBps"+5000)/10000-credited
  THEN RAISE EXCEPTION 'Refund credit must match the remaining merchandise commission'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "commission_refund_capped" BEFORE INSERT ON "CommissionRefund" FOR EACH ROW EXECUTE FUNCTION validate_commission_refund();
