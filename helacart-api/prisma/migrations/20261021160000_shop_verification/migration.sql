-- Existing approvals do not award verification. Only a new admin decision does.
ALTER TABLE "Seller"
  ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "verifiedAt" TIMESTAMPTZ(3),
  ADD COLUMN "verificationVersion" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "Seller_verification_state_check" CHECK (
    "verificationVersion" >= 0 AND
    (("isVerified" = true AND "verifiedAt" IS NOT NULL) OR
     ("isVerified" = false AND "verifiedAt" IS NULL))
  );

CREATE TABLE "SellerVerification" (
  "id" UUID NOT NULL,
  "sellerId" UUID NOT NULL,
  "reviewerUserId" UUID NOT NULL,
  "isVerified" BOOLEAN NOT NULL,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "reason" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerVerification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerVerification_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SellerVerification_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SellerVerification_sellerId_version_key" ON "SellerVerification"("sellerId", "version");
CREATE INDEX "SellerVerification_reviewerUserId_idx" ON "SellerVerification"("reviewerUserId");
