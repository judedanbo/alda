-- CreateTable
CREATE TABLE "applicant_offices" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "designation" VARCHAR(255) NOT NULL,
    "office_category_id" INTEGER NOT NULL,
    "institution_id" UUID,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicant_offices_pkey" PRIMARY KEY ("id")
);

-- Data migration: copy existing office data to new table
INSERT INTO "applicant_offices" ("id", "profile_id", "designation", "office_category_id", "institution_id", "start_date", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    "id",
    "designation",
    "office_category_id",
    "institution_id",
    "created_at",
    NOW(),
    NOW()
FROM "applicant_profiles"
WHERE "designation" IS NOT NULL AND "office_category_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "applicant_profiles" DROP CONSTRAINT IF EXISTS "applicant_profiles_institution_id_fkey";

-- DropForeignKey
ALTER TABLE "applicant_profiles" DROP CONSTRAINT IF EXISTS "applicant_profiles_office_category_id_fkey";

-- AlterTable
ALTER TABLE "applicant_profiles" DROP COLUMN "designation",
DROP COLUMN "institution_id",
DROP COLUMN "office_category_id";

-- AddForeignKey
ALTER TABLE "applicant_offices" ADD CONSTRAINT "applicant_offices_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "applicant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_offices" ADD CONSTRAINT "applicant_offices_office_category_id_fkey" FOREIGN KEY ("office_category_id") REFERENCES "public_office_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_offices" ADD CONSTRAINT "applicant_offices_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
