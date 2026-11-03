-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'STOCK_LOW';

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "stockAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "stockSettingsVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StockWatch" (
    "variantId" UUID NOT NULL,
    "dirty" BOOLEAN NOT NULL DEFAULT true,
    "level" VARCHAR(10) NOT NULL DEFAULT 'CLEAR',
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMPTZ(3),

    CONSTRAINT "StockWatch_pkey" PRIMARY KEY ("variantId")
);

-- CreateTable
CREATE TABLE "BulkJob" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "sellerId" UUID,
    "requestKey" UUID NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "inputHash" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "preview" JSONB NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'PREVIEW',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "appliedAt" TIMESTAMPTZ(3),

    CONSTRAINT "BulkJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockWatch_dirty_variantId_idx" ON "StockWatch"("dirty", "variantId");

-- CreateIndex
CREATE INDEX "BulkJob_sellerId_createdAt_idx" ON "BulkJob"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BulkJob_actorId_requestKey_key" ON "BulkJob"("actorId", "requestKey");

-- AddForeignKey
ALTER TABLE "StockWatch" ADD CONSTRAINT "StockWatch_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkJob" ADD CONSTRAINT "BulkJob_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkJob" ADD CONSTRAINT "BulkJob_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_threshold_check" CHECK ("lowStockThreshold" BETWEEN 0 AND 1000000 AND "stockSettingsVersion">=0);
ALTER TABLE "StockWatch" ADD CONSTRAINT "StockWatch_level_check" CHECK (level IN ('CLEAR','LOW','OUT'));
ALTER TABLE "BulkJob" ADD CONSTRAINT "BulkJob_state_check" CHECK (kind IN ('STOCK_SET','PRODUCT_SUBMIT','PRODUCT_HIDE','PRODUCT_APPROVE','PRODUCT_REJECT') AND status IN ('PREVIEW','APPLIED') AND ((status='PREVIEW' AND "appliedAt" IS NULL) OR (status='APPLIED' AND "appliedAt" IS NOT NULL)) AND length(btrim(reason)) BETWEEN 10 AND 500);
CREATE FUNCTION protect_bulk_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Bulk action history is retained'; END IF;
 IF OLD.status<>'PREVIEW' OR NEW.status<>'APPLIED' OR (to_jsonb(NEW)-ARRAY['status','appliedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','appliedAt']) THEN RAISE EXCEPTION 'Bulk previews are immutable and may be applied once'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "bulk_job_immutable" BEFORE UPDATE OR DELETE ON "BulkJob" FOR EACH ROW EXECUTE FUNCTION protect_bulk_job();

CREATE FUNCTION queue_stock_watch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO "StockWatch" ("variantId",dirty) VALUES(NEW.id,true) ON CONFLICT("variantId") DO UPDATE SET dirty=true;
 RETURN NEW;
END $$;
CREATE TRIGGER "variant_stock_watch" AFTER INSERT OR UPDATE OF "onHand","reserved","lowStockThreshold","stockAlertsEnabled" ON "ProductVariant" FOR EACH ROW EXECUTE FUNCTION queue_stock_watch();
CREATE FUNCTION queue_product_stock_watch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO "StockWatch" ("variantId",dirty) SELECT id,true FROM "ProductVariant" WHERE "productId"=NEW.id ON CONFLICT("variantId") DO UPDATE SET dirty=true;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "product_status_stock_watch" AFTER UPDATE OF status ON "Product" FOR EACH ROW EXECUTE FUNCTION queue_product_stock_watch();
CREATE FUNCTION queue_seller_stock_watch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO "StockWatch" ("variantId",dirty) SELECT id,true FROM "ProductVariant" WHERE "sellerId"=NEW.id ON CONFLICT("variantId") DO UPDATE SET dirty=true;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "seller_status_stock_watch" AFTER UPDATE OF status ON "Seller" FOR EACH ROW EXECUTE FUNCTION queue_seller_stock_watch();
CREATE FUNCTION queue_category_stock_watch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD."isActive" IS DISTINCT FROM NEW."isActive" THEN
  INSERT INTO "StockWatch" ("variantId",dirty) SELECT v.id,true FROM "ProductVariant" v JOIN "Product" p ON p.id=v."productId" WHERE p."categoryId"=NEW.id ON CONFLICT("variantId") DO UPDATE SET dirty=true;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "category_status_stock_watch" AFTER UPDATE OF "isActive" ON "Category" FOR EACH ROW EXECUTE FUNCTION queue_category_stock_watch();

-- Establish a quiet baseline: existing low stock is visible without sending a
-- migration-time notification to every shop. Future transitions are queued.
INSERT INTO "StockWatch" ("variantId",dirty,level,"checkedAt")
 SELECT v.id,false,CASE WHEN NOT v."stockAlertsEnabled" OR p.status<>'APPROVED' OR s.status<>'APPROVED' OR NOT c."isActive" OR v."onHand"-v.reserved>v."lowStockThreshold" THEN 'CLEAR' WHEN v."onHand"=v.reserved THEN 'OUT' ELSE 'LOW' END,NOW()
 FROM "ProductVariant" v JOIN "Product" p ON p.id=v."productId" JOIN "Seller" s ON s.id=v."sellerId" JOIN "Category" c ON c.id=p."categoryId";
CREATE INDEX "SellerOrder_report_delivery_idx" ON "SellerOrder" ("sellerId", "paymentCollectedAt") WHERE status='DELIVERED';
CREATE INDEX "SellerOrderEvent_delivery_report_idx" ON "SellerOrderEvent" ("sellerOrderId","createdAt") WHERE "toStatus"='DELIVERED';
