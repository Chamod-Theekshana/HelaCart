ALTER TABLE "ShopReviewReport" ADD COLUMN "photoSnapshotIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
ALTER TABLE "ShopReview" ADD COLUMN "photoVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "ShopReviewPhoto" (
  "id" UUID NOT NULL,
  "reviewId" UUID NOT NULL,
  "storageKey" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL CHECK ("byteSize" > 0 AND "byteSize" <= 5242880),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ(3),
  CONSTRAINT "ShopReviewPhoto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopReviewPhoto_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ShopReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShopReviewPhoto_storageKey_key" ON "ShopReviewPhoto"("storageKey");
CREATE INDEX "ShopReviewPhoto_reviewId_deletedAt_createdAt_idx" ON "ShopReviewPhoto"("reviewId", "deletedAt", "createdAt");
