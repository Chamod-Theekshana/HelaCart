-- Existing sellers may already exist on development branches, so application
-- details are nullable for the older rows. New applications validate them in API.
ALTER TABLE "Seller"
    ADD COLUMN "description" TEXT,
    ADD COLUMN "contactPhone" TEXT,
    ADD COLUMN "pickupAddress" TEXT;

CREATE TYPE "SellerReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

CREATE TABLE "SellerReview" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "reviewerUserId" UUID NOT NULL,
    "decision" "SellerReviewDecision" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SellerReview_sellerId_createdAt_idx" ON "SellerReview"("sellerId", "createdAt");
CREATE INDEX "SellerReview_reviewerUserId_idx" ON "SellerReview"("reviewerUserId");

ALTER TABLE "SellerReview"
    ADD CONSTRAINT "SellerReview_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerReview"
    ADD CONSTRAINT "SellerReview_reviewerUserId_fkey"
    FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
