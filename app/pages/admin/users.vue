<script setup lang="ts">
import type { DataTableColumn } from "~/components/app/DataTable.vue";

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

const table = useDataTable<User>("/api/admin/users", {
  perPage: 20,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "users",
});

// Roles for edit modal
const roles = ref<Role[]>([]);
const showEditModal = ref(false);
const editingUser = ref<User | null>(null);
const selectedRoles = ref<number[]>([]);
const saving = ref(false);

onMounted(async () => {
  try {
    const response = await authFetch<any>("/api/admin/roles");
    if (response.success) roles.value = response.data.roles;
  } catch (error) {
    console.error("Failed to fetch roles:", error);
  }
});

const columns: DataTableColumn[] = [
  { key: "email", label: "User", sortable: true },
  { key: "roles", label: "Roles" },
  { key: "isActive", label: "Status", sortable: true },
  { key: "lastLoginAt", label: "Last Login", sortable: true },
  { key: "createdAt", label: "Created", sortable: true },
  { key: "actions", label: "Actions" },
];

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
      table.refresh();
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
      table.refresh();
    }
  } catch (error) {
    console.error("Failed to toggle user status:", error);
  }
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
              :model-value="table.search.value"
              type="text"
              placeholder="Search by email or name..."
              @update:model-value="table.setSearch(String($event))"
            />
          </div>
          <Select
            :model-value="table.filters.value.role || 'all'"
            @update:model-value="table.setFilter('role', String($event))"
          >
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
          <Select
            :model-value="table.filters.value.status || 'all'"
            @update:model-value="table.setFilter('status', String($event))"
          >
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button
            v-if="table.hasActiveFilters.value"
            variant="outline"
            @click="table.clearFilters()"
          >
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Users Table -->
    <Card>
      <AppDataTable
        :columns="columns"
        :data="table.data.value"
        :loading="table.loading.value"
        :meta="table.meta.value"
        :sort-column="table.sortColumn.value"
        :sort-direction="table.sortDirection.value"
        status-border-key="isActive"
        empty-message="No users found"
        @sort="table.setSort"
        @page-change="table.setPage"
      >
        <template #cell-email="{ row }">
          <AppUserCell
            :name="(row as User).profile?.fullName || (row as User).email"
            :email="(row as User).email"
          />
        </template>
        <template #cell-roles="{ value }">
          <div class="flex flex-wrap gap-1">
            <Badge v-for="role in (value as string[])" :key="role" variant="secondary">
              {{ role }}
            </Badge>
          </div>
        </template>
        <template #cell-isActive="{ value }">
          <Badge :class="(value as boolean)
            ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
            : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'">
            {{ (value as boolean) ? 'Active' : 'Inactive' }}
          </Badge>
        </template>
        <template #cell-lastLoginAt="{ value }">
          <AppDateCell v-if="value" :date="(value as string)" />
          <span v-else class="text-sm text-muted-foreground">Never</span>
        </template>
        <template #cell-createdAt="{ value }">
          <AppDateCell :date="(value as string)" />
        </template>
        <template #cell-actions="{ row }">
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click.stop="openEditModal(row as User)">
              Edit Roles
            </Button>
            <Button
              variant="outline"
              size="sm"
              :class="(row as User).isActive
                ? 'text-red-600 hover:text-red-700 dark:text-red-400'
                : 'text-green-600 hover:text-green-700 dark:text-green-400'"
              @click.stop="toggleUserStatus(row as User)"
            >
              {{ (row as User).isActive ? 'Deactivate' : 'Activate' }}
            </Button>
          </div>
        </template>
      </AppDataTable>
    </Card>

    <!-- Edit Roles Modal -->
    <Dialog :open="showEditModal" @update:open="(v: boolean) => { if (!v) closeEditModal() }">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-1.5">
            Edit User Roles
            <HelpTip field-id="user.roles" />
          </DialogTitle>
          <DialogDescription>{{ editingUser?.email }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <label
            v-for="role in roles"
            :key="role.id"
            class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
          >
            <input v-model="selectedRoles" type="checkbox" :value="role.id" class="w-4 h-4" />
            <div>
              <p class="text-sm font-medium text-foreground">{{ role.name }}</p>
              <p v-if="role.description" class="text-xs text-muted-foreground">{{ role.description }}</p>
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
