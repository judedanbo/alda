<script setup lang="ts">
import { FileText } from "lucide-vue-next";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface Declaration {
  id: string;
  uniqueCode: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  applicant: {
    fullName: string;
    ghanaCardNumber: string;
    offices: Array<{
      id: string;
      designation: string;
      startDate: string;
      endDate: string | null;
      officeCategory: { name: string } | null;
      institution: { name: string } | null;
    }>;
    user: {
      email: string;
      phone: string | null;
    };
  };
}

interface CollectionOffice {
  id: string;
  name: string;
  type: string;
  region: string | null;
}

const pendingDeclarations = ref<Declaration[]>([]);
const collectionOffices = ref<CollectionOffice[]>([]);
const total = ref(0);
const loading = ref(true);
const search = ref("");
const currentPage = ref(1);
const limit = 10;

const selectedDeclaration = ref<Declaration | null>(null);
const showRecordModal = ref(false);
const selectedOfficeId = ref("");
const recordingNotes = ref("");
const isRecording = ref(false);
const recordError = ref("");

const fetchPendingCollections = async () => {
  loading.value = true;
  try {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String((currentPage.value - 1) * limit),
    });
    if (search.value) {
      query.set("search", search.value);
    }

    const response = await authFetch<{ success: boolean; data: { declarations: Declaration[]; total: number } }>(`/api/form-collections/pending?${query}`);

    if (response.success) {
      pendingDeclarations.value = response.data.declarations;
      total.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch pending form collections:", error);
  } finally {
    loading.value = false;
  }
};

const fetchCollectionOffices = async () => {
  try {
    const response = await authFetch<{ success: boolean; data: CollectionOffice[] }>("/api/collection-offices");
    if (response.success) {
      collectionOffices.value = response.data;
    }
  } catch (error) {
    console.error("Failed to fetch collection offices:", error);
  }
};

await Promise.all([fetchPendingCollections(), fetchCollectionOffices()]);

watch([search, currentPage], fetchPendingCollections);

const openRecordModal = (declaration: Declaration) => {
  selectedDeclaration.value = declaration;
  selectedOfficeId.value = "";
  recordingNotes.value = "";
  recordError.value = "";
  showRecordModal.value = true;
};

const recordCollection = async () => {
  if (!selectedDeclaration.value || !selectedOfficeId.value) return;

  isRecording.value = true;
  recordError.value = "";

  try {
    await authFetch("/api/form-collections", {
      method: "POST",
      body: {
        declarationId: selectedDeclaration.value.id,
        collectionOfficeId: selectedOfficeId.value,
        notes: recordingNotes.value || undefined,
      },
    });

    showRecordModal.value = false;
    selectedDeclaration.value = null;
    await fetchPendingCollections();
  } catch (error: unknown) {
    const e = error as { data?: { statusMessage?: string } };
    recordError.value = e.data?.statusMessage || "Failed to record form collection";
  } finally {
    isRecording.value = false;
  }
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const totalPages = computed(() => Math.ceil(total.value / limit));
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <PageHeader title="Record Form Collections" description="Record physical declaration forms collected by applicants">
      <template #actions>
        <Button variant="ghost" as-child>
          <NuxtLink to="/officer/dashboard">Back to Dashboard</NuxtLink>
        </Button>
      </template>
    </PageHeader>

    <!-- Search -->
    <Card>
      <CardContent class="p-4">
        <Input
          v-model="search"
          type="text"
          placeholder="Search by code or applicant name..."
        />
      </CardContent>
    </Card>

    <!-- Loading -->
    <Card v-if="loading">
      <CardContent class="p-6">
        <div class="space-y-4">
          <Skeleton class="h-8 w-full" />
          <Skeleton class="h-8 w-full" />
          <Skeleton class="h-8 w-full" />
        </div>
      </CardContent>
    </Card>

    <!-- Empty State -->
    <EmptyState
      v-else-if="pendingDeclarations.length === 0"
      :icon="FileText"
      title="No pending form collections"
      description="All initiated declarations have had their forms collected."
    />

    <!-- Collections Table -->
    <Card v-else>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Applicant</TableHead>
              <TableHead>Institution</TableHead>
              <TableHead>Initiated</TableHead>
              <TableHead class="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="declaration in pendingDeclarations"
              :key="declaration.id"
              class="hover:bg-muted/30"
            >
              <TableCell>
                <span class="font-mono text-sm font-medium text-primary">
                  {{ declaration.uniqueCode }}
                </span>
              </TableCell>
              <TableCell>
                <div>
                  <p class="font-medium text-foreground">{{ declaration.applicant.fullName }}</p>
                  <p class="text-sm text-muted-foreground">{{ declaration.applicant.offices?.[0]?.designation || 'N/A' }}</p>
                </div>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ declaration.applicant.offices?.[0]?.institution?.name || 'N/A' }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatDate(declaration.createdAt) }}
              </TableCell>
              <TableCell class="text-right">
                <Button size="sm" @click="openRecordModal(declaration)">
                  Record
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <!-- Pagination -->
        <div
          v-if="totalPages > 1"
          class="flex items-center justify-between px-4 py-3 border-t"
        >
          <p class="text-sm text-muted-foreground">
            Showing {{ (currentPage - 1) * limit + 1 }} to {{ Math.min(currentPage * limit, total) }} of {{ total }}
          </p>
          <div class="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="currentPage <= 1"
              @click="currentPage--"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="currentPage >= totalPages"
              @click="currentPage++"
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Record Modal -->
    <Dialog :open="showRecordModal" @update:open="showRecordModal = $event">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Form Collection</DialogTitle>
          <DialogDescription>Confirm the applicant collected the physical form</DialogDescription>
        </DialogHeader>

        <div v-if="selectedDeclaration" class="space-y-4">
          <!-- Declaration Details -->
          <div class="bg-muted/30 rounded-lg p-4 space-y-2">
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Code:</span>
              <span class="font-mono font-medium">{{ selectedDeclaration.uniqueCode }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Applicant:</span>
              <span class="font-medium">{{ selectedDeclaration.applicant.fullName }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Ghana Card:</span>
              <span>{{ selectedDeclaration.applicant.ghanaCardNumber }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Institution:</span>
              <span>{{ selectedDeclaration.applicant.offices?.[0]?.institution?.name || 'N/A' }}</span>
            </div>
          </div>

          <!-- Collection Office (required) -->
          <div class="space-y-2">
            <Label>Collection Office <span class="text-destructive">*</span></Label>
            <Select v-model="selectedOfficeId">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select the office the form was collected from" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="office in collectionOffices"
                  :key="office.id"
                  :value="office.id"
                >
                  {{ office.name }}{{ office.region ? ` — ${office.region}` : '' }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Notes -->
          <div class="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              v-model="recordingNotes"
              rows="3"
              placeholder="Any notes about this form collection..."
            />
          </div>

          <!-- Error -->
          <Alert v-if="recordError" variant="destructive">
            <AlertDescription>{{ recordError }}</AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showRecordModal = false">Cancel</Button>
          <Button :disabled="isRecording || !selectedOfficeId" @click="recordCollection">
            {{ isRecording ? 'Recording...' : 'Confirm & Record' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
