-- November 2026 hardening release: order lifecycle reasons, seller
-- suspension, address defaults, phone verification, notification outbox,
-- device tokens, notification preferences and the administrator audit log.

-- Seller order lifecycle ------------------------------------------------------
ALTER TABLE "SellerOrder"
  ADD COLUMN "statusReason" VARCHAR(500),
  ADD COLUMN "statusChangedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Backfill from the latest recorded transition (or placement). Only the new
-- column changes, so the delivery/commission snapshot triggers are not hit.
UPDATE "SellerOrder" so SET "statusChangedAt" = COALESCE(
  (SELECT max(e."createdAt") FROM "SellerOrderEvent" e WHERE e."sellerOrderId" = so.id),
  so."createdAt");
ALTER TABLE "SellerOrder" ADD CONSTRAINT "SellerOrder_status_reason_check"
  CHECK ("statusReason" IS NULL OR length(btrim("statusReason")) BETWEEN 1 AND 500);
CREATE INDEX "SellerOrder_status_statusChangedAt_idx" ON "SellerOrder"("status", "statusChangedAt");

-- System transitions (automatic cancellation) have no human actor.
ALTER TABLE "SellerOrderEvent" ALTER COLUMN "actorUserId" DROP NOT NULL;
ALTER TABLE "SellerOrderEvent" ADD COLUMN "reason" VARCHAR(500);

-- Seller suspension -----------------------------------------------------------
ALTER TABLE "Seller"
  ADD COLUMN "statusReason" VARCHAR(500),
  ADD COLUMN "statusChangedAt" TIMESTAMPTZ(3);

-- Address defaults ------------------------------------------------------------
ALTER TABLE "BuyerAddress" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
UPDATE "BuyerAddress" SET "isDefault" = true WHERE id IN (
  SELECT DISTINCT ON ("userId") id FROM "BuyerAddress"
  WHERE "isActive" ORDER BY "userId", "createdAt" DESC, id DESC);
CREATE UNIQUE INDEX "BuyerAddress_one_default_key" ON "BuyerAddress"("userId") WHERE "isDefault" AND "isActive";

-- Phone verification ----------------------------------------------------------
CREATE TABLE "PhoneVerification" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "phone" VARCHAR(16) NOT NULL,
  "codeHash" VARCHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PhoneVerification_values_check" CHECK ("phone" ~ '^\+947[0-9]{8}$' AND "attempts" BETWEEN 0 AND 5 AND "codeHash" ~ '^[0-9a-f]{64}$')
);
CREATE INDEX "PhoneVerification_userId_createdAt_idx" ON "PhoneVerification"("userId", "createdAt");
CREATE INDEX "PhoneVerification_phone_createdAt_idx" ON "PhoneVerification"("phone", "createdAt");
ALTER TABLE "PhoneVerification" ADD CONSTRAINT "PhoneVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "VerifiedPhone" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "phone" VARCHAR(16) NOT NULL,
  "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "VerifiedPhone_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VerifiedPhone_phone_check" CHECK ("phone" ~ '^\+947[0-9]{8}$')
);
CREATE UNIQUE INDEX "VerifiedPhone_userId_phone_key" ON "VerifiedPhone"("userId", "phone");
ALTER TABLE "VerifiedPhone" ADD CONSTRAINT "VerifiedPhone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Notification outbox ---------------------------------------------------------
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'EMAIL', 'SMS');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "NotificationDelivery" (
  "id" UUID NOT NULL,
  "notificationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" VARCHAR(500),
  "sentAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationDelivery_attempts_check" CHECK ("attempts" BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_key" ON "NotificationDelivery"("notificationId", "channel");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
CREATE INDEX "NotificationDelivery_userId_idx" ON "NotificationDelivery"("userId");
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DeviceToken" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "token" VARCHAR(4096) NOT NULL,
  "platform" VARCHAR(10) NOT NULL,
  "appVersion" VARCHAR(30),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceToken_platform_check" CHECK ("platform" IN ('android', 'ios', 'web') AND length("token") >= 20)
);
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_userId_updatedAt_idx" ON "DeviceToken"("userId", "updatedAt");
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "NotificationPreference" (
  "userId" UUID NOT NULL,
  "push" BOOLEAN NOT NULL DEFAULT true,
  "email" BOOLEAN NOT NULL DEFAULT true,
  "sms" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Administrator audit log (append only) ---------------------------------------
CREATE TABLE "AdminAuditLog" (
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "actorEmail" VARCHAR(320) NOT NULL,
  "action" VARCHAR(40) NOT NULL,
  "subjectType" VARCHAR(40) NOT NULL,
  "subjectId" VARCHAR(100) NOT NULL,
  "reason" VARCHAR(1000),
  "details" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminAuditLog_values_check" CHECK ("action" ~ '^[A-Z_]{3,40}$' AND jsonb_typeof("details") = 'object')
);
CREATE INDEX "AdminAuditLog_createdAt_id_idx" ON "AdminAuditLog"("createdAt", "id");
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE FUNCTION protect_admin_audit_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Administrator audit log is append only'; END $$;
CREATE TRIGGER "admin_audit_log_immutable" BEFORE UPDATE OR DELETE ON "AdminAuditLog" FOR EACH ROW EXECUTE FUNCTION protect_admin_audit_log();
