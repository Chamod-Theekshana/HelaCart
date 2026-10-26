ALTER TYPE "NotificationType" ADD VALUE 'SUPPORT_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'REFUND_UPDATED';
CREATE TYPE "RefundStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
DROP INDEX "ReturnRequest_sellerOrderId_key";
ALTER TABLE "ReturnRequest" ADD COLUMN "requestKey" UUID, ADD COLUMN outcome VARCHAR(30), ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "ReturnRequest_sellerOrderId_idx" ON "ReturnRequest"("sellerOrderId");
CREATE UNIQUE INDEX "ReturnRequest_buyerId_requestKey_key" ON "ReturnRequest"("buyerId","requestKey");
CREATE TABLE "ReturnItem" (
 id UUID PRIMARY KEY, "returnRequestId" UUID NOT NULL REFERENCES "ReturnRequest"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "orderItemId" UUID NOT NULL REFERENCES "OrderItem"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 quantity INTEGER NOT NULL, "baseMinor" INTEGER NOT NULL, CHECK(quantity>0 AND "baseMinor">=0)
);
CREATE UNIQUE INDEX "ReturnItem_returnRequestId_orderItemId_key" ON "ReturnItem"("returnRequestId","orderItemId");
CREATE INDEX "ReturnItem_orderItemId_idx" ON "ReturnItem"("orderItemId");
-- Older requests covered the whole shop order; retain that exact meaning.
INSERT INTO "ReturnItem"(id,"returnRequestId","orderItemId",quantity,"baseMinor") SELECT gen_random_uuid(),r.id,i.id,i.quantity,i."lineLkrMinor" FROM "ReturnRequest" r JOIN "OrderItem" i ON i."sellerOrderId"=r."sellerOrderId";
CREATE FUNCTION protect_after_sales_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'After-sales history is append only'; END $$;
CREATE TRIGGER "return_item_immutable" BEFORE UPDATE OR DELETE ON "ReturnItem" FOR EACH ROW EXECUTE FUNCTION protect_after_sales_history();
CREATE FUNCTION validate_return_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchased "OrderItem"%ROWTYPE; requested bigint; case_status "ReturnStatus"; order_id uuid;
BEGIN
 SELECT "sellerOrderId",status INTO order_id,case_status FROM "ReturnRequest" WHERE id=NEW."returnRequestId";
 PERFORM 1 FROM "SellerOrder" WHERE id=order_id FOR UPDATE;
 SELECT * INTO purchased FROM "OrderItem" WHERE id=NEW."orderItemId" AND "sellerOrderId"=order_id;
 IF NOT FOUND OR NEW.quantity>purchased.quantity OR NEW."baseMinor"<>purchased."unitLkrMinor"::bigint*NEW.quantity THEN RAISE EXCEPTION 'Return item must match its purchased quantity and price'; END IF;
 SELECT COALESCE(SUM(i.quantity),0) INTO requested FROM "ReturnItem" i JOIN "ReturnRequest" r ON r.id=i."returnRequestId" WHERE i."orderItemId"=purchased.id AND r.status<>'REJECTED';
 IF case_status<>'REJECTED' AND requested+NEW.quantity>purchased.quantity THEN RAISE EXCEPTION 'Return quantity exceeds remaining purchased quantity'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "return_item_quantity_capped" BEFORE INSERT ON "ReturnItem" FOR EACH ROW EXECUTE FUNCTION validate_return_item();

