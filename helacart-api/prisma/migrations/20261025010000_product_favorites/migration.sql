CREATE TABLE "ProductFavorite" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "productId" UUID,
    "titleSnapshot" TEXT NOT NULL,
    "sellerNameSnapshot" TEXT NOT NULL,
    "imageUrlSnapshot" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductFavorite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductFavorite_userId_productId_key" ON "ProductFavorite"("userId", "productId");
CREATE INDEX "ProductFavorite_userId_createdAt_id_idx" ON "ProductFavorite"("userId", "createdAt", "id");
CREATE INDEX "ProductFavorite_productId_idx" ON "ProductFavorite"("productId");
ALTER TABLE "ProductFavorite" ADD CONSTRAINT "ProductFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFavorite" ADD CONSTRAINT "ProductFavorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
