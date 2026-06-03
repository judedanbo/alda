<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface TbdFieldView {
  id: string;
  label: string;
  section: string;
  context: string;
  recommendation: string;
  value: string;
}

interface VersionView {
  id: string;
  versionNumber: number;
  status: string;
  createdAt: string;
  createdByEmail: string | null;
  hasPdf: boolean;
}

interface TemplateDetail {
  template: { id: string; key: string; title: string; category: string | null };
  fields: TbdFieldView[];
  versions: VersionView[];
}

const route = useRoute();
const templateId = route.params.id as string;

const detail = ref<TemplateDetail | null>(null);
const loading = ref(true);

// Create-version dialog state
const showCreate = ref(false);
const reviewing = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const status = ref<"PUBLISHED" | "DRAFT">("PUBLISHED");
const values = ref<Record<string, string>>({});
const lastResult = ref<{ versionNumber: number; url: string } | null>(null);

const fetchDetail = async (fromVersion?: number) => {
  loading.value = true;
  try {
    const qs = fromVersion ? `?fromVersion=${fromVersion}` : "";
    const response = await authFetch<{ success: boolean; data: TemplateDetail }>(
      `/api/admin/document-templates/${templateId}${qs}`,
    );
    if (response.success) detail.value = response.data;
  } catch (error) {
    console.error("Failed to fetch template:", error);
  } finally {
    loading.value = false;
  }
};

await fetchDetail();

const sections = computed(() => {
  const map = new Map<string, TbdFieldView[]>();
  for (const f of detail.value?.fields ?? []) {
    if (!map.has(f.section)) map.set(f.section, []);
    map.get(f.section)!.push(f);
  }
  return [...map.entries()];
});

const totalFields = computed(() => detail.value?.fields.length ?? 0);
const filledCount = computed(
  () => Object.values(values.value).filter((v) => v.trim() !== "").length,
);

const seedValues = (fields: TbdFieldView[]) => {
  const next: Record<string, string> = {};
  for (const f of fields) next[f.id] = f.value ?? "";
  values.value = next;
};

const openCreate = () => {
  errorMessage.value = "";
  reviewing.value = false;
  status.value = "PUBLISHED";
  lastResult.value = null;
  seedValues(detail.value?.fields ?? []);
  showCreate.value = true;
};

const prefillFrom = async (versionNumber: number) => {
  await fetchDetail(versionNumber);
  seedValues(detail.value?.fields ?? []);
};

const applyRecommendation = (field: TbdFieldView) => {
  if (field.recommendation) values.value[field.id] = field.recommendation;
};

const submitVersion = async () => {
  errorMessage.value = "";
  saving.value = true;
  try {
    const response = await authFetch<{
      success: boolean;
      data: { versionNumber: number; url: string };
    }>(`/api/admin/document-templates/${templateId}/versions`, {
      method: "POST",
      body: { fieldValues: { ...values.value }, status: status.value },
    });
    if (response.success) {
      lastResult.value = { versionNumber: response.data.versionNumber, url: response.data.url };
      showCreate.value = false;
      await fetchDetail();
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; statusMessage?: string };
    errorMessage.value = err.data?.message || err.statusMessage || "Failed to generate version";
  } finally {
    saving.value = false;
  }
};

