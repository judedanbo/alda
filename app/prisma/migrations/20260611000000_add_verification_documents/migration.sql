-- CreateTable
CREATE TABLE "verification_documents" (
    "id" UUID NOT NULL,
    "applicant_id" UUID NOT NULL,
    "review_id" UUID,
    "uploaded_by_id" UUID NOT NULL,
    "document_key" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_documents_applicant_id_created_at_idx" ON "verification_documents"("applicant_id", "created_at");

-- CreateIndex
CREATE INDEX "verification_documents_review_id_idx" ON "verification_documents"("review_id");

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "applicant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "applicant_verification_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
