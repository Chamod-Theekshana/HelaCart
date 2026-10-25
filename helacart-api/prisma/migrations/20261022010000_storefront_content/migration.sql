ALTER TABLE "Category"
  ADD COLUMN "description" VARCHAR(500),
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "imageStorageKey" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "Category_revision_check" CHECK ("revision" >= 0),
  ADD CONSTRAINT "Category_image_pair_check" CHECK (("imageUrl" IS NULL) = ("imageStorageKey" IS NULL));
CREATE UNIQUE INDEX "Category_imageStorageKey_key" ON "Category"("imageStorageKey");

CREATE TABLE "StorefrontAppearance" (
  "id" TEXT NOT NULL DEFAULT 'home',
  "draft" JSONB NOT NULL,
  "published" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "publishedAt" TIMESTAMPTZ(3),
  "publishedByUserId" UUID,
  CONSTRAINT "StorefrontAppearance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontAppearance_singleton_check" CHECK ("id" = 'home'),
  CONSTRAINT "StorefrontAppearance_publisher_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
