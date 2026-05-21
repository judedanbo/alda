<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface User {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
  profile: {
    fullName: string;
    ghanaCardNumber: string;
    offices: Array<{
      designation: string;
      officeCategory: { name: string } | null;
      institution: { name: string } | null;
    }>;
  } | null;
}

interface Role {
  id: number;
  name: string;
  description: string | null;
}

const users = ref<User[]>([]);
const roles = ref<Role[]>([]);
const loading = ref(true);
const totalUsers = ref(0);
const currentPage = ref(1);
const perPage = 20;

const searchQuery = ref("");
const selectedRole = ref("");
const selectedStatus = ref("");

const showEditModal = ref(false);
const editingUser = ref<User | null>(null);
const selectedRoles = ref<number[]>([]);
const saving = ref(false);

const fetchUsers = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      limit: perPage.toString(),
      offset: ((currentPage.value - 1) * perPage).toString(),
    });

    if (searchQuery.value) params.append("search", searchQuery.value);
    if (selectedRole.value) params.append("role", selectedRole.value);
    if (selectedStatus.value) params.append("status", selectedStatus.value);

    const response = await authFetch<any>(`/api/admin/users?${params}`);

    if (response.success) {
      users.value = response.data.users;
      totalUsers.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch users:", error);
  } finally {
    loading.value = false;
  }
};

const fetchRoles = async () => {
  try {
    const response = await authFetch<any>("/api/admin/roles");

    if (response.success) {
      roles.value = response.data.roles;
    }
  } catch (error) {
    console.error("Failed to fetch roles:", error);
  }
};

await Promise.all([fetchUsers(), fetchRoles()]);

const totalPages = computed(() => Math.ceil(totalUsers.value / perPage));

const openEditModal = (user: User) => {
  editingUser.value = user;
  selectedRoles.value = roles.value
    .filter((r) => user.roles.includes(r.name))
    .map((r) => r.id);
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingUser.value = null;
  selectedRoles.value = [];
};

const saveUserRoles = async () => {
  if (!editingUser.value) return;

  saving.value = true;
  try {
    const response = await authFetch<any>(`/api/admin/users/${editingUser.value.id}/roles`, {
      method: "PUT",
      body: { roleIds: selectedRoles.value },
    });

    if (response.success) {
      await fetchUsers();
      closeEditModal();
    }
  } catch (error) {
    console.error("Failed to update user roles:", error);
  } finally {
    saving.value = false;
  }
};

const toggleUserStatus = async (user: User) => {
  try {
    const response = await authFetch<any>(`/api/admin/users/${user.id}/status`, {
      method: "PATCH",
      body: { isActive: !user.isActive },
    });

    if (response.success) {
      user.isActive = !user.isActive;
    }
  } catch (error) {
    console.error("Failed to toggle user status:", error);
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchUsers();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchUsers();
};
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="User Management" description="Manage system users and their roles" />

    <!-- Filters -->
    <Card>
      <CardContent class="pt-6">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex-1">
            <Input
              v-model="searchQuery"
              type="text"
              placeholder="Search by email or name..."
              @keyup.enter="handleSearch"
            />
          </div>
          <Select v-model="selectedRole" @update:model-value="handleSearch">
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem v-for="role in roles" :key="role.id" :value="role.name">
                {{ role.name }}
              </SelectItem>
            </SelectContent>
          </Select>
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

    <!-- Users Table -->
    <Card v-else>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="users.length === 0">
            <TableCell colspan="6" class="text-center py-8 text-muted-foreground">
              No users found
            </TableCell>
          </TableRow>
          <TableRow v-for="user in users" :key="user.id">
            <TableCell>
              <div>
                <p class="text-sm font-medium text-foreground">{{ user.email }}</p>
                <p v-if="user.profile" class="text-xs text-muted-foreground">
                  {{ user.profile.fullName }}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex flex-wrap gap-1">
                <Badge v-for="role in user.roles" :key="role" variant="secondary">
                  {{ role }}
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              <Badge :class="user.isActive
                ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'">
                {{ user.isActive ? 'Active' : 'Inactive' }}
              </Badge>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ formatDate(user.lastLoginAt) }}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ formatDate(user.createdAt) }}
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <Button variant="outline" size="sm" @click="openEditModal(user)">
                  Edit Roles
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  :class="user.isActive
                    ? 'text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                    : 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300'"
                  @click="toggleUserStatus(user)"
                >
                  {{ user.isActive ? 'Deactivate' : 'Activate' }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t">
        <p class="text-sm text-muted-foreground">
          Showing {{ (currentPage - 1) * perPage + 1 }} to {{ Math.min(currentPage * perPage, totalUsers) }} of {{ totalUsers }} users
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

    <!-- Edit Roles Modal -->
    <Dialog :open="showEditModal" @update:open="(v: boolean) => { if (!v) closeEditModal() }">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User Roles</DialogTitle>
          <DialogDescription>{{ editingUser?.email }}</DialogDescription>
        </DialogHeader>

        <div class="space-y-3">
          <label
            v-for="role in roles"
            :key="role.id"
            class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
          >
            <input
              v-model="selectedRoles"
              type="checkbox"
              :value="role.id"
              class="w-4 h-4"
            />
            <div>
              <p class="text-sm font-medium text-foreground">{{ role.name }}</p>
              <p v-if="role.description" class="text-xs text-muted-foreground">
                {{ role.description }}
              </p>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="closeEditModal">Cancel</Button>
          <Button :disabled="saving" @click="saveUserRoles">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
