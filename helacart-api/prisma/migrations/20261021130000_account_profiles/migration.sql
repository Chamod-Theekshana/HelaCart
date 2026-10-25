ALTER TABLE "User"
  ADD COLUMN "phone" VARCHAR(25),
  ADD COLUMN "avatarStorageKey" TEXT,
  ADD COLUMN "avatarContentType" TEXT,
  ADD COLUMN "avatarByteSize" INTEGER,
  ADD COLUMN "photoVersion" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "User_avatarStorageKey_key" ON "User"("avatarStorageKey");

ALTER TABLE "User" ADD CONSTRAINT "User_avatar_metadata_check" CHECK (
  ("avatarStorageKey" IS NULL AND "avatarContentType" IS NULL AND "avatarByteSize" IS NULL)
  OR ("avatarStorageKey" IS NOT NULL
    AND "avatarContentType" IS NOT NULL AND "avatarByteSize" IS NOT NULL
    AND "avatarContentType" IN ('image/jpeg', 'image/png', 'image/webp')
    AND "avatarByteSize" BETWEEN 1 AND 3145728)
);
