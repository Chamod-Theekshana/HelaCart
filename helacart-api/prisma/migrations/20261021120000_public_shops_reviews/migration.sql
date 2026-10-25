ALTER TABLE "Seller" ADD COLUMN "publicLocation" TEXT, ADD COLUMN "logoUrl" TEXT, ADD COLUMN "coverUrl" TEXT;

CREATE TYPE "ShopReviewReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

CREATE TABLE "ShopReview" (
  "id" UUID NOT NULL,
  "sellerId" UUID NOT NULL,
  "buyerId" UUID NOT NULL,
  "sellerOrderId" UUID NOT NULL,
  "buyerName" VARCHAR(100) NOT NULL,
  "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment" VARCHAR(1500) NOT NULL,
  "isHidden" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMPTZ(3),
  "reply" VARCHAR(1500),
  "replyUserId" UUID,
  "repliedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ShopReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopReview_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShopReview_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShopReview_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShopReview_replyUserId_fkey" FOREIGN KEY ("replyUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShopReview_sellerOrderId_key" ON "ShopReview"("sellerOrderId");
CREATE INDEX "ShopReview_sellerId_isHidden_deletedAt_createdAt_idx" ON "ShopReview"("sellerId", "isHidden", "deletedAt", "createdAt");
CREATE INDEX "ShopReview_buyerId_sellerId_idx" ON "ShopReview"("buyerId", "sellerId");

CREATE TABLE "ShopReviewReport" (
  "id" UUID NOT NULL,
  "reviewId" UUID NOT NULL,
  "reporterUserId" UUID NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "commentSnapshot" VARCHAR(1500) NOT NULL,
  "ratingSnapshot" INTEGER NOT NULL,
  "status" "ShopReviewReportStatus" NOT NULL DEFAULT 'OPEN',
  "moderatorUserId" UUID,
  "moderationNote" VARCHAR(500),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMPTZ(3),
  CONSTRAINT "ShopReviewReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ShopReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShopReviewReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShopReviewReport_moderatorUserId_fkey" FOREIGN KEY ("moderatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShopReviewReport_reviewId_reporterUserId_key" ON "ShopReviewReport"("reviewId", "reporterUserId");
CREATE INDEX "ShopReviewReport_status_createdAt_idx" ON "ShopReviewReport"("status", "createdAt");
