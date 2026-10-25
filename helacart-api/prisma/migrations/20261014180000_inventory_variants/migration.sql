CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'COMMITTED', 'EXPIRED');

CREATE TABLE "ProductVariant" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "optionValues" JSONB NOT NULL DEFAULT '{}',
    "priceLkrMinor" INTEGER NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductVariant_stock_valid" CHECK ("onHand" >= 0 AND "onHand" <= 1000000000 AND "reserved" >= 0 AND "reserved" <= "onHand"),
    CONSTRAINT "ProductVariant_price_positive" CHECK ("priceLkrMinor" > 0),
    CONSTRAINT "ProductVariant_position_nonnegative" CHECK ("position" >= 0)
);

CREATE UNIQUE INDEX "ProductVariant_sellerId_sku_key" ON "ProductVariant"("sellerId", "sku");
CREATE UNIQUE INDEX "ProductVariant_productId_position_key" ON "ProductVariant"("productId", "position");
CREATE INDEX "ProductVariant_sellerId_productId_idx" ON "ProductVariant"("sellerId", "productId");

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing listings retain their SKU and price; stock starts at zero until the seller counts it.
INSERT INTO "ProductVariant" ("id", "productId", "sellerId", "position", "sku", "priceLkrMinor", "updatedAt")
SELECT gen_random_uuid(), "id", "sellerId", 0, "sku", "priceLkrMinor", CURRENT_TIMESTAMP FROM "Product";

CREATE TABLE "InventoryMovement" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "actorUserId" UUID,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryMovement_delta_nonzero" CHECK ("delta" <> 0)
);
CREATE INDEX "InventoryMovement_variantId_createdAt_idx" ON "InventoryMovement"("variantId", "createdAt");
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InventoryReservation" (
    "id" UUID NOT NULL,
    "requestKey" TEXT NOT NULL,
    "variantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryReservation_quantity_positive" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "InventoryReservation_requestKey_key" ON "InventoryReservation"("requestKey");
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status", "expiresAt");
CREATE INDEX "InventoryReservation_variantId_status_idx" ON "InventoryReservation"("variantId", "status");
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
