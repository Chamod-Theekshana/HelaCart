-- Nullable assignment means commission is inactive. Do not backfill old items.
-- Retain legacy policy columns for audit compatibility; new orders never use them.
ALTER TABLE "CommissionPolicy" DROP CONSTRAINT "commission_policy_valid";
ALTER TABLE "CommissionPolicy" ADD CONSTRAINT "commission_policy_valid" CHECK (id='platform' AND "rateBps" BETWEEN 0 AND 10000 AND "paymentDays" BETWEEN 1 AND 90 AND version>=0);
ALTER TABLE "Product" ADD COLUMN "commissionRateBps" INTEGER, ADD COLUMN "commissionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD CONSTRAINT "product_commission_valid" CHECK (("commissionRateBps" IS NULL OR "commissionRateBps" BETWEEN 0 AND 10000) AND "commissionVersion">=0);
ALTER TABLE "OrderItem" ADD COLUMN "commissionRateBps" INTEGER, ADD COLUMN "commissionAmountMinor" INTEGER,
 ADD COLUMN "commissionProductVersion" INTEGER, ADD COLUMN "commissionPaymentDays" INTEGER, ADD COLUMN "commissionPolicyVersion" INTEGER;
ALTER TABLE "OrderItem" ADD CONSTRAINT "item_commission_valid" CHECK (
 ("commissionRateBps" IS NULL AND "commissionAmountMinor" IS NULL AND "commissionProductVersion" IS NULL AND "commissionPaymentDays" IS NULL AND "commissionPolicyVersion" IS NULL)
 OR ("commissionRateBps" IS NOT NULL AND "commissionAmountMinor" IS NOT NULL AND "commissionProductVersion" IS NOT NULL AND "commissionPaymentDays" IS NOT NULL AND "commissionPolicyVersion" IS NOT NULL
 AND "commissionRateBps" BETWEEN 0 AND 10000 AND "commissionProductVersion">=0 AND "commissionPolicyVersion">=0 AND "commissionPaymentDays" BETWEEN 1 AND 90
 AND "commissionAmountMinor"=(("lineLkrMinor"::bigint*"commissionRateBps"+5000)/10000)));
CREATE FUNCTION protect_item_commission_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Order item history cannot be deleted'; END IF;
 IF ROW(NEW."commissionRateBps",NEW."commissionAmountMinor",NEW."commissionProductVersion",NEW."commissionPaymentDays",NEW."commissionPolicyVersion",NEW."lineLkrMinor",NEW.quantity,NEW."unitLkrMinor",NEW."variantId",NEW."sellerOrderId") IS DISTINCT FROM
 ROW(OLD."commissionRateBps",OLD."commissionAmountMinor",OLD."commissionProductVersion",OLD."commissionPaymentDays",OLD."commissionPolicyVersion",OLD."lineLkrMinor",OLD.quantity,OLD."unitLkrMinor",OLD."variantId",OLD."sellerOrderId")
 THEN RAISE EXCEPTION 'Order item financial snapshots cannot be changed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "item_commission_immutable" BEFORE UPDATE OR DELETE ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION protect_item_commission_snapshot();

ALTER TABLE "CommissionCharge" ADD COLUMN "orderItemId" UUID;
DROP INDEX "CommissionCharge_sellerOrderId_key";
CREATE INDEX "CommissionCharge_sellerOrderId_idx" ON "CommissionCharge"("sellerOrderId");
CREATE UNIQUE INDEX "CommissionCharge_orderItemId_key" ON "CommissionCharge"("orderItemId");
CREATE UNIQUE INDEX "commission_legacy_order_key" ON "CommissionCharge"("sellerOrderId") WHERE "orderItemId" IS NULL;
ALTER TABLE "CommissionCharge" ADD CONSTRAINT "CommissionCharge_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION validate_commission_charge() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."orderItemId" IS NOT NULL THEN
   IF NOT EXISTS (SELECT 1 FROM "OrderItem" i JOIN "SellerOrder" o ON o.id=i."sellerOrderId" WHERE i.id=NEW."orderItemId" AND o.id=NEW."sellerOrderId" AND o."sellerId"=NEW."sellerId"
     AND o.status='DELIVERED' AND o."paymentCollectedAt" IS NOT NULL AND o."commissionRateBps" IS NULL
     AND i."lineLkrMinor"=NEW."baseMinor" AND i."commissionRateBps"=NEW."rateBps" AND i."commissionAmountMinor"=NEW."amountMinor"
     AND NEW."holdUntil"=o."paymentCollectedAt"+i."commissionPaymentDays"*INTERVAL '1 day' AND NEW."dueAt"=NEW."holdUntil")
   THEN RAISE EXCEPTION 'Commission must match the delivered item snapshot'; END IF;
 ELSE
   IF NOT EXISTS (SELECT 1 FROM "SellerOrder" o WHERE o.id=NEW."sellerOrderId" AND o."sellerId"=NEW."sellerId"
     AND o.status='DELIVERED' AND o."paymentCollectedAt" IS NOT NULL AND o."subtotalLkrMinor"=NEW."baseMinor" AND o."commissionRateBps"=NEW."rateBps"
     AND NEW."holdUntil"=o."paymentCollectedAt"+o."commissionReturnDays"*INTERVAL '1 day' AND NEW."dueAt"=NEW."holdUntil"+o."commissionPaymentDays"*INTERVAL '1 day')
   THEN RAISE EXCEPTION 'Legacy commission must match original terms'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE TABLE "ProductCommissionChange" (
 id UUID PRIMARY KEY, "productId" UUID NOT NULL REFERENCES "Product"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 version INTEGER NOT NULL, "actorId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "beforeRateBps" INTEGER, "rateBps" INTEGER, reason VARCHAR(500) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (version>0 AND length(trim(reason))>=10 AND ("rateBps" IS NULL OR "rateBps" BETWEEN 0 AND 10000))
);
CREATE UNIQUE INDEX "ProductCommissionChange_productId_version_key" ON "ProductCommissionChange"("productId",version);
CREATE TRIGGER "product_commission_history_immutable" BEFORE UPDATE OR DELETE ON "ProductCommissionChange" FOR EACH ROW EXECUTE FUNCTION protect_commission_record();
CREATE TABLE "CommissionHoldEvent" (
 id UUID PRIMARY KEY, "chargeId" UUID NOT NULL REFERENCES "CommissionCharge"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 version INTEGER NOT NULL, "actorId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 held BOOLEAN NOT NULL, reason VARCHAR(500) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(version>0 AND length(trim(reason))>=10)
);
CREATE UNIQUE INDEX "CommissionHoldEvent_chargeId_version_key" ON "CommissionHoldEvent"("chargeId",version);
CREATE TRIGGER "commission_hold_history_immutable" BEFORE UPDATE OR DELETE ON "CommissionHoldEvent" FOR EACH ROW EXECUTE FUNCTION protect_commission_record();
