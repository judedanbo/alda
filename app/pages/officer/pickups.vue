<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface Pickup {
  id: string;
  isSelfPickup: boolean;
  authorizedName: string;
  authorizedPhone: string | null;
  pickedUp: boolean;
  pickupDate: string | null;
  createdAt: string;
  declaration: {
    id: string;
    uniqueCode: string;
    applicant: {
      fullName: string;
      institution: { name: string } | null;
    };
    receipts: {
      receiptNumber: string;
    }[];
  };
}

const pendingPickups = ref<Pickup[]>([]);
const total = ref(0);
const loading = ref(true);
const search = ref("");
const currentPage = ref(1);
const limit = 10;

const selectedPickup = ref<Pickup | null>(null);
const showPickupModal = ref(false);
const isRecording = ref(false);
const recordError = ref("");

const fetchPendingPickups = async () => {
  loading.value = true;
  try {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String((currentPage.value - 1) * limit),
    });
    if (search.value) {
      query.set("search", search.value);
    }

    const response = await authFetch<any>(`/api/pickup/pending?${query}`);

    if (response.success) {
      pendingPickups.value = response.data.pickups as Pickup[];
      total.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch pending pickups:", error);
  } finally {
    loading.value = false;
  }
};

await fetchPendingPickups();

watch([search, currentPage], fetchPendingPickups);

const openPickupModal = (pickup: Pickup) => {
  selectedPickup.value = pickup;
  recordError.value = "";
  showPickupModal.value = true;
};

const recordPickup = async () => {
  if (!selectedPickup.value) return;

  isRecording.value = true;
  recordError.value = "";

  try {
    await authFetch(`/api/pickup/${selectedPickup.value.declaration.id}`, {
      method: "PATCH",
    });

    showPickupModal.value = false;
    selectedPickup.value = null;
    await fetchPendingPickups();
  } catch (error: any) {
    recordError.value = error.data?.statusMessage || "Failed to record pickup";
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
    <PageHeader title="Manage Pickups" description="Record receipt pickups">
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
          placeholder="Search by name or receipt number..."
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
    <Card v-else-if="pendingPickups.length === 0">
      <CardContent class="text-center py-12">
        <svg class="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
        <h3 class="text-lg font-medium text-foreground mb-2">No pending pickups</h3>
        <p class="text-muted-foreground">All receipts have been picked up.</p>
      </CardContent>
    </Card>

    <!-- Pickups Table -->
    <Card v-else>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt</TableHead>
              <TableHead>Applicant</TableHead>
              <TableHead>Authorized Person</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead class="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="pickup in pendingPickups" :key="pickup.id" class="hover:bg-muted/30">
              <TableCell>
                <span class="font-mono text-sm font-medium text-primary">{{ pickup.declaration.receipts[0]?.receiptNumber }}</span>
                <p class="text-xs text-muted-foreground">{{ pickup.declaration.uniqueCode }}</p>
              </TableCell>
              <TableCell>
                <p class="font-medium text-foreground">{{ pickup.declaration.applicant.fullName }}</p>
                <p class="text-sm text-muted-foreground">{{ pickup.declaration.applicant.institution?.name || 'N/A' }}</p>
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-2">
                  <Badge :variant="pickup.isSelfPickup ? 'default' : 'outline'">
                    {{ pickup.isSelfPickup ? 'Self' : 'Third Party' }}
                  </Badge>
                  <span class="text-sm">{{ pickup.authorizedName }}</span>
                </div>
                <p v-if="pickup.authorizedPhone" class="text-xs text-muted-foreground">{{ pickup.authorizedPhone }}</p>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">{{ formatDate(pickup.createdAt) }}</TableCell>
              <TableCell class="text-right">
                <Button size="sm" @click="openPickupModal(pickup)">
                  Record Pickup
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

    <!-- Pickup Modal -->
    <Dialog :open="showPickupModal" @update:open="showPickupModal = $event">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm Pickup</DialogTitle>
          <DialogDescription>Record that this receipt has been collected</DialogDescription>
        </DialogHeader>

        <div v-if="selectedPickup" class="space-y-4">
          <div class="bg-muted/30 rounded-lg p-4 space-y-2">
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Receipt:</span>
              <span class="font-mono font-medium">{{ selectedPickup.declaration.receipts[0]?.receiptNumber }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Applicant:</span>
              <span class="font-medium">{{ selectedPickup.declaration.applicant.fullName }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Collecting:</span>
              <span>{{ selectedPickup.authorizedName }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Type:</span>
              <Badge :variant="selectedPickup.isSelfPickup ? 'default' : 'outline'">
                {{ selectedPickup.isSelfPickup ? 'Self Pickup' : 'Third Party' }}
              </Badge>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              Please verify the identity of the person collecting the receipt before confirming.
              {{ !selectedPickup.isSelfPickup ? 'Ensure they have valid authorization from the applicant.' : '' }}
            </AlertDescription>
          </Alert>

          <Alert v-if="recordError" variant="destructive">
            <AlertDescription>{{ recordError }}</AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showPickupModal = false">Cancel</Button>
          <Button :disabled="isRecording" @click="recordPickup">
            {{ isRecording ? 'Recording...' : 'Confirm Pickup' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
