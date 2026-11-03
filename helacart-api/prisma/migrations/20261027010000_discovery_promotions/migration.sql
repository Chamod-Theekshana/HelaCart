-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FAVORITE_PRICE_DROP';
ALTER TYPE "NotificationType" ADD VALUE 'FAVORITE_RESTOCK';
ALTER TYPE "NotificationType" ADD VALUE 'PROMOTION_UPDATED';

-- AlterTable
ALTER TABLE "ProductFavorite" ADD COLUMN     "alertVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lowestNotifiedMinor" INTEGER,
ADD COLUMN     "nextCheckAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "observedAvailable" BOOLEAN,
ADD COLUMN     "observedPriceMinor" INTEGER,
ADD COLUMN     "priceAlerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "restockAlerts" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "originalUnitLkrMinor" INTEGER,
ADD COLUMN     "promotionDiscountBps" INTEGER,
ADD COLUMN     "promotionId" UUID;

-- CreateTable
CREATE TABLE "Promotion" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "submitterId" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "discountBps" INTEGER NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionEvent" (
    "id" UUID NOT NULL,
    "promotionId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Promotion_productId_status_startsAt_endsAt_idx" ON "Promotion"("productId", "status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Promotion_sellerId_createdAt_idx" ON "Promotion"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_submitterId_requestKey_key" ON "Promotion"("submitterId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionEvent_promotionId_version_key" ON "PromotionEvent"("promotionId", "version");

-- CreateIndex
CREATE INDEX "ProductFavorite_nextCheckAt_idx" ON "ProductFavorite"("nextCheckAt");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionEvent" ADD CONSTRAINT "PromotionEvent_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionEvent" ADD CONSTRAINT "PromotionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Promotion" ADD CONSTRAINT "promotion_terms_valid" CHECK ("discountBps" BETWEEN 100 AND 9000 AND "endsAt">"startsAt" AND "endsAt"-"startsAt"<=INTERVAL '90 days' AND status IN ('PENDING','APPROVED','REJECTED','CANCELLED') AND version>=0);
ALTER TABLE "PromotionEvent" ADD CONSTRAINT "promotion_event_valid" CHECK (version>0 AND status IN ('APPROVED','REJECTED','CANCELLED') AND length(btrim(reason)) BETWEEN 10 AND 500);
CREATE FUNCTION protect_promotion_terms() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Promotion history is retained'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version']) OR NEW.version<>OLD.version+1 OR NOT ((OLD.status='PENDING' AND NEW.status IN ('APPROVED','REJECTED','CANCELLED')) OR (OLD.status='APPROVED' AND NEW.status='CANCELLED')) THEN RAISE EXCEPTION 'Promotion terms are immutable and decisions are versioned'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "promotion_terms_immutable" BEFORE UPDATE OR DELETE ON "Promotion" FOR EACH ROW EXECUTE FUNCTION protect_promotion_terms();
CREATE TRIGGER "promotion_events_immutable" BEFORE UPDATE OR DELETE ON "PromotionEvent" FOR EACH ROW EXECUTE FUNCTION protect_commission_record();
ALTER TABLE "OrderItem" ADD CONSTRAINT "promotion_snapshot_valid" CHECK (("promotionId" IS NULL AND "originalUnitLkrMinor" IS NULL AND "promotionDiscountBps" IS NULL) OR ("promotionId" IS NOT NULL AND "originalUnitLkrMinor" IS NOT NULL AND "promotionDiscountBps" IS NOT NULL AND "originalUnitLkrMinor">=1 AND "promotionDiscountBps" BETWEEN 100 AND 9000 AND "unitLkrMinor"=GREATEST(1,"originalUnitLkrMinor"-(("originalUnitLkrMinor"::bigint*"promotionDiscountBps"+5000)/10000))));
CREATE FUNCTION protect_promotion_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW."promotionId",NEW."originalUnitLkrMinor",NEW."promotionDiscountBps") IS DISTINCT FROM ROW(OLD."promotionId",OLD."originalUnitLkrMinor",OLD."promotionDiscountBps") THEN RAISE EXCEPTION 'Order promotion snapshots are immutable'; END IF;
 IF TG_OP='INSERT' AND NEW."promotionId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Promotion" p JOIN "ProductVariant" v ON v."productId"=p."productId" WHERE p.id=NEW."promotionId" AND v.id=NEW."variantId" AND p."discountBps"=NEW."promotionDiscountBps") THEN RAISE EXCEPTION 'Promotion does not match the ordered product'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "order_promotion_snapshot_immutable" BEFORE INSERT OR UPDATE ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION protect_promotion_snapshot();
CREATE INDEX "favorite_alert_due_idx" ON "ProductFavorite" ("nextCheckAt",id) WHERE "priceAlerts" OR "restockAlerts";
CREATE INDEX "Product_discovery_search_idx" ON "Product" USING GIN(to_tsvector('simple',coalesce(title,'')||' '||coalesce(brand,'')||' '||coalesce(description,'')||' '||coalesce(sku,'')));
