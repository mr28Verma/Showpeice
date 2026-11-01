-- Preserve existing accounts while splitting the legacy full name field.
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'buyer';

UPDATE "User"
SET "firstName" = split_part("name", ' ', 1),
    "lastName" = CASE
      WHEN position(' ' in "name") > 0 THEN substring("name" from position(' ' in "name") + 1)
      ELSE ''
    END;

ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "name";
