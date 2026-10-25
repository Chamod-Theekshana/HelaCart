-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SellerMemberRole" AS ENUM ('OWNER', 'MANAGER');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seller" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "SellerStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerMember" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "role" "SellerMemberRole" NOT NULL DEFAULT 'MANAGER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_slug_key" ON "Seller"("slug");

-- CreateIndex
CREATE INDEX "Seller_status_idx" ON "Seller"("status");

-- CreateIndex
CREATE INDEX "SellerMember_userId_idx" ON "SellerMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerMember_sellerId_userId_key" ON "SellerMember"("sellerId", "userId");

-- AddForeignKey
ALTER TABLE "SellerMember" ADD CONSTRAINT "SellerMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerMember" ADD CONSTRAINT "SellerMember_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
