-- Normalize existing phone numbers to the canonical +233 form so the
-- unique constraint treats "0241234567" and "+233241234567" as one
-- value. Whitespace is stripped first.

UPDATE "users"
SET "phone" = REGEXP_REPLACE("phone", '\s+', '', 'g')
WHERE "phone" IS NOT NULL;

UPDATE "users"
SET "phone" = '+233' || SUBSTRING("phone" FROM 2)
WHERE "phone" IS NOT NULL
  AND "phone" LIKE '0%'
  AND CHAR_LENGTH("phone") = 10;

-- Unique index. PostgreSQL treats NULLs as distinct, so users without
-- a phone are unaffected. Migration will FAIL if duplicate normalized
-- phones already exist — resolve manually before re-running.
CREATE UNIQUE INDEX "users_phone_key" ON "users" ("phone");
