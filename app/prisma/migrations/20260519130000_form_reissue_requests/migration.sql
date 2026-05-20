-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
-- These values are not referenced anywhere in this migration, so
-- adding them in the same transaction is safe on PostgreSQL 12+.


ALTER TYPE "notification_type" ADD VALUE 'FORM_REISSUE_REQUESTED';
ALTER TYPE "notification_type" ADD VALUE 'FORM_REISSUE_APPROVED';
ALTER TYPE "notification_type" ADD VALUE 'FORM_REISSUE_DECLINED';

-- CreateEnum
CREATE TYPE "form_reissue_status" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "reissue_approver_type" AS ENUM ('AUDITOR_GENERAL', 'REGIONAL_AUDITOR');

-- CreateTable
CREATE TABLE "form_reissue_requests" (
    "id" UUID NOT NULL,
    "declaration_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "status" "form_reissue_status" NOT NULL DEFAULT 'PENDING',
    "applicant_note" TEXT,
    "reviewed_by_id" UUID,
    "approver_type" "reissue_approver_type",
    "approver_detail" VARCHAR(255),
    "letter_scan_url" TEXT,
    "decision_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_reissue_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_reissue_requests_declaration_id_idx" ON "form_reissue_requests"("declaration_id");

-- CreateIndex
CREATE INDEX "form_reissue_requests_status_idx" ON "form_reissue_requests"("status");

-- AddForeignKey
ALTER TABLE "form_reissue_requests" ADD CONSTRAINT "form_reissue_requests_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "declarations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_reissue_requests" ADD CONSTRAINT "form_reissue_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_reissue_requests" ADD CONSTRAINT "form_reissue_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
