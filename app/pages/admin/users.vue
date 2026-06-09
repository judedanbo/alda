<script setup lang="ts">
import type { DataTableColumn } from "~/components/app/DataTable.vue";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface CollectionOffice {
  id: string;
  name: string;
  type: string;
  region: string;
  isActive?: boolean;
}

interface User {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  isActive: boolean;
  activated: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
  collectionOffices: CollectionOffice[];
  profile: {
    fullName: string;
    idType: import("~/utils/displayId").IdType;
    ghanaCardNumber: string | null;
    alternateIdNumber: string | null;
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

// Roles admins are not allowed to create (applicants self-register).
const CREATE_EXCLUDED_ROLES = ["applicant"];

const table = useDataTable<User>("/api/admin/users", {
  perPage: 20,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "users",
});

// Roles + offices reference data (loaded once on mount).
const roles = ref<Role[]>([]);
const offices = ref<CollectionOffice[]>([]);

// Page-level feedback via the app-wide toast system.
const { toast } = useToast();

const flash = (message: string, kind: "success" | "error" = "success") => {
  if (kind === "error") toast.error(message);
  else toast.success(message);
};

// Roles selectable in the CREATE modal (applicant excluded).
const creatableRoles = computed(() =>
  roles.value.filter((r) => !CREATE_EXCLUDED_ROLES.includes(r.name)),
);

onMounted(async () => {
  try {
    const [rolesRes, officesRes] = await Promise.all([
      authFetch<{ success: boolean; data: { roles: Role[] } }>("/api/admin/roles"),
      authFetch<{ success: boolean; data: CollectionOffice[] }>("/api/collection-offices"),
    ]);
    if (rolesRes.success) roles.value = rolesRes.data.roles;
    if (officesRes.success) offices.value = officesRes.data;
  } catch (error) {
    console.error("Failed to fetch reference data:", error);
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

// ---------------------------------------------------------------------------
// Create user modal
// ---------------------------------------------------------------------------
const showCreateModal = ref(false);
const creating = ref(false);
const createForm = ref<{
  email: string;
  phone: string;
  roleNames: string[];
  collectionOfficeIds: string[];
}>({ email: "", phone: "", roleNames: [], collectionOfficeIds: [] });
const createErrors = ref<{ email: string; phone: string; roles: string; offices: string }>({
  email: "",
  phone: "",
  roles: "",
  offices: "",
});

const createNeedsOffice = computed(() =>
  createForm.value.roleNames.includes("schedule_officer"),
);

const openCreateModal = () => {
  createForm.value = { email: "", phone: "", roleNames: [], collectionOfficeIds: [] };
  createErrors.value = { email: "", phone: "", roles: "", offices: "" };
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  showCreateModal.value = false;
};

const toggleCreateRole = (roleName: string, checked: boolean) => {
  if (checked) {
    if (!createForm.value.roleNames.includes(roleName)) {
      createForm.value.roleNames.push(roleName);
    }
  } else {
    createForm.value.roleNames = createForm.value.roleNames.filter((r) => r !== roleName);
    // Drop office selection when schedule_officer is unchecked.
    if (roleName === "schedule_officer") {
      createForm.value.collectionOfficeIds = [];
      createErrors.value.offices = "";
    }
  }
};

const toggleCreateOffice = (officeId: string, checked: boolean) => {
  if (checked) {
    if (!createForm.value.collectionOfficeIds.includes(officeId)) {
      createForm.value.collectionOfficeIds.push(officeId);
    }
  } else {
    createForm.value.collectionOfficeIds = createForm.value.collectionOfficeIds.filter(
      (id) => id !== officeId,
    );
  }
};

const submitCreate = async () => {
  createErrors.value = { email: "", phone: "", roles: "", offices: "" };

  if (!createForm.value.email.trim()) {
    createErrors.value.email = "Email is required";
    return;
  }
  if (createForm.value.roleNames.length === 0) {
    createErrors.value.roles = "Select at least one role";
    return;
  }
  if (createNeedsOffice.value && createForm.value.collectionOfficeIds.length === 0) {
    createErrors.value.offices = "Select at least one collection office for a schedule officer";
    return;
  }

  creating.value = true;
  try {
    const response = await authFetch<{ success: boolean; inviteEmailSent?: boolean; message?: string }>("/api/admin/users", {
      method: "POST",
      body: {
        email: createForm.value.email.trim(),
        phone: createForm.value.phone.trim() || undefined,
        roleNames: createForm.value.roleNames,
        // Offices only meaningful for schedule_officer.
        collectionOfficeIds: createNeedsOffice.value
          ? createForm.value.collectionOfficeIds
          : [],
      },
    });
    if (response.success) {
      if (response.inviteEmailSent === false) {
        flash(response.message ?? `User created, but the invitation email to ${createForm.value.email.trim()} could not be sent.`, "error");
      } else {
        flash(`Invitation sent to ${createForm.value.email.trim()}`);
      }
      closeCreateModal();
      table.refresh();
    }
  } catch (error: unknown) {
    const err = error as {
      statusCode?: number;
      status?: number;
      data?: {
        message?: string;
        data?: { fieldErrors?: { phone?: string[] } };
        fieldErrors?: { phone?: string[] };
      };
      message?: string;
    };
    const code = err.statusCode ?? err.status;
    const phoneError =
      err.data?.data?.fieldErrors?.phone?.[0] ?? err.data?.fieldErrors?.phone?.[0];
    if (code === 409 && phoneError) {
      createErrors.value.phone = phoneError;
    } else if (code === 409) {
      createErrors.value.email =
        err.data?.message ?? err.message ?? "An account with this email already exists";
    } else {
      createErrors.value.email = err.data?.message ?? err.message ?? "Failed to create user";
    }
  } finally {
    creating.value = false;
  }
};

// ---------------------------------------------------------------------------
// Edit modal (roles + offices)
// ---------------------------------------------------------------------------
const showEditModal = ref(false);
const editingUser = ref<User | null>(null);
const selectedRoles = ref<number[]>([]);
const selectedOffices = ref<string[]>([]);
const savingRoles = ref(false);
const savingOffices = ref(false);

const editHasOfficerRole = computed(() => {
  const officerRole = roles.value.find((r) => r.name === "schedule_officer");
  return officerRole ? selectedRoles.value.includes(officerRole.id) : false;
});

const openEditModal = (user: User) => {
  editingUser.value = user;
  selectedRoles.value = roles.value
    .filter((r) => user.roles.includes(r.name))
    .map((r) => r.id);
  selectedOffices.value = user.collectionOffices.map((o) => o.id);
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingUser.value = null;
  selectedRoles.value = [];
  selectedOffices.value = [];
};

const toggleRole = (roleId: number, checked: boolean) => {
  if (checked) {
    if (!selectedRoles.value.includes(roleId)) selectedRoles.value.push(roleId);
  } else {
    selectedRoles.value = selectedRoles.value.filter((id) => id !== roleId);
  }
};

const toggleEditOffice = (officeId: string, checked: boolean) => {
  if (checked) {
    if (!selectedOffices.value.includes(officeId)) selectedOffices.value.push(officeId);
  } else {
    selectedOffices.value = selectedOffices.value.filter((id) => id !== officeId);
  }
};

const saveUserRoles = async () => {
  if (!editingUser.value) return;
  savingRoles.value = true;
  try {
    const response = await authFetch<{ success: boolean }>(
      `/api/admin/users/${editingUser.value.id}/roles`,
      {
        method: "PUT",
        body: { roleIds: selectedRoles.value },
      },
    );
    if (response.success) {
      flash("User roles updated");
      table.refresh();
      closeEditModal();
    }
  } catch (error) {
    console.error("Failed to update user roles:", error);
    flash("Failed to update user roles", "error");
  } finally {
    savingRoles.value = false;
  }
};

const saveUserOffices = async () => {
  if (!editingUser.value) return;
  savingOffices.value = true;
  try {
    const response = await authFetch<{ success: boolean }>(
      `/api/admin/users/${editingUser.value.id}/offices`,
      {
        method: "PUT",
        body: { collectionOfficeIds: selectedOffices.value },
      },
    );
    if (response.success) {
      flash("Collection offices updated");
      table.refresh();
      closeEditModal();
    }
  } catch (error) {
    console.error("Failed to update user offices:", error);
    flash("Failed to update collection offices", "error");
  } finally {
    savingOffices.value = false;
  }
};

const toggleUserStatus = async (user: User) => {
  try {
    const response = await authFetch<{ success: boolean }>(`/api/admin/users/${user.id}/status`, {
      method: "PATCH",
      body: { isActive: !user.isActive },
    });
    if (response.success) {
      table.refresh();
      flash(user.isActive ? "User deactivated." : "User activated.");
    }
  } catch (error) {
    console.error("Failed to toggle user status:", error);
    flash("Failed to update user status", "error");
  }
};

// ---------------------------------------------------------------------------
// Resend invite
// ---------------------------------------------------------------------------
const resendingId = ref<string | null>(null);

const resendInvite = async (user: User) => {
  resendingId.value = user.id;
  try {
    const response = await authFetch<{ success: boolean; inviteEmailSent?: boolean; message?: string }>(
      `/api/admin/users/${user.id}/resend-invite`,
      { method: "POST" },
    );
    if (response.success) {
      if (response.inviteEmailSent === false) {
        flash(response.message ?? "Invitation could not be sent — check email configuration.", "error");
      } else {
        flash("Invitation resent");
      }
    }
  } catch (error) {
    console.error("Failed to resend invite:", error);
    flash("Failed to resend invitation", "error");
  } finally {
    resendingId.value = null;
  }
};
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="User Management" description="Manage system users and their roles">
      <template #actions>
        <Button @click="openCreateModal">Create user</Button>
      </template>
    </PageHeader>

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
          <div class="flex flex-col gap-1">
            <AppUserCell
              :name="(row as User).profile?.fullName || (row as User).email"
              :email="(row as User).email"
            />
            <Badge v-if="!(row as User).activated" variant="secondary" class="w-fit">
              Invitation pending
            </Badge>
          </div>
        </template>
        <template #cell-roles="{ value }">
          <div class="flex flex-wrap gap-1">
            <Badge v-for="role in (value as string[])" :key="role" variant="secondary">
              {{ role }}
            </Badge>
          </div>
        </template>
        <template #cell-isActive="{ value }">
          <Badge
:class="(value as boolean)
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
              Edit
            </Button>
            <Button
              v-if="!(row as User).activated"
              variant="outline"
              size="sm"
              :disabled="resendingId === (row as User).id"
              @click.stop="resendInvite(row as User)"
            >
              {{ resendingId === (row as User).id ? 'Resending...' : 'Resend invite' }}
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

    <!-- Create User Modal -->
    <Dialog :open="showCreateModal" @update:open="(v: boolean) => { if (!v) closeCreateModal() }">
      <DialogContent class="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Invite a staff member. They will receive an email to set their password.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-1.5">
            <Label for="create-email">Email <span class="text-red-600">*</span></Label>
            <Input
              id="create-email"
              v-model="createForm.email"
              type="email"
              placeholder="name@adla.gov.gh"
            />
            <p v-if="createErrors.email" class="text-xs text-red-600">{{ createErrors.email }}</p>
          </div>
          <div class="space-y-1.5">
            <Label for="create-phone">Phone</Label>
            <Input
              id="create-phone"
              v-model="createForm.phone"
              type="tel"
              placeholder="Optional"
            />
            <p v-if="createErrors.phone" class="text-xs text-red-600">{{ createErrors.phone }}</p>
          </div>

          <div class="space-y-2">
            <Label>Roles</Label>
            <label
              v-for="role in creatableRoles"
              :key="role.id"
              class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
            >
              <Checkbox
                :model-value="createForm.roleNames.includes(role.name)"
                @update:model-value="(checked) => toggleCreateRole(role.name, checked === true)"
              />
              <div>
                <p class="text-sm font-medium text-foreground">{{ role.name }}</p>
                <p v-if="role.description" class="text-xs text-muted-foreground">
                  {{ role.description }}
                </p>
              </div>
            </label>
            <p v-if="createErrors.roles" class="text-xs text-red-600">
              {{ createErrors.roles }}
            </p>
          </div>

          <!-- Offices: only for schedule_officer, and required. -->
          <div v-if="createNeedsOffice" class="space-y-2">
            <Label>
              Collection Offices <span class="text-red-600">*</span>
            </Label>
            <p class="text-xs text-muted-foreground">
              A schedule officer must be assigned at least one collection office.
            </p>
            <div class="max-h-48 overflow-y-auto space-y-2 pr-1">
              <label
                v-for="office in offices"
                :key="office.id"
                class="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  :model-value="createForm.collectionOfficeIds.includes(office.id)"
                  @update:model-value="(checked) => toggleCreateOffice(office.id, checked === true)"
                />
                <div>
                  <p class="text-sm font-medium text-foreground">{{ office.name }}</p>
                  <p class="text-xs text-muted-foreground">{{ office.type }} · {{ office.region }}</p>
                </div>
              </label>
            </div>
            <p v-if="createErrors.offices" class="text-xs text-red-600">
              {{ createErrors.offices }}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="closeCreateModal">Cancel</Button>
          <Button :disabled="creating" @click="submitCreate">
            {{ creating ? 'Creating...' : 'Create & Invite' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Modal (roles + offices) -->
    <Dialog :open="showEditModal" @update:open="(v: boolean) => { if (!v) closeEditModal() }">
      <DialogContent class="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-1.5">
            Edit User
            <HelpTip field-id="user.roles" />
          </DialogTitle>
          <DialogDescription>{{ editingUser?.email }}</DialogDescription>
        </DialogHeader>

        <!-- Roles -->
        <div class="space-y-3">
          <Label>Roles</Label>
          <label
            v-for="role in roles"
            :key="role.id"
            class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
          >
            <Checkbox
              :model-value="selectedRoles.includes(role.id)"
              @update:model-value="(checked) => toggleRole(role.id, checked === true)"
            />
            <div>
              <p class="text-sm font-medium text-foreground">{{ role.name }}</p>
              <p v-if="role.description" class="text-xs text-muted-foreground">
                {{ role.description }}
              </p>
              <p v-if="role.name === 'applicant'" class="text-xs text-muted-foreground mt-1">
                Applicants must complete their own Ghana Card profile before they can file a
                declaration.
              </p>
            </div>
          </label>
          <div class="flex justify-end">
            <Button size="sm" :disabled="savingRoles" @click="saveUserRoles">
              {{ savingRoles ? 'Saving...' : 'Save Roles' }}
            </Button>
          </div>
        </div>

        <Separator />

        <!-- Offices -->
        <div class="space-y-3">
          <Label>Collection Offices</Label>
          <p class="text-xs text-muted-foreground">
            <template v-if="editHasOfficerRole">
              Schedule officers can only act on declarations from their assigned offices.
            </template>
            <template v-else>
              Office assignments apply to schedule officers.
            </template>
          </p>
          <div class="max-h-48 overflow-y-auto space-y-2 pr-1">
            <label
              v-for="office in offices"
              :key="office.id"
              class="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-muted/50"
            >
              <Checkbox
                :model-value="selectedOffices.includes(office.id)"
                @update:model-value="(checked) => toggleEditOffice(office.id, checked === true)"
              />
              <div>
                <p class="text-sm font-medium text-foreground">{{ office.name }}</p>
                <p class="text-xs text-muted-foreground">{{ office.type }} · {{ office.region }}</p>
              </div>
            </label>
          </div>
          <div class="flex justify-end">
            <Button size="sm" :disabled="savingOffices" @click="saveUserOffices">
              {{ savingOffices ? 'Saving...' : 'Save Offices' }}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="closeEditModal">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