CREATE TABLE "RefundRecord" (
 id UUID PRIMARY KEY, "sellerId" UUID NOT NULL REFERENCES "Seller"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "returnItemId" UUID NOT NULL REFERENCES "ReturnItem"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "submitterId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,"requestKey" UUID NOT NULL,
 "merchandiseMinor" INTEGER NOT NULL,"shippingMinor" INTEGER NOT NULL DEFAULT 0,"amountMinor" INTEGER NOT NULL,
 method VARCHAR(30) NOT NULL,reference VARCHAR(100) NOT NULL,"paidOn" VARCHAR(10) NOT NULL,note VARCHAR(500),
 status "RefundStatus" NOT NULL DEFAULT 'PENDING',"reviewerId" UUID REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "reviewNote" VARCHAR(500),"reviewedAt" TIMESTAMPTZ(3),"commissionRefundId" UUID REFERENCES "CommissionRefund"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK("merchandiseMinor">=0 AND "shippingMinor">=0 AND "amountMinor" BETWEEN 1 AND 1000000000 AND "amountMinor"="merchandiseMinor"::bigint+"shippingMinor" AND method IN ('CASH','BANK_TRANSFER') AND length(trim(reference))>=3
 AND ((status='PENDING' AND "reviewerId" IS NULL AND "reviewedAt" IS NULL AND "reviewNote" IS NULL AND "commissionRefundId" IS NULL) OR (status<>'PENDING' AND "reviewerId" IS NOT NULL AND "reviewerId"<>"submitterId" AND "reviewedAt" IS NOT NULL AND length(trim("reviewNote"))>=10)))
);
CREATE UNIQUE INDEX "RefundRecord_sellerId_requestKey_key" ON "RefundRecord"("sellerId","requestKey");
CREATE UNIQUE INDEX "RefundRecord_commissionRefundId_key" ON "RefundRecord"("commissionRefundId");
CREATE INDEX "RefundRecord_sellerId_status_createdAt_idx" ON "RefundRecord"("sellerId",status,"createdAt");
CREATE INDEX "RefundRecord_returnItemId_idx" ON "RefundRecord"("returnItemId");
CREATE UNIQUE INDEX "refund_active_item_reference" ON "RefundRecord"("returnItemId",reference) WHERE status<>'REJECTED';
CREATE TABLE "RefundReversal" (
 id UUID PRIMARY KEY,"refundRecordId" UUID NOT NULL REFERENCES "RefundRecord"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "actorId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,"requestKey" UUID NOT NULL,reference VARCHAR(100) NOT NULL,reason VARCHAR(500) NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CHECK(length(trim(reason))>=10)
);
CREATE UNIQUE INDEX "RefundReversal_refundRecordId_key" ON "RefundReversal"("refundRecordId");
CREATE UNIQUE INDEX "RefundReversal_requestKey_key" ON "RefundReversal"("requestKey");
CREATE UNIQUE INDEX "RefundReversal_reference_key" ON "RefundReversal"(reference);
CREATE TRIGGER "refund_reversal_immutable" BEFORE UPDATE OR DELETE ON "RefundReversal" FOR EACH ROW EXECUTE FUNCTION protect_after_sales_history();
CREATE FUNCTION protect_refund_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Refund history cannot be deleted'; END IF;
 IF OLD.status<>'PENDING' OR NEW.status='PENDING' OR (to_jsonb(NEW)-ARRAY['status','reviewerId','reviewNote','reviewedAt','commissionRefundId']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','reviewerId','reviewNote','reviewedAt','commissionRefundId']) THEN RAISE EXCEPTION 'Refund details are immutable and permit one review'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER "refund_record_review_once" BEFORE UPDATE OR DELETE ON "RefundRecord" FOR EACH ROW EXECUTE FUNCTION protect_refund_record();
CREATE FUNCTION validate_refund_record() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE base bigint; shop uuid; order_id uuid; case_status "ReturnStatus"; shipping bigint; used_base bigint; used_shipping bigint;
BEGIN
 PERFORM 1 FROM "Seller" WHERE id=NEW."sellerId" FOR UPDATE;
 SELECT i."baseMinor",o."sellerId",o.id,r.status,o."shippingLkrMinor" INTO base,shop,order_id,case_status,shipping FROM "ReturnItem" i JOIN "ReturnRequest" r ON r.id=i."returnRequestId" JOIN "SellerOrder" o ON o.id=r."sellerOrderId" WHERE i.id=NEW."returnItemId";
 IF NOT FOUND OR shop<>NEW."sellerId" OR case_status NOT IN ('APPROVED','RESOLVED') THEN RAISE EXCEPTION 'Refund requires an approved return item belonging to this shop'; END IF;
 SELECT COALESCE(SUM(f."merchandiseMinor"),0) INTO used_base FROM "RefundRecord" f WHERE f."returnItemId"=NEW."returnItemId" AND f.status<>'REJECTED' AND NOT EXISTS(SELECT 1 FROM "RefundReversal" x WHERE x."refundRecordId"=f.id);
 SELECT COALESCE(SUM(f."shippingMinor"),0) INTO used_shipping FROM "RefundRecord" f JOIN "ReturnItem" i ON i.id=f."returnItemId" JOIN "ReturnRequest" r ON r.id=i."returnRequestId" WHERE r."sellerOrderId"=order_id AND f.status<>'REJECTED' AND NOT EXISTS(SELECT 1 FROM "RefundReversal" x WHERE x."refundRecordId"=f.id);
 IF used_base+NEW."merchandiseMinor">base OR used_shipping+NEW."shippingMinor">shipping THEN RAISE EXCEPTION 'Refund exceeds remaining merchandise or delivery value'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "refund_record_capped" BEFORE INSERT ON "RefundRecord" FOR EACH ROW EXECUTE FUNCTION validate_refund_record();

CREATE TABLE "SupportCase" (
 id UUID PRIMARY KEY,"openerId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,"buyerId" UUID REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "sellerId" UUID REFERENCES "Seller"(id) ON DELETE RESTRICT ON UPDATE CASCADE,"sellerOrderId" UUID REFERENCES "SellerOrder"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "requestKey" UUID NOT NULL,title VARCHAR(150) NOT NULL,category VARCHAR(30) NOT NULL,status VARCHAR(30) NOT NULL DEFAULT 'OPEN',version INTEGER NOT NULL DEFAULT 0,
 "financeHold" BOOLEAN NOT NULL DEFAULT false,resolution VARCHAR(1000),"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMPTZ(3) NOT NULL,
 CHECK(category IN ('ORDER_ISSUE','DELIVERY','RETURN','REFUND','ACCOUNT','OTHER') AND status IN ('OPEN','UNDER_REVIEW','WAITING_BUYER','WAITING_SELLER','RESOLVED','CLOSED') AND version>=0 AND (NOT "financeHold" OR ("sellerOrderId" IS NOT NULL AND status NOT IN ('RESOLVED','CLOSED'))))
);
CREATE UNIQUE INDEX "SupportCase_openerId_requestKey_key" ON "SupportCase"("openerId","requestKey");
CREATE INDEX "SupportCase_buyerId_updatedAt_idx" ON "SupportCase"("buyerId","updatedAt");
CREATE INDEX "SupportCase_sellerId_updatedAt_idx" ON "SupportCase"("sellerId","updatedAt");
CREATE INDEX "SupportCase_status_updatedAt_idx" ON "SupportCase"(status,"updatedAt");
CREATE INDEX "SupportCase_sellerOrderId_financeHold_idx" ON "SupportCase"("sellerOrderId","financeHold");
CREATE TABLE "SupportMessage" (
 id UUID PRIMARY KEY,"caseId" UUID NOT NULL REFERENCES "SupportCase"(id) ON DELETE RESTRICT ON UPDATE CASCADE,"authorId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "authorRole" VARCHAR(10) NOT NULL,"requestKey" UUID NOT NULL,body VARCHAR(4000) NOT NULL,"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK("authorRole" IN ('BUYER','SELLER','ADMIN') AND length(trim(body)) BETWEEN 1 AND 4000)
);
CREATE UNIQUE INDEX "SupportMessage_caseId_requestKey_key" ON "SupportMessage"("caseId","requestKey");
CREATE INDEX "SupportMessage_caseId_createdAt_idx" ON "SupportMessage"("caseId","createdAt");
CREATE TRIGGER "support_message_immutable" BEFORE UPDATE OR DELETE ON "SupportMessage" FOR EACH ROW EXECUTE FUNCTION protect_after_sales_history();
CREATE TABLE "SupportCaseEvent" (
 id UUID PRIMARY KEY,"caseId" UUID NOT NULL REFERENCES "SupportCase"(id) ON DELETE RESTRICT ON UPDATE CASCADE,"actorId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 version INTEGER NOT NULL,"fromStatus" VARCHAR(30) NOT NULL,"toStatus" VARCHAR(30) NOT NULL,"financeHold" BOOLEAN NOT NULL,reason VARCHAR(1000) NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CHECK(length(trim(reason))>=10)
);
CREATE UNIQUE INDEX "SupportCaseEvent_caseId_version_key" ON "SupportCaseEvent"("caseId",version);
CREATE TRIGGER "support_decision_immutable" BEFORE UPDATE OR DELETE ON "SupportCaseEvent" FOR EACH ROW EXECUTE FUNCTION protect_after_sales_history();
