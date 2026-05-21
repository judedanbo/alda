<script setup lang="ts">
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
  formCollections: Array<{
    id: string;
    collectedAt: string;
    collectionOffice: { name: string; region: string | null } | null;
  }>;
}

const pendingDeclarations = ref<Declaration[]>([]);
const total = ref(0);
const loading = ref(true);
const search = ref("");
const currentPage = ref(1);
const limit = 10;

interface Office {
  id: string;
  name: string;
  type: string;
  region: string | null;
}

const selectedDeclaration = ref<Declaration | null>(null);
const showRecordModal = ref(false);
const returnOfficeId = ref("");
const recordingNotes = ref("");
const isRecording = ref(false);
const recordError = ref("");

const { data: officesResponse } = await useAsyncData(
  "collection-offices",
  () => authFetch<{ data: Office[] }>("/api/collection-offices"),
);
const offices = computed(() => officesResponse.value?.data ?? []);

const fetchPendingReturns = async () => {
  loading.value = true;
  try {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String((currentPage.value - 1) * limit),
    });
    if (search.value) {
      query.set("search", search.value);
    }

    const response = await authFetch<any>(`/api/form-returns/pending?${query}`);

    if (response.success) {
      pendingDeclarations.value = response.data.declarations as Declaration[];
      total.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch pending form returns:", error);
  } finally {
    loading.value = false;
  }
};

await fetchPendingReturns();

watch([search, currentPage], fetchPendingReturns);

const openRecordModal = (declaration: Declaration) => {
  selectedDeclaration.value = declaration;
  returnOfficeId.value = "";
  recordingNotes.value = "";
  recordError.value = "";
  showRecordModal.value = true;
};

const recordReturn = async () => {
  if (!selectedDeclaration.value) return;

  isRecording.value = true;
  recordError.value = "";

  try {
    await authFetch("/api/form-returns", {
      method: "POST",
      body: {
        declarationId: selectedDeclaration.value.id,
        returnOfficeId: returnOfficeId.value,
        notes: recordingNotes.value || undefined,
      },
    });

    showRecordModal.value = false;
    selectedDeclaration.value = null;
    await fetchPendingReturns();
  } catch (error: any) {
    recordError.value = error.data?.statusMessage || "Failed to record form return";
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
    <PageHeader title="Record Form Returns" description="Record completed forms returned by applicants">
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
    <Card v-else-if="pendingDeclarations.length === 0">
      <CardContent class="text-center py-12">
        <svg class="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="text-lg font-medium text-foreground mb-2">No pending form returns</h3>
        <p class="text-muted-foreground">
          All collected forms have been returned and submitted.
        </p>
      </CardContent>
    </Card>

    <!-- Returns Table -->
    <Card v-else>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Applicant</TableHead>
              <TableHead>Collected From</TableHead>
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
                {{ declaration.formCollections?.[0]?.collectionOffice?.name || 'N/A' }}
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
          <DialogTitle>Record Form Return</DialogTitle>
          <DialogDescription>Confirm the applicant filled and returned the form</DialogDescription>
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
              <span class="text-sm text-muted-foreground">Collected From:</span>
              <span>{{ selectedDeclaration.formCollections?.[0]?.collectionOffice?.name || 'N/A' }}</span>
            </div>
          </div>

          <!-- Return Office -->
          <div class="space-y-2">
            <Label>Returned To Office <span class="text-destructive">*</span></Label>
            <Select v-model="returnOfficeId">
              <SelectTrigger>
                <SelectValue placeholder="Select office..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="office in offices"
                  :key="office.id"
                  :value="office.id"
                >
                  {{ office.name }}
                  <span v-if="office.region" class="text-muted-foreground"> — {{ office.region }}</span>
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
              placeholder="Any notes about this returned form..."
            />
          </div>

          <!-- Error -->
          <Alert v-if="recordError" variant="destructive">
            <AlertDescription>{{ recordError }}</AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showRecordModal = false">Cancel</Button>
          <Button :disabled="isRecording || !returnOfficeId" @click="recordReturn">
            {{ isRecording ? 'Recording...' : 'Confirm & Record' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