const downloading = ref<string | null>(null);
const downloadVersion = async (version: VersionView) => {
  downloading.value = version.id;
  try {
    const response = await authFetch<{ success: boolean; data: { url: string } }>(
      `/api/admin/document-templates/${templateId}/versions/${version.id}/download`,
    );
    if (response.success) window.open(response.data.url, "_blank");
  } catch (error) {
    console.error("Failed to download version:", error);
  } finally {
    downloading.value = null;
  }
};

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="detail?.template.title ?? 'Document Template'"
      :description="detail?.template.category ?? undefined"
    >
      <template #actions>
        <Button variant="outline" @click="navigateTo('/admin/document-templates')">Back</Button>
        <Button :disabled="loading || totalFields === 0" @click="openCreate">Create version</Button>
      </template>
    </PageHeader>

    <Alert v-if="lastResult" class="border-green-300 bg-green-50 dark:bg-green-950/30">
      <AlertDescription class="flex items-center justify-between gap-4">
        <span>Version {{ lastResult.versionNumber }} generated successfully.</span>
        <a :href="lastResult.url" target="_blank" rel="noopener">
          <Button size="sm">Download PDF</Button>
        </a>
      </AlertDescription>
    </Alert>

    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 5" :key="i" class="h-12 w-full rounded-lg" />
    </div>

    <template v-else-if="detail">
      <!-- Summary -->
      <Card class="p-4 flex items-center gap-6 text-sm">
        <div>
          <span class="text-muted-foreground">TBD fields</span>
          <p class="font-medium text-foreground">{{ totalFields }}</p>
        </div>
        <div>
          <span class="text-muted-foreground">Versions</span>
          <p class="font-medium text-foreground">{{ detail.versions.length }}</p>
        </div>
      </Card>

      <!-- Versions -->
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Created</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="detail.versions.length === 0">
              <TableCell colspan="5" class="text-center py-8 text-muted-foreground">
                No versions yet. Click "Create version" to complete the TBD items and generate a PDF.
              </TableCell>
            </TableRow>
            <TableRow v-for="v in detail.versions" :key="v.id">
              <TableCell class="font-medium">v{{ v.versionNumber }}</TableCell>
              <TableCell>
                <Badge class="bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300">
                  {{ v.status }}
                </Badge>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">{{ v.createdByEmail ?? "—" }}</TableCell>
              <TableCell class="text-sm text-muted-foreground">{{ formatDateTime(v.createdAt) }}</TableCell>
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" @click="prefillFrom(v.versionNumber); openCreate()">
                    New from this
                  </Button>
                  <Button
                    size="sm"
                    :disabled="!v.hasPdf || downloading === v.id"
                    @click="downloadVersion(v)"
                  >
                    {{ downloading === v.id ? "..." : "Download" }}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </template>

    <!-- Create version dialog -->
    <Dialog :open="showCreate" @update:open="(v: boolean) => { if (!v) showCreate = false }">
      <DialogContent class="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {{ reviewing ? "Review & confirm" : "Complete the document" }}
          </DialogTitle>
          <DialogDescription>
            {{ reviewing
              ? "Confirm the values below. On confirm, a new PDF version is generated."
              : `Fill in the ${totalFields} TBD items. Leave a field blank to keep its [TBD] placeholder.` }}
          </DialogDescription>
        </DialogHeader>

        <Alert v-if="errorMessage" variant="destructive">
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <!-- Fill step -->
        <div v-if="!reviewing" class="space-y-6">
          <p class="text-sm text-muted-foreground">{{ filledCount }} of {{ totalFields }} completed</p>
          <div v-for="[section, fields] in sections" :key="section" class="space-y-4">
            <h3 class="text-sm font-semibold text-foreground border-b pb-1">{{ section }}</h3>
            <div v-for="field in fields" :key="field.id" class="space-y-1">
              <FormField v-slot="{ id }" :label="field.label">
                <Input :id="id" v-model="values[field.id]" type="text" :placeholder="field.recommendation || 'Enter value'" />
              </FormField>
              <p class="text-xs text-muted-foreground truncate" :title="field.context">{{ field.context }}</p>
              <button
                v-if="field.recommendation"
                type="button"
                class="text-xs text-primary hover:underline"
                @click="applyRecommendation(field)"
              >
                Use suggestion: {{ field.recommendation }}
              </button>
            </div>
          </div>
        </div>

        <!-- Review step -->
        <div v-else class="space-y-4">
          <div class="space-y-2">
            <Label for="version-status">Status</Label>
            <select
              id="version-status"
              v-model="status"
              class="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
          <div class="rounded-md border divide-y">
            <div
              v-for="field in detail?.fields ?? []"
              :key="field.id"
              class="flex items-start justify-between gap-4 px-3 py-2 text-sm"
            >
              <span class="text-muted-foreground">{{ field.label }}</span>
              <span class="font-medium text-right">
                {{ values[field.id]?.trim() || "[TBD] (kept)" }}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <template v-if="!reviewing">
            <Button variant="outline" @click="showCreate = false">Cancel</Button>
            <Button @click="reviewing = true">Review &amp; generate</Button>
          </template>
          <template v-else>
            <Button variant="outline" :disabled="saving" @click="reviewing = false">Back</Button>
            <Button :disabled="saving" @click="submitVersion">
              {{ saving ? "Generating..." : "Confirm & generate PDF" }}
            </Button>
          </template>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
