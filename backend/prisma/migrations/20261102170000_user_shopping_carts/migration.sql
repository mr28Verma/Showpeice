CREATE TABLE "Cart" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CartItem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "cartId" INTEGER NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CartItem_quantity_check" CHECK ("quantity" >= 1 AND "quantity" <= 10)
);

CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");
CREATE UNIQUE INDEX "Cart_userId_id_key" ON "Cart"("userId", "id");
CREATE UNIQUE INDEX "CartItem_userId_artworkId_key" ON "CartItem"("userId", "artworkId");
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

ALTER TABLE "Cart"
    ADD CONSTRAINT "Cart_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CartItem"
    ADD CONSTRAINT "CartItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CartItem"
    ADD CONSTRAINT "CartItem_userId_cartId_fkey"
    FOREIGN KEY ("userId", "cartId") REFERENCES "Cart"("userId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CartItem"
    ADD CONSTRAINT "CartItem_artworkId_fkey"
    FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
