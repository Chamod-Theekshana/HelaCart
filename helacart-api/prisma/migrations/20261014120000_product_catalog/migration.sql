CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');

CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "priceLkrMinor" INTEGER NOT NULL,
    "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Product_priceLkrMinor_positive" CHECK ("priceLkrMinor" > 0)
);

CREATE UNIQUE INDEX "Product_sellerId_slug_key" ON "Product"("sellerId", "slug");
CREATE UNIQUE INDEX "Product_sellerId_sku_key" ON "Product"("sellerId", "sku");
CREATE INDEX "Product_status_createdAt_idx" ON "Product"("status", "createdAt");
CREATE INDEX "Product_categoryId_status_idx" ON "Product"("categoryId", "status");

ALTER TABLE "Product" ADD CONSTRAINT "Product_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "ProductReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

CREATE TABLE "ProductReview" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "reviewerUserId" UUID NOT NULL,
    "decision" "ProductReviewDecision" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductReview_productId_createdAt_idx" ON "ProductReview"("productId", "createdAt");
CREATE INDEX "ProductReview_reviewerUserId_idx" ON "ProductReview"("reviewerUserId");

ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_reviewerUserId_fkey"
    FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
