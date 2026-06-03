-- Admin Document Templates feature.
--
-- `document_templates` stores the raw Markdown scaffolds (with `[TBD]`
-- placeholders) ingested from docs/*.md by prisma/seed-document-templates.ts.
-- `document_versions` records each admin-confirmed completion as an immutable,
-- numbered version: the entered field values, the resolved Markdown, and the
-- MinIO key of the generated PDF (presigned on read, like receipts.pdf_url).

-- CreateEnum
CREATE TYPE "document_version_status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "document_templates" (
    "id"              UUID         NOT NULL,
    "key"             VARCHAR(100) NOT NULL,
    "title"           VARCHAR(255) NOT NULL,
    "category"        VARCHAR(100),
    "source_markdown" TEXT         NOT NULL,
    "source_path"     VARCHAR(255),
    "is_active"       BOOLEAN      NOT NULL DEFAULT true,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id"              UUID                      NOT NULL,
    "template_id"     UUID                      NOT NULL,
    "version_number"  INTEGER                   NOT NULL,
    "status"          "document_version_status" NOT NULL DEFAULT 'PUBLISHED',
    "field_values"    JSONB                     NOT NULL,
    "filled_markdown" TEXT,
    "pdf_key"         TEXT,
    "created_by"      UUID                      NOT NULL,
    "created_at"      TIMESTAMP(3)              NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_key_key" ON "document_templates" ("key");

-- CreateIndex
CREATE INDEX "document_versions_template_id_idx" ON "document_versions" ("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_template_id_version_number_key"
    ON "document_versions" ("template_id", "version_number");

-- AddForeignKey
ALTER TABLE "document_versions"
    ADD CONSTRAINT "document_versions_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "document_templates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions"
    ADD CONSTRAINT "document_versions_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
