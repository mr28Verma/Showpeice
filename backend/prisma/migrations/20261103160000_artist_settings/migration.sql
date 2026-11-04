ALTER TABLE "User"
  ADD COLUMN "weeklyDigest" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "orderNotifications" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "publicEmailVisible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shopAnnouncement" VARCHAR(500);
