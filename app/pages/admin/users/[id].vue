<script setup lang="ts">
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

interface ActivityItem {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

interface UserDetail {
  id: string;
  email: string;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  isActive: boolean;
  activated: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  activity: ActivityItem[];
}

interface Role {
  id: number;
  name: string;
  description: string | null;
}

const route = useRoute();
const id = route.params.id as string;
const { toast } = useToast();

const { data, pending, error, refresh } = await useAsyncData(`admin-user-${id}`, () =>
  authFetch<{ success: boolean; data: UserDetail }>(`/api/admin/users/${id}`),
);

const user = computed(() => data.value?.data ?? null);

// Reference data (roles + offices) loaded once.
const roles = ref<Role[]>([]);
const offices = ref<CollectionOffice[]>([]);

onMounted(async () => {
  try {
    const [rolesRes, officesRes] = await Promise.all([
      authFetch<{ success: boolean; data: { roles: Role[] } }>("/api/admin/roles"),
      authFetch<{ success: boolean; data: CollectionOffice[] }>("/api/collection-offices"),
    ]);
    if (rolesRes.success) roles.value = rolesRes.data.roles;
    if (officesRes.success) offices.value = officesRes.data;
  } catch (e) {
    console.error("Failed to fetch reference data:", e);
  }
});

// ---------------------------------------------------------------------------
// Profile (email + phone)
// ---------------------------------------------------------------------------
const profileForm = ref({ email: "", phone: "" });
const savingProfile = ref(false);
const { fieldErrors, clearAll, clearFieldError, handleServerError } = useFieldErrors();

watch(
  user,
  (u) => {
    if (u) profileForm.value = { email: u.email, phone: u.phone ?? "" };
  },
  { immediate: true },
);

const saveProfile = async () => {
  if (!user.value) return;
  clearAll();
  if (!profileForm.value.email.trim()) {
    fieldErrors.email = "Email is required";
    return;
  }
  savingProfile.value = true;
  try {
    await authFetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: {
        email: profileForm.value.email.trim(),
        phone: profileForm.value.phone.trim() || null,
      },
    });
    toast.success("Profile updated");
    await refresh();
  } catch (e: unknown) {
    const msg = handleServerError(e);
    if (msg) {
      if (/email/i.test(msg)) fieldErrors.email = msg;
      else toast.error(msg);
    }
  } finally {
    savingProfile.value = false;
  }
};

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
const selectedRoles = ref<number[]>([]);
const savingRoles = ref(false);

watch(
  [user, roles],
  () => {
    if (user.value && roles.value.length) {
      selectedRoles.value = roles.value
        .filter((r) => user.value!.roles.includes(r.name))
        .map((r) => r.id);
    }
  },
  { immediate: true },
);

const toggleRole = (roleId: number, checked: boolean) => {
  if (checked) {
    if (!selectedRoles.value.includes(roleId)) selectedRoles.value.push(roleId);
  } else {
    selectedRoles.value = selectedRoles.value.filter((rid) => rid !== roleId);
  }
};

const saveRoles = async () => {
  savingRoles.value = true;
  try {
    await authFetch(`/api/admin/users/${id}/roles`, {
      method: "PUT",
      body: { roleIds: selectedRoles.value },
    });
    toast.success("Roles updated");
    await refresh();
  } catch (e: unknown) {
    toast.fromError(e, "Failed to update roles");
  } finally {
    savingRoles.value = false;
  }
};

// ---------------------------------------------------------------------------
// Offices
// ---------------------------------------------------------------------------
const selectedOffices = ref<string[]>([]);
const savingOffices = ref(false);

watch(
  user,
  (u) => {
    if (u) selectedOffices.value = u.collectionOffices.map((o) => o.id);
  },
  { immediate: true },
);

const hasOfficerRole = computed(() => {
  const officer = roles.value.find((r) => r.name === "schedule_officer");
  return officer ? selectedRoles.value.includes(officer.id) : false;
});

const toggleOffice = (officeId: string, checked: boolean) => {
  if (checked) {
    if (!selectedOffices.value.includes(officeId)) selectedOffices.value.push(officeId);
  } else {
    selectedOffices.value = selectedOffices.value.filter((oid) => oid !== officeId);
  }
};

const saveOffices = async () => {
  savingOffices.value = true;
  try {
    await authFetch(`/api/admin/users/${id}/offices`, {
      method: "PUT",
      body: { collectionOfficeIds: selectedOffices.value },
    });
    toast.success("Collection offices updated");
    await refresh();
  } catch (e: unknown) {
    toast.fromError(e, "Failed to update offices");
  } finally {
    savingOffices.value = false;
  }
};

// ---------------------------------------------------------------------------
// Security: status, resend invite, password reset, delete
// ---------------------------------------------------------------------------
const togglingStatus = ref(false);
const toggleStatus = async () => {
  if (!user.value) return;
  togglingStatus.value = true;
  try {
    await authFetch(`/api/admin/users/${id}/status`, {
      method: "PATCH",
      body: { isActive: !user.value.isActive },
    });
    toast.success(user.value.isActive ? "User deactivated" : "User activated");
    await refresh();
  } catch (e: unknown) {
    toast.fromError(e, "Failed to update status");
  } finally {
    togglingStatus.value = false;
  }
};

