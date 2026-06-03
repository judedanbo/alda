<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface LatestVersion {
  versionNumber: number;
  status: string;
  createdAt: string;
}

interface TemplateRow {
  id: string;
  key: string;
  title: string;
  category: string | null;
  updatedAt: string;
  versionCount: number;
  latestVersion: LatestVersion | null;
}

const templates = ref<TemplateRow[]>([]);
const loading = ref(true);
const search = ref("");

const fetchTemplates = async () => {
  loading.value = true;
  try {
    const response = await authFetch<{ success: boolean; data: { templates: TemplateRow[] } }>(
      "/api/admin/document-templates",
    );
    if (response.success) templates.value = response.data.templates;
  } catch (error) {
    console.error("Failed to fetch document templates:", error);
  } finally {
    loading.value = false;
  }
};

await fetchTemplates();

const grouped = computed(() => {
  const term = search.value.trim().toLowerCase();
  const filtered = term
    ? templates.value.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          (t.category ?? "").toLowerCase().includes(term),
      )
    : templates.value;
  const map = new Map<string, TemplateRow[]>();
  for (const t of filtered) {
    const cat = t.category ?? "Other";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(t);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
});

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Document Templates"
      description="Complete the TBD items in governance documents and generate versioned, branded PDFs"
    />

    <Card class="p-4">
      <Input v-model="search" type="search" placeholder="Search by title or category..." class="max-w-sm" />
    </Card>

    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 6" :key="i" class="h-12 w-full rounded-lg" />
    </div>

    <div v-else-if="grouped.length === 0" class="text-center py-12 text-muted-foreground">
      No document templates found.
    </div>

    <div v-else class="space-y-8">
      <div v-for="[category, rows] in grouped" :key="category" class="space-y-3">
        <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {{ category }}
        </h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Versions</TableHead>
                <TableHead>Latest</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="t in rows" :key="t.id">
                <TableCell>
                  <p class="text-sm font-medium text-foreground">{{ t.title }}</p>
                  <p class="text-xs text-muted-foreground">{{ t.key }}</p>
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">{{ t.versionCount }}</TableCell>
                <TableCell>
                  <span v-if="t.latestVersion" class="text-sm">
                    v{{ t.latestVersion.versionNumber }}
                    <Badge class="ml-1 bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300">
                      {{ t.latestVersion.status }}
                    </Badge>
                  </span>
                  <span v-else class="text-sm text-muted-foreground">—</span>
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">{{ formatDate(t.updatedAt) }}</TableCell>
                <TableCell class="text-right">
                  <Button variant="outline" size="sm" @click="navigateTo(`/admin/document-templates/${t.id}`)">
                    Manage
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  </div>
</template>
