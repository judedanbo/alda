<script setup lang="ts">
import { FileText, Trash2, Download } from "lucide-vue-next";

interface VerificationDocument {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  note: string | null;
  createdAt: string;
  url: string;
}

const { toast } = useToast();

const documents = ref<VerificationDocument[]>([]);
const loading = ref(true);
const uploading = ref(false);
const note = ref("");
const uploadError = ref("");

const MAX_DOCUMENTS = 10;
const atLimit = computed(() => documents.value.length >= MAX_DOCUMENTS);

async function fetchDocuments() {
  loading.value = true;
  try {
    const res = await authFetch<{ data: VerificationDocument[] }>(
      "/api/applicant/verification/documents",
    );
    documents.value = res.data;
  } catch {
    // List simply stays empty; upload still works.
  } finally {
    loading.value = false;
  }
}

async function onFileSelected(file: File) {
  uploadError.value = "";
  if (atLimit.value) {
    uploadError.value = `You can attach at most ${MAX_DOCUMENTS} documents.`;
    return;
  }

  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (note.value.trim()) formData.append("note", note.value.trim());

    const res = await authFetch<{ data: VerificationDocument }>(
      "/api/applicant/verification/documents",
      { method: "POST", body: formData },
    );
    documents.value = [res.data, ...documents.value];
    note.value = "";
    toast.success("Document uploaded.");
  } catch (e: unknown) {
    uploadError.value = "";
    toast.fromError(e, "Failed to upload document");
  } finally {
    uploading.value = false;
  }
}

async function removeDocument(doc: VerificationDocument) {
  try {
    await authFetch(`/api/applicant/verification/documents/${doc.id}`, {
      method: "DELETE",
    });
    documents.value = documents.value.filter((d) => d.id !== doc.id);
    toast.success("Document removed.");
  } catch (e: unknown) {
    toast.fromError(e, "Failed to remove document");
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

onMounted(fetchDocuments);
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="text-sm font-medium">Upload supporting documents</p>
      <p class="text-xs text-muted-foreground mt-0.5">
        Attach the documents the legal office asked for (PDF or image, up to 10 MB
        each), then resubmit your profile for review.
      </p>
    </div>

    <!-- Existing documents -->
    <ul v-if="documents.length" class="space-y-2">
      <li
        v-for="doc in documents"
        :key="doc.id"
        class="flex items-start gap-3 rounded-lg border bg-card p-3"
      >
        <FileText class="w-5 h-5 flex-shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ doc.fileName }}</p>
          <p class="text-xs text-muted-foreground">
            {{ formatBytes(doc.size) }} · {{ formatDate(doc.createdAt) }}
          </p>
          <p v-if="doc.note" class="text-xs text-muted-foreground mt-1 italic">
            {{ doc.note }}
          </p>
        </div>
        <a
          :href="doc.url"
          target="_blank"
          rel="noopener"
          class="text-muted-foreground hover:text-foreground"
          :aria-label="`Download ${doc.fileName}`"
          title="Download"
        >
          <Download class="w-4 h-4" aria-hidden="true" />
        </a>
        <button
          type="button"
          class="text-muted-foreground hover:text-destructive"
          :aria-label="`Remove ${doc.fileName}`"
          title="Remove"
          @click="removeDocument(doc)"
        >
          <Trash2 class="w-4 h-4" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <p v-else-if="!loading" class="text-xs text-muted-foreground">
      No documents uploaded yet.
    </p>

    <!-- Upload controls -->
    <div v-if="!atLimit" class="space-y-2">
      <Textarea
        v-model="note"
        :rows="2"
        :disabled="uploading"
        placeholder="Optional note describing this document…"
        aria-label="Note describing the document"
      />
      <AppFileUploadDropzone
        label="Add a document"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        :uploading="uploading"
        :error="uploadError"
        placeholder-text="Click, press Enter, or drop a PDF or image to upload."
        @file-selected="onFileSelected"
      />
    </div>
    <p v-else class="text-xs text-muted-foreground">
      You have reached the maximum of {{ MAX_DOCUMENTS }} documents.
    </p>
  </div>
</template>
