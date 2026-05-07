-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'ON_HOLD', 'MORE_INFO_REQUIRED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'VERIFICATION_SUBMITTED';
ALTER TYPE "notification_type" ADD VALUE 'VERIFICATION_APPROVED';
ALTER TYPE "notification_type" ADD VALUE 'VERIFICATION_REJECTED';
ALTER TYPE "notification_type" ADD VALUE 'VERIFICATION_ON_HOLD';
ALTER TYPE "notification_type" ADD VALUE 'VERIFICATION_MORE_INFO_REQUIRED';

-- AlterTable
ALTER TABLE "applicant_profiles" ADD COLUMN     "verification_status" "verification_status" NOT NULL DEFAULT 'PENDING_VERIFICATION';

-- CreateTable
CREATE TABLE "applicant_verification_reviews" (
    "id" UUID NOT NULL,
    "applicant_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "status" "verification_status" NOT NULL,
    "reason" TEXT NOT NULL,
    "message_to_applicant" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicant_verification_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applicant_verification_reviews_applicant_id_idx" ON "applicant_verification_reviews"("applicant_id");

-- CreateIndex
CREATE INDEX "applicant_verification_reviews_created_at_idx" ON "applicant_verification_reviews"("created_at");

-- CreateIndex
CREATE INDEX "applicant_profiles_verification_status_idx" ON "applicant_profiles"("verification_status");

-- AddForeignKey
ALTER TABLE "applicant_verification_reviews" ADD CONSTRAINT "applicant_verification_reviews_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "applicant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_verification_reviews" ADD CONSTRAINT "applicant_verification_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