const resending = ref(false);
const resendInvite = async () => {
  resending.value = true;
  try {
    const res = await authFetch<{ success: boolean; inviteEmailSent?: boolean; message?: string }>(
      `/api/admin/users/${id}/resend-invite`,
      { method: "POST" },
    );
    if (res.inviteEmailSent === false) {
      toast.error(res.message ?? "Invitation could not be sent — check email configuration.");
    } else {
      toast.success("Invitation resent");
    }
  } catch (e: unknown) {
    toast.fromError(e, "Failed to resend invitation");
  } finally {
    resending.value = false;
  }
};

const sendingReset = ref(false);
const sendPasswordReset = async () => {
  sendingReset.value = true;
  try {
    const res = await authFetch<{ success: boolean; emailSent?: boolean; message?: string }>(
      `/api/admin/users/${id}/reset-password`,
      { method: "POST" },
    );
    if (res.emailSent === false) {
      toast.error(res.message ?? "Reset link could not be sent — check email configuration.");
    } else {
      toast.success("Password reset link sent");
    }
  } catch (e: unknown) {
    toast.fromError(e, "Failed to send password reset");
  } finally {
    sendingReset.value = false;
  }
};

const showDeleteDialog = ref(false);
const deleting = ref(false);
const deleteUser = async () => {
  deleting.value = true;
  try {
    await authFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    toast.success("User deleted");
    showDeleteDialog.value = false;
    navigateTo("/admin/users");
  } catch (e: unknown) {
    toast.fromError(e, "Failed to delete user");
  } finally {
    deleting.value = false;
  }
};

// Human-readable audit action labels (fall back to the raw value).
const actionLabel = (action: string) =>
  action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
</script>

