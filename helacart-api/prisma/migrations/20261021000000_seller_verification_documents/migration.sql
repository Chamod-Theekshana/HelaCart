CREATE TYPE "SellerIdentityDocumentType" AS ENUM ('NATIONAL_ID', 'DRIVING_LICENCE');
CREATE TYPE "SellerDocumentKind" AS ENUM ('IDENTITY_FRONT', 'IDENTITY_BACK', 'BUSINESS_REGISTRATION');

-- Existing seller accounts remain readable; all new applications require this field in the API.
ALTER TABLE "Seller" ADD COLUMN "identityDocumentType" "SellerIdentityDocumentType";

CREATE TABLE "SellerApplicationDocument" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "kind" "SellerDocumentKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerApplicationDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SellerApplicationDocument_size_check" CHECK ("byteSize" > 0 AND "byteSize" <= 5242880),
    CONSTRAINT "SellerApplicationDocument_type_check" CHECK ("contentType" IN ('image/jpeg', 'image/png', 'image/webp'))
);

CREATE UNIQUE INDEX "SellerApplicationDocument_storageKey_key" ON "SellerApplicationDocument"("storageKey");
CREATE UNIQUE INDEX "SellerApplicationDocument_sellerId_kind_key" ON "SellerApplicationDocument"("sellerId", "kind");
ALTER TABLE "SellerApplicationDocument" ADD CONSTRAINT "SellerApplicationDocument_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
