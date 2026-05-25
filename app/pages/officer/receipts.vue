<script setup lang="ts">
import { Receipt } from "lucide-vue-next";
import { displayId, type IdType } from "~/utils/displayId";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface Declaration {
  id: string;
  uniqueCode: string;
  status: string;
  submittedAt: string | null;
  applicant: {
    fullName: string;
    idType: IdType;
    ghanaCardNumber: string | null;
    alternateIdNumber: string | null;
    offices: Array<{
      id: string;
      designation: string;
      startDate: string;
      endDate: string | null;
      officeCategory: { name: string } | null;
      institution: { name: string } | null;
    }>;
  };
  reviews: {
    reviewDate: string;
    reviewer: { email: string };
  }[];
}

const pendingDeclarations = ref<Declaration[]>([]);
const total = ref(0);
const loading = ref(true);
const currentPage = ref(1);
const limit = 10;

const selectedDeclaration = ref<Declaration | null>(null);
const isGenerating = ref(false);
const generateError = ref("");
const showGenerateModal = ref(false);

const fetchPendingReceipts = async () => {
  loading.value = true;
  try {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String((currentPage.value - 1) * limit),
    });

    const response = await authFetch<{ success: boolean; data: { declarations: Declaration[]; total: number } }>(`/api/receipts/pending?${query}`);

    if (response.success) {
      pendingDeclarations.value = response.data.declarations;
      total.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch pending receipts:", error);
  } finally {
    loading.value = false;
  }
};

await fetchPendingReceipts();

watch(currentPage, fetchPendingReceipts);

const openGenerateModal = (declaration: Declaration) => {
  selectedDeclaration.value = declaration;
  generateError.value = "";
  showGenerateModal.value = true;
};

const generateReceipt = async () => {
  if (!selectedDeclaration.value) return;

  isGenerating.value = true;
  generateError.value = "";

  try {
    const response = await authFetch<{ success: boolean; data: { receipt: { pdfUrl: string | null } } }>(`/api/receipts/${selectedDeclaration.value.id}`, {
      method: "POST",
    });

    if (response.success && response.data.receipt.pdfUrl) {
      window.open(response.data.receipt.pdfUrl, "_blank");
    }

    showGenerateModal.value = false;
    selectedDeclaration.value = null;
    await fetchPendingReceipts();
  } catch (error: unknown) {
    const e = error as { data?: { statusMessage?: string } };
    generateError.value = e.data?.statusMessage || "Failed to generate receipt";
  } finally {
    isGenerating.value = false;
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
    <PageHeader title="Generate Receipts" description="Generate receipts for approved declarations">
      <template #actions>
        <Button variant="ghost" as-child>
          <NuxtLink to="/officer/dashboard">Back to Dashboard</NuxtLink>
        </Button>
      </template>
    </PageHeader>

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
      :icon="Receipt"
      title="No pending receipts"
      description="All approved declarations have receipts generated."
    />

    <!-- Table -->
    <Card v-else>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Applicant</TableHead>
              <TableHead>Institution</TableHead>
              <TableHead>Approved</TableHead>
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
                <span class="font-mono text-sm font-medium text-primary">{{ declaration.uniqueCode }}</span>
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
                {{ declaration.reviews[0] ? formatDate(declaration.reviews[0].reviewDate) : 'N/A' }}
              </TableCell>
              <TableCell class="text-right">
                <Button size="sm" variant="secondary" @click="openGenerateModal(declaration)">
                  Generate
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t">
          <p class="text-sm text-muted-foreground">
            Showing {{ (currentPage - 1) * limit + 1 }} to {{ Math.min(currentPage * limit, total) }} of {{ total }}
          </p>
          <div class="flex gap-2">
            <Button variant="outline" size="sm" :disabled="currentPage <= 1" @click="currentPage--">
              Previous
            </Button>
            <Button variant="outline" size="sm" :disabled="currentPage >= totalPages" @click="currentPage++">
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Generate Modal -->
    <Dialog :open="showGenerateModal" @update:open="showGenerateModal = $event">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Receipt</DialogTitle>
          <DialogDescription>Generate official receipt for this declaration</DialogDescription>
        </DialogHeader>

        <div v-if="selectedDeclaration" class="space-y-4">
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
              <span class="text-sm text-muted-foreground">{{ displayId(selectedDeclaration.applicant).label }}:</span>
              <span>{{ displayId(selectedDeclaration.applicant).value }}</span>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              This will generate an official PDF receipt and notify the applicant via email and SMS.
            </AlertDescription>
          </Alert>

          <Alert v-if="generateError" variant="destructive">
            <AlertDescription>{{ generateError }}</AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showGenerateModal = false">Cancel</Button>
          <Button :disabled="isGenerating" @click="generateReceipt">
            {{ isGenerating ? 'Generating...' : 'Generate Receipt' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
