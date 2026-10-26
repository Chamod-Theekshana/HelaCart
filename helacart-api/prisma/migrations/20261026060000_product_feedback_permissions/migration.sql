-- CreateEnum
CREATE TYPE "AccountAccessStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessStatus" "AccountAccessStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "accessVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" VARCHAR(100),
ADD COLUMN     "specifications" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "warranty" VARCHAR(500);

-- CreateTable
CREATE TABLE "AccountAccessChange" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "AccountAccessStatus" NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountAccessChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerTeamChange" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "memberUserId" UUID NOT NULL,
    "action" VARCHAR(10) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerTeamChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProductReview" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "buyerName" VARCHAR(100) NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(1500) NOT NULL,
    "variantLabel" VARCHAR(300) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ(3),
    "reply" VARCHAR(1500),
    "replyUserId" UUID,
    "repliedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CustomerProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProductReviewReport" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "ratingSnapshot" INTEGER NOT NULL,
    "commentSnapshot" VARCHAR(1500) NOT NULL,
    "status" "ShopReviewReportStatus" NOT NULL DEFAULT 'OPEN',
    "moderatorId" UUID,
    "note" VARCHAR(500),
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerProductReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountAccessChange_userId_version_key" ON "AccountAccessChange"("userId", "version");

-- CreateIndex
CREATE INDEX "SellerTeamChange_sellerId_createdAt_idx" ON "SellerTeamChange"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerProductReview_productId_isHidden_deletedAt_createdA_idx" ON "CustomerProductReview"("productId", "isHidden", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProductReview_productId_buyerId_key" ON "CustomerProductReview"("productId", "buyerId");

-- CreateIndex
CREATE INDEX "CustomerProductReviewReport_status_createdAt_idx" ON "CustomerProductReviewReport"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProductReviewReport_reviewId_reporterId_key" ON "CustomerProductReviewReport"("reviewId", "reporterId");

-- AddForeignKey
ALTER TABLE "AccountAccessChange" ADD CONSTRAINT "AccountAccessChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountAccessChange" ADD CONSTRAINT "AccountAccessChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerTeamChange" ADD CONSTRAINT "SellerTeamChange_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerTeamChange" ADD CONSTRAINT "SellerTeamChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProductReview" ADD CONSTRAINT "CustomerProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProductReview" ADD CONSTRAINT "CustomerProductReview_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProductReview" ADD CONSTRAINT "CustomerProductReview_replyUserId_fkey" FOREIGN KEY ("replyUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProductReviewReport" ADD CONSTRAINT "CustomerProductReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CustomerProductReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProductReviewReport" ADD CONSTRAINT "CustomerProductReviewReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProductReviewReport" ADD CONSTRAINT "CustomerProductReviewReport_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerProductReview" ADD CONSTRAINT "CustomerProductReview_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerProductReview" ADD CONSTRAINT "CustomerProductReview_values_check" CHECK (rating BETWEEN 1 AND 5 AND version > 0 AND length(btrim(comment)) BETWEEN 10 AND 1500);
ALTER TABLE "AccountAccessChange" ADD CONSTRAINT "AccountAccessChange_values_check" CHECK (version > 0 AND length(btrim(reason)) BETWEEN 10 AND 500);
ALTER TABLE "SellerTeamChange" ADD CONSTRAINT "SellerTeamChange_values_check" CHECK (action IN ('ADDED','REMOVED') AND length(btrim(reason)) BETWEEN 10 AND 500);
ALTER TABLE "Product" ADD CONSTRAINT "Product_specifications_array_check" CHECK (jsonb_typeof(specifications)='array' AND jsonb_array_length(specifications)<=20);

CREATE FUNCTION protect_product_feedback_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Product and account permission history is append only'; END $$;
CREATE TRIGGER "account_access_history_immutable" BEFORE UPDATE OR DELETE ON "AccountAccessChange" FOR EACH ROW EXECUTE FUNCTION protect_product_feedback_history();
CREATE TRIGGER "seller_team_history_immutable" BEFORE UPDATE OR DELETE ON "SellerTeamChange" FOR EACH ROW EXECUTE FUNCTION protect_product_feedback_history();
CREATE FUNCTION validate_customer_product_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Product reviews must be soft deleted'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW."productId"<>OLD."productId" OR NEW."buyerId"<>OLD."buyerId" OR NEW."orderItemId"<>OLD."orderItemId" OR NEW."buyerName"<>OLD."buyerName" OR NEW."variantLabel"<>OLD."variantLabel" OR NEW."createdAt"<>OLD."createdAt" OR NEW.version<>OLD.version+1 OR (OLD."isHidden" AND NOT NEW."isHidden") THEN RAISE EXCEPTION 'Product review identity and moderation are protected'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM "OrderItem" i JOIN "ProductVariant" v ON v.id=i."variantId" JOIN "SellerOrder" so ON so.id=i."sellerOrderId" JOIN "Order" o ON o.id=so."orderId" JOIN "Product" p ON p.id=v."productId" WHERE i.id=NEW."orderItemId" AND p.id=NEW."productId" AND o."buyerId"=NEW."buyerId" AND so.status='DELIVERED' AND so."sellerId"=p."sellerId") THEN RAISE EXCEPTION 'A delivered purchase of this product is required'; END IF;
  IF EXISTS(SELECT 1 FROM "SellerMember" m JOIN "Product" p ON p."sellerId"=m."sellerId" WHERE p.id=NEW."productId" AND m."userId"=NEW."buyerId") THEN RAISE EXCEPTION 'Shop members cannot review their own products'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "customer_product_review_protected" BEFORE INSERT OR UPDATE OR DELETE ON "CustomerProductReview" FOR EACH ROW EXECUTE FUNCTION validate_customer_product_review();
CREATE FUNCTION protect_customer_product_report() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Product report history is retained'; END IF;
 IF OLD.status<>'OPEN' OR NEW.status='OPEN' OR (to_jsonb(NEW)-ARRAY['status','moderatorId','note','reviewedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','moderatorId','note','reviewedAt']) OR NEW."moderatorId" IS NULL OR NEW."reviewedAt" IS NULL OR length(btrim(NEW.note))<10 THEN RAISE EXCEPTION 'Product reports allow one recorded moderation decision'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "customer_product_report_review_once" BEFORE UPDATE OR DELETE ON "CustomerProductReviewReport" FOR EACH ROW EXECUTE FUNCTION protect_customer_product_report();
