ALTER TABLE "User"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "medium" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "instagramUrl" TEXT,
  ADD COLUMN "websiteUrl" TEXT,
  ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publicProfileVisible" BOOLEAN NOT NULL DEFAULT true;
