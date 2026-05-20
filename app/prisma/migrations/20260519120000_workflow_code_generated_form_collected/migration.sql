-- AlterEnum
-- Rename PENDING -> CODE_GENERATED (relabels existing rows in place; no data migration needed).
ALTER TYPE "declaration_status" RENAME VALUE 'PENDING' TO 'CODE_GENERATED';

-- AlterEnum
-- Add the new FORM_COLLECTED status. It is not referenced anywhere in this
-- migration, so adding it in the same transaction is safe on PostgreSQL 12+.
ALTER TYPE "declaration_status" ADD VALUE 'FORM_COLLECTED' AFTER 'CODE_GENERATED';

-- AlterTable
-- CODE_GENERATED is the renamed (pre-existing) value, so setting it as the
-- column default in this transaction is safe (RENAME VALUE has no in-tx caveat).
ALTER TABLE "declarations" ALTER COLUMN "status" SET DEFAULT 'CODE_GENERATED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'FORM_COLLECTED';
ALTER TYPE "notification_type" ADD VALUE 'FORM_RETURNED';

-- CreateEnum
CREATE TYPE "collection_office_type" AS ENUM ('HEADQUARTERS', 'REGIONAL');

-- CreateTable
CREATE TABLE "collection_offices" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "collection_office_type" NOT NULL,
    "region" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_collections" (
    "id" UUID NOT NULL,
    "declaration_id" UUID NOT NULL,
    "recorded_by" UUID NOT NULL,
    "collection_office_id" UUID NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_collections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_collections_declaration_id_idx" ON "form_collections"("declaration_id");

-- AddForeignKey
ALTER TABLE "form_collections" ADD CONSTRAINT "form_collections_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "declarations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_collections" ADD CONSTRAINT "form_collections_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_collections" ADD CONSTRAINT "form_collections_collection_office_id_fkey" FOREIGN KEY ("collection_office_id") REFERENCES "collection_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
