ALTER TABLE "Seller" ADD COLUMN "shippingFeeLkrMinor" INTEGER;
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_shipping_fee_valid" CHECK ("shippingFeeLkrMinor" IS NULL OR ("shippingFeeLkrMinor" >= 0 AND "shippingFeeLkrMinor" <= 100000000));

CREATE TABLE "BuyerAddress" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "recipient" TEXT NOT NULL,
  "phone" TEXT NOT NULL, "line1" TEXT NOT NULL, "line2" TEXT,
  "city" TEXT NOT NULL, "district" TEXT NOT NULL, "postalCode" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BuyerAddress_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BuyerAddress_userId_createdAt_idx" ON "BuyerAddress"("userId", "createdAt");
ALTER TABLE "BuyerAddress" ADD CONSTRAINT "BuyerAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CartItem" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "variantId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartItem_quantity_valid" CHECK ("quantity" BETWEEN 1 AND 100)
);
CREATE UNIQUE INDEX "CartItem_userId_variantId_key" ON "CartItem"("userId", "variantId");
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "SellerOrderStatus" AS ENUM ('PLACED', 'ACCEPTED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

CREATE TABLE "Order" (
  "id" UUID NOT NULL, "buyerId" UUID NOT NULL, "addressId" UUID NOT NULL,
  "checkoutKey" TEXT NOT NULL, "snapshotHash" TEXT NOT NULL,
  "recipient" TEXT NOT NULL, "phone" TEXT NOT NULL, "line1" TEXT NOT NULL,
  "line2" TEXT, "city" TEXT NOT NULL, "district" TEXT NOT NULL, "postalCode" TEXT NOT NULL,
  "subtotalLkrMinor" INTEGER NOT NULL, "shippingLkrMinor" INTEGER NOT NULL,
  "totalLkrMinor" INTEGER NOT NULL, "paymentMethod" TEXT NOT NULL DEFAULT 'COD',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Order_amounts_valid" CHECK ("subtotalLkrMinor" >= 0 AND "shippingLkrMinor" >= 0 AND "totalLkrMinor" = "subtotalLkrMinor" + "shippingLkrMinor" AND "paymentMethod" = 'COD')
);
CREATE UNIQUE INDEX "Order_buyerId_checkoutKey_key" ON "Order"("buyerId", "checkoutKey");
CREATE INDEX "Order_buyerId_createdAt_idx" ON "Order"("buyerId", "createdAt");
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "BuyerAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SellerOrder" (
  "id" UUID NOT NULL, "orderId" UUID NOT NULL, "sellerId" UUID NOT NULL,
  "status" "SellerOrderStatus" NOT NULL DEFAULT 'PLACED',
  "subtotalLkrMinor" INTEGER NOT NULL, "shippingLkrMinor" INTEGER NOT NULL,
  "totalLkrMinor" INTEGER NOT NULL, "paymentCollectedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "SellerOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerOrder_amounts_valid" CHECK ("subtotalLkrMinor" >= 0 AND "shippingLkrMinor" >= 0 AND "totalLkrMinor" = "subtotalLkrMinor" + "shippingLkrMinor")
);
CREATE UNIQUE INDEX "SellerOrder_orderId_sellerId_key" ON "SellerOrder"("orderId", "sellerId");
CREATE INDEX "SellerOrder_sellerId_createdAt_idx" ON "SellerOrder"("sellerId", "createdAt");
ALTER TABLE "SellerOrder" ADD CONSTRAINT "SellerOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerOrder" ADD CONSTRAINT "SellerOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OrderItem" (
  "id" UUID NOT NULL, "sellerOrderId" UUID NOT NULL, "variantId" UUID NOT NULL,
  "productTitle" TEXT NOT NULL, "sku" TEXT NOT NULL, "optionValues" JSONB NOT NULL,
  "unitLkrMinor" INTEGER NOT NULL, "quantity" INTEGER NOT NULL, "lineLkrMinor" INTEGER NOT NULL,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderItem_amounts_valid" CHECK ("unitLkrMinor" > 0 AND "quantity" > 0 AND "lineLkrMinor" = "unitLkrMinor" * "quantity")
);
CREATE INDEX "OrderItem_sellerOrderId_idx" ON "OrderItem"("sellerOrderId");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SellerOrderEvent" (
  "id" UUID NOT NULL, "sellerOrderId" UUID NOT NULL, "actorUserId" UUID NOT NULL,
  "fromStatus" "SellerOrderStatus" NOT NULL, "toStatus" "SellerOrderStatus" NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerOrderEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SellerOrderEvent_sellerOrderId_createdAt_idx" ON "SellerOrderEvent"("sellerOrderId", "createdAt");
ALTER TABLE "SellerOrderEvent" ADD CONSTRAINT "SellerOrderEvent_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerOrderEvent" ADD CONSTRAINT "SellerOrderEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
