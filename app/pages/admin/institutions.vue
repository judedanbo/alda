<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const { getAuthHeaders } = useAuth();

interface Institution {
  id: string;
  name: string;
  type: string | null;
  isActive: boolean;
  _count: {
    applicantProfiles: number;
  };
}

const institutions = ref<Institution[]>([]);
const loading = ref(true);
const totalInstitutions = ref(0);
const currentPage = ref(1);
const perPage = 20;

const searchQuery = ref("");
const selectedStatus = ref("");

const showModal = ref(false);
const isEditing = ref(false);
const saving = ref(false);

const formData = ref({
  id: "",
  name: "",
  type: "",
  isActive: true,
});

const fetchInstitutions = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      limit: perPage.toString(),
      offset: ((currentPage.value - 1) * perPage).toString(),
    });

    if (searchQuery.value) params.append("search", searchQuery.value);
    if (selectedStatus.value) params.append("status", selectedStatus.value);

    const response = await $fetch(`/api/admin/institutions?${params}`, {
      headers: getAuthHeaders(),
    });

    if (response.success) {
      institutions.value = response.data.institutions;
      totalInstitutions.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch institutions:", error);
  } finally {
    loading.value = false;
  }
};

await fetchInstitutions();

const totalPages = computed(() => Math.ceil(totalInstitutions.value / perPage));

const openCreateModal = () => {
  isEditing.value = false;
  formData.value = { id: "", name: "", type: "", isActive: true };
  showModal.value = true;
};

const openEditModal = (institution: Institution) => {
  isEditing.value = true;
  formData.value = {
    id: institution.id,
    name: institution.name,
    type: institution.type || "",
    isActive: institution.isActive,
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  formData.value = { id: "", name: "", type: "", isActive: true };
};

const saveInstitution = async () => {
  saving.value = true;
  try {
    if (isEditing.value) {
      await $fetch(`/api/admin/institutions/${formData.value.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: {
          name: formData.value.name,
          type: formData.value.type || null,
          isActive: formData.value.isActive,
        },
      });
    } else {
      await $fetch("/api/admin/institutions", {
        method: "POST",
        headers: getAuthHeaders(),
        body: {
          name: formData.value.name,
          type: formData.value.type || null,
        },
      });
    }
    await fetchInstitutions();
    closeModal();
  } catch (error) {
    console.error("Failed to save institution:", error);
  } finally {
    saving.value = false;
  }
};

const toggleStatus = async (institution: Institution) => {
  try {
    await $fetch(`/api/admin/institutions/${institution.id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: {
        name: institution.name,
        type: institution.type,
        isActive: !institution.isActive,
      },
    });
    institution.isActive = !institution.isActive;
  } catch (error) {
    console.error("Failed to toggle institution status:", error);
  }
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchInstitutions();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchInstitutions();
};

const institutionTypes = [
  "Ministry",
  "Department",
  "Agency",
  "Commission",
  "Authority",
  "Corporation",
  "University",
  "Hospital",
  "District Assembly",
  "Metropolitan Assembly",
  "Municipal Assembly",
  "Other",
];
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Institutions" description="Manage registered institutions">
      <template #actions>
        <Button @click="openCreateModal">Add Institution</Button>
      </template>
    </PageHeader>

    <!-- Filters -->
    <Card>
      <CardContent class="pt-6">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex-1">
            <Input
              v-model="searchQuery"
              type="text"
              placeholder="Search institutions..."
              @keyup.enter="handleSearch"
            />
          </div>
          <Select v-model="selectedStatus" @update:model-value="handleSearch">
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button @click="handleSearch">Search</Button>
        </div>
      </CardContent>
    </Card>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 5" :key="i" class="h-12 w-full rounded-lg" />
    </div>

    <!-- Institutions Table -->
    <Card v-else>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Applicants</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="institutions.length === 0">
            <TableCell colspan="5" class="text-center py-8 text-muted-foreground">
              No institutions found
            </TableCell>
          </TableRow>
          <TableRow v-for="institution in institutions" :key="institution.id">
            <TableCell>
              <p class="text-sm font-medium text-foreground">{{ institution.name }}</p>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ institution.type || '-' }}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ institution._count.applicantProfiles }}
            </TableCell>
            <TableCell>
              <Badge :class="institution.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
                {{ institution.isActive ? 'Active' : 'Inactive' }}
              </Badge>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <Button variant="outline" size="sm" @click="openEditModal(institution)">
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  :class="institution.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'"
                  @click="toggleStatus(institution)"
                >
                  {{ institution.isActive ? 'Deactivate' : 'Activate' }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t">
        <p class="text-sm text-muted-foreground">
          Showing {{ (currentPage - 1) * perPage + 1 }} to {{ Math.min(currentPage * perPage, totalInstitutions) }} of {{ totalInstitutions }} institutions
        </p>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === 1"
            @click="handlePageChange(currentPage - 1)"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === totalPages"
            @click="handlePageChange(currentPage + 1)"
          >
            Next
          </Button>
        </div>
      </div>
    </Card>

    <!-- Create/Edit Modal -->
    <Dialog :open="showModal" @update:open="(v: boolean) => { if (!v) closeModal() }">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? 'Edit Institution' : 'Add Institution' }}</DialogTitle>
        </DialogHeader>

        <div class="space-y-4">
          <div>
            <Label for="inst-name">
              Name <span class="text-red-500">*</span>
            </Label>
            <Input
              id="inst-name"
              v-model="formData.name"
              type="text"
              placeholder="Institution name"
              class="mt-1"
            />
          </div>

          <div>
            <Label for="inst-type">Type</Label>
            <Select v-model="formData.type">
              <SelectTrigger class="mt-1">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Select type</SelectItem>
                <SelectItem v-for="type in institutionTypes" :key="type" :value="type">
                  {{ type }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="isEditing" class="flex items-center gap-2">
            <input
              v-model="formData.isActive"
              type="checkbox"
              id="isActive"
              class="w-4 h-4"
            />
            <Label for="isActive">Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="closeModal">Cancel</Button>
          <Button :disabled="saving || !formData.name" @click="saveInstitution">
            {{ saving ? 'Saving...' : (isEditing ? 'Update' : 'Create') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