<template>
  <div class="space-y-6">
    <div>
      <NuxtLink
        to="/admin/users"
        class="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to users
      </NuxtLink>
    </div>

    <!-- Loading / error -->
    <div v-if="pending" class="space-y-4">
      <Skeleton class="h-20 w-full" />
      <Skeleton class="h-64 w-full" />
    </div>
    <Alert v-else-if="error || !user" variant="destructive">
      <AlertTitle>Unable to load user</AlertTitle>
      <AlertDescription>This user could not be found or you lack access.</AlertDescription>
    </Alert>

    <template v-else>
      <!-- Header -->
      <Card>
        <CardContent class="pt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="space-y-2">
            <AppUserCell :name="user.profile?.fullName || user.email" :email="user.email" />
            <div class="flex flex-wrap items-center gap-1.5">
              <Badge
                :class="user.isActive
                  ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'"
              >
                {{ user.isActive ? 'Active' : 'Inactive' }}
              </Badge>
              <Badge v-for="role in user.roles" :key="role" variant="secondary">{{ role }}</Badge>
              <Badge v-if="!user.activated" variant="outline">Invitation pending</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs default-value="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="offices">Offices</TabsTrigger>
          <TabsTrigger value="security">Security &amp; Activity</TabsTrigger>
        </TabsList>

        <!-- Profile -->
        <TabsContent value="profile">
          <Card>
            <CardContent class="pt-6 space-y-5">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <Label for="email">Email <span class="text-red-600">*</span></Label>
                  <Input
                    id="email"
                    v-model="profileForm.email"
                    type="email"
                    @input="clearFieldError('email')"
                  />
                  <p v-if="fieldErrors.email" class="text-xs text-red-600">{{ fieldErrors.email }}</p>
                </div>
                <div class="space-y-1.5">
                  <Label for="phone">Phone</Label>
                  <Input
                    id="phone"
                    v-model="profileForm.phone"
                    type="tel"
                    placeholder="+233200000000"
                    @input="clearFieldError('phone')"
                  />
                  <p v-if="fieldErrors.phone" class="text-xs text-red-600">{{ fieldErrors.phone }}</p>
                </div>
              </div>

              <div class="flex justify-end">
                <Button :disabled="savingProfile" @click="saveProfile">
                  {{ savingProfile ? 'Saving...' : 'Save changes' }}
                </Button>
              </div>

              <Separator />

              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div class="flex justify-between gap-4">
                  <dt class="text-muted-foreground">Email verified</dt>
                  <dd>{{ user.emailVerified ? 'Yes' : 'No' }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-muted-foreground">Phone verified</dt>
                  <dd>{{ user.phoneVerified ? 'Yes' : 'No' }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-muted-foreground">Last login</dt>
                  <dd>
                    <AppDateCell v-if="user.lastLoginAt" :date="user.lastLoginAt" />
                    <span v-else class="text-muted-foreground">Never</span>
                  </dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-muted-foreground">Created</dt>
                  <dd><AppDateCell :date="user.createdAt" /></dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-muted-foreground">Updated</dt>
                  <dd><AppDateCell :date="user.updatedAt" /></dd>
                </div>
              </dl>

              <!-- Applicant profile (if the user also self-registered) -->
              <template v-if="user.profile">
                <Separator />
                <div class="space-y-1 text-sm">
                  <p class="font-medium">Applicant profile</p>
                  <p class="text-muted-foreground">{{ user.profile.fullName }}</p>
                  <ul v-if="user.profile.offices.length" class="text-muted-foreground list-disc pl-5">
                    <li v-for="(o, i) in user.profile.offices" :key="i">
                      {{ o.designation }}<template v-if="o.institution"> · {{ o.institution.name }}</template>
                    </li>
                  </ul>
                </div>
              </template>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Roles -->
        <TabsContent value="roles">
          <Card>
            <CardContent class="pt-6 space-y-3">
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
                <Button :disabled="savingRoles" @click="saveRoles">
                  {{ savingRoles ? 'Saving...' : 'Save roles' }}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Offices -->
        <TabsContent value="offices">
          <Card>
            <CardContent class="pt-6 space-y-3">
              <p class="text-xs text-muted-foreground">
                <template v-if="hasOfficerRole">
                  Schedule officers can only act on declarations from their assigned offices.
                </template>
                <template v-else>
                  Office assignments apply to schedule officers. This user has no schedule-officer role.
                </template>
              </p>
              <div class="max-h-72 overflow-y-auto space-y-2 pr-1">
                <label
                  v-for="office in offices"
                  :key="office.id"
                  class="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    :model-value="selectedOffices.includes(office.id)"
                    @update:model-value="(checked) => toggleOffice(office.id, checked === true)"
                  />
                  <div>
                    <p class="text-sm font-medium text-foreground">{{ office.name }}</p>
                    <p class="text-xs text-muted-foreground">{{ office.type }} · {{ office.region }}</p>
                  </div>
                </label>
              </div>
              <div class="flex justify-end">
                <Button :disabled="savingOffices" @click="saveOffices">
                  {{ savingOffices ? 'Saving...' : 'Save offices' }}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Security & Activity -->
        <TabsContent value="security">
          <div class="space-y-6">
            <Card>
              <CardContent class="pt-6 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium">Account status</p>
                    <p class="text-xs text-muted-foreground">
                      Deactivated users cannot sign in.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    :disabled="togglingStatus"
                    :class="user.isActive
                      ? 'text-red-600 hover:text-red-700 dark:text-red-400'
                      : 'text-green-600 hover:text-green-700 dark:text-green-400'"
                    @click="toggleStatus"
                  >
                    {{ user.isActive ? 'Deactivate' : 'Activate' }}
                  </Button>
                </div>

                <Separator />

                <div v-if="!user.activated" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium">Invitation</p>
                    <p class="text-xs text-muted-foreground">
                      This account has not been activated yet.
                    </p>
                  </div>
                  <Button variant="outline" :disabled="resending" @click="resendInvite">
                    {{ resending ? 'Resending...' : 'Resend invitation' }}
                  </Button>
                </div>

                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium">Password reset</p>
                    <p class="text-xs text-muted-foreground">
                      Email the user a one-hour link to set a new password.
                    </p>
                  </div>
                  <Button variant="outline" :disabled="sendingReset" @click="sendPasswordReset">
                    {{ sendingReset ? 'Sending...' : 'Send password reset' }}
                  </Button>
                </div>

                <Separator />

                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-red-600 dark:text-red-400">Delete user</p>
                    <p class="text-xs text-muted-foreground">
                      Hides the account and revokes sessions. Audit history is retained.
                    </p>
                  </div>
                  <Button variant="destructive" @click="showDeleteDialog = true">Delete user</Button>
                </div>
              </CardContent>
            </Card>

            <!-- Activity timeline -->
            <Card>
              <CardHeader>
                <CardTitle class="text-base">Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                <p v-if="!user.activity.length" class="text-sm text-muted-foreground">
                  No recorded activity.
                </p>
                <ul v-else class="space-y-3">
                  <li
                    v-for="item in user.activity"
                    :key="item.id"
                    class="flex items-start justify-between gap-4 border-b last:border-0 pb-3 last:pb-0"
                  >
                    <div class="flex items-center gap-2">
                      <Badge variant="secondary">{{ actionLabel(item.action) }}</Badge>
                      <span v-if="item.entityType" class="text-xs text-muted-foreground">
                        {{ item.entityType }}
                      </span>
                    </div>
                    <AppDateCell :date="item.createdAt" class="text-xs text-muted-foreground" />
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </template>

    <!-- Delete confirmation -->
    <Dialog :open="showDeleteDialog" @update:open="(v: boolean) => { if (!v) showDeleteDialog = false }">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete user?</DialogTitle>
          <DialogDescription>
            {{ user?.email }} will be hidden and signed out everywhere. This cannot be undone from
            the UI. Their audit history is retained for compliance.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" :disabled="deleting" @click="deleteUser">
            {{ deleting ? 'Deleting...' : 'Delete user' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
