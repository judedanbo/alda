/*
  Warnings:

  - The values [VERIFICATION_SUBMITTED,VERIFICATION_APPROVED,VERIFICATION_REJECTED,VERIFICATION_ON_HOLD,VERIFICATION_MORE_INFO_REQUIRED] on the enum `notification_type` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `verification_status` on the `applicant_profiles` table. All the data in the column will be lost.
  - You are about to drop the `applicant_verification_reviews` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "notification_type_new" AS ENUM ('UNIQUE_CODE_GENERATED', 'SUBMISSION_RECORDED', 'REVIEW_APPROVED', 'REVIEW_REJECTED', 'RECEIPT_READY', 'PICKUP_REMINDER', 'PASSWORD_RESET', 'EMAIL_VERIFICATION');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "notification_type_new" USING ("type"::text::"notification_type_new");
ALTER TYPE "notification_type" RENAME TO "notification_type_old";
ALTER TYPE "notification_type_new" RENAME TO "notification_type";
DROP TYPE "public"."notification_type_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "applicant_verification_reviews" DROP CONSTRAINT "applicant_verification_reviews_applicant_id_fkey";

-- DropForeignKey
ALTER TABLE "applicant_verification_reviews" DROP CONSTRAINT "applicant_verification_reviews_reviewer_id_fkey";

-- DropIndex
DROP INDEX "applicant_profiles_verification_status_idx";

-- AlterTable
ALTER TABLE "applicant_profiles" DROP COLUMN "verification_status";

-- DropTable
DROP TABLE "applicant_verification_reviews";

-- DropEnum
DROP TYPE "verification_status";
