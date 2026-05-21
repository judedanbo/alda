-- Step 1: Data migration — update existing rows before altering enum types
UPDATE "declarations" SET "status" = 'SUBMITTED' WHERE "status" = 'UNDER_REVIEW';
UPDATE "declaration_status_history" SET "status" = 'SUBMITTED' WHERE "status" = 'UNDER_REVIEW';
UPDATE "declarations" SET "status" = 'SEALED' WHERE "status" = 'COMPLETED';
UPDATE "declaration_status_history" SET "status" = 'SEALED' WHERE "status" = 'COMPLETED';

-- Step 2: Remove UNDER_REVIEW and COMPLETED from declaration_status enum
-- Must drop defaults before altering column type, then re-add them
ALTER TABLE "declarations" ALTER COLUMN "status" DROP DEFAULT;
CREATE TYPE "declaration_status_new" AS ENUM ('CODE_GENERATED', 'FORM_COLLECTED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SEALED');
ALTER TABLE "declarations" ALTER COLUMN "status" TYPE "declaration_status_new" USING ("status"::text::"declaration_status_new");
ALTER TABLE "declaration_status_history" ALTER COLUMN "status" TYPE "declaration_status_new" USING ("status"::text::"declaration_status_new");
DROP TYPE "declaration_status";
ALTER TYPE "declaration_status_new" RENAME TO "declaration_status";
ALTER TABLE "declarations" ALTER COLUMN "status" SET DEFAULT 'CODE_GENERATED'::"declaration_status";

-- Step 3: Update notification_type enum — remove SUBMISSION_RECORDED and PICKUP_REMINDER, add SECTION_REVIEW_COMMENTS
UPDATE "notifications" SET "type" = 'FORM_RETURNED' WHERE "type" = 'SUBMISSION_RECORDED';
DELETE FROM "notifications" WHERE "type" = 'PICKUP_REMINDER';
CREATE TYPE "notification_type_new" AS ENUM ('UNIQUE_CODE_GENERATED', 'FORM_COLLECTED', 'FORM_RETURNED', 'FORM_REISSUE_REQUESTED', 'FORM_REISSUE_APPROVED', 'FORM_REISSUE_DECLINED', 'SECTION_REVIEW_COMMENTS', 'REVIEW_APPROVED', 'REVIEW_REJECTED', 'RECEIPT_READY', 'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'VERIFICATION_SUBMITTED', 'VERIFICATION_APPROVED', 'VERIFICATION_REJECTED', 'VERIFICATION_ON_HOLD', 'VERIFICATION_MORE_INFO_REQUIRED');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "notification_type_new" USING ("type"::text::"notification_type_new");
DROP TYPE "notification_type";
ALTER TYPE "notification_type_new" RENAME TO "notification_type";

-- Step 4: Drop removed tables
DROP TABLE IF EXISTS "submissions";
DROP TABLE IF EXISTS "pickup_authorizations";

-- Step 5: Create form_section enum
CREATE TYPE "form_section" AS ENUM ('PERSONAL_PARTICULARS', 'PROPERTIES', 'EMPLOYMENT_BUSINESS', 'SECURITIES_BANK', 'ALIASES_PROPERTIES', 'LIABILITIES', 'VOLUNTARY_INFO', 'DECLARANT_CERTIFICATE');

-- Step 6: Create declaration_section_reviews table
CREATE TABLE "declaration_section_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "declaration_id" UUID NOT NULL,
    "reviewed_by" UUID NOT NULL,
    "section" "form_section" NOT NULL,
    "is_acceptable" BOOLEAN NOT NULL,
    "comments" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "declaration_section_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "declaration_section_reviews_declaration_id_idx" ON "declaration_section_reviews"("declaration_id");

ALTER TABLE "declaration_section_reviews" ADD CONSTRAINT "declaration_section_reviews_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "declarations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "declaration_section_reviews" ADD CONSTRAINT "declaration_section_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "declaration_section_reviews" ADD CONSTRAINT "declaration_section_reviews_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
