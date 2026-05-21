-- CreateIndex
CREATE INDEX "declaration_status_history_status_created_at_idx" ON "declaration_status_history"("status", "created_at");

-- CreateIndex
CREATE INDEX "form_collections_collection_office_id_idx" ON "form_collections"("collection_office_id");
