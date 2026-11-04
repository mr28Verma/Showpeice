CREATE TABLE "Favorite" (
    "userId" INTEGER NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId", "artworkId")
);

CREATE INDEX "Favorite_artworkId_createdAt_idx" ON "Favorite"("artworkId", "createdAt");

ALTER TABLE "Favorite"
    ADD CONSTRAINT "Favorite_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Favorite"
    ADD CONSTRAINT "Favorite_artworkId_fkey"
    FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
