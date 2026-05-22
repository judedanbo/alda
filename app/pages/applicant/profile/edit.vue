<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface Office {
  id: string;
  designation: string;
  officeCategoryId: number;
  institutionId: string | null;
  startDate: string;
  endDate: string | null;
  officeCategory: { id: number; name: string } | null;
  institution: { id: string; name: string } | null;
}

interface ProfileResponse {
  data: {
    fullName: string;
    ghanaCardNumber: string;
    offices: Office[];
  };
}

interface ReferenceDataResponse {
  data: Array<{ id: string | number; name: string }>;
}

const readOnly = reactive({
  fullName: "",
  ghanaCardNumber: "",
});

const isLoading = ref(true);
const error = ref("");
const success = ref("");
const { fieldErrors, clearFieldError, clearAll, handleServerError } = useFieldErrors();

const offices = ref<Office[]>([]);
const editingOfficeId = ref<string | null>(null);
const showAddForm = ref(false);

const officeForm = reactive({
  designation: "",
  institutionId: null as string | null,
  officeCategoryId: null as number | null,
  startDate: new Date().toISOString().split("T")[0],
  endDate: "" as string,
});
const savingOffice = ref(false);

const [profileRes, institutionsRes, categoriesRes] = await Promise.all([
  authFetch("/api/profile"),
  $fetch("/api/institutions"),
  $fetch("/api/categories"),
]);

const profile = (profileRes as ProfileResponse).data;
const institutions = (institutionsRes as ReferenceDataResponse).data || [];
const categories = (categoriesRes as ReferenceDataResponse).data || [];

readOnly.fullName = profile.fullName ?? "";
readOnly.ghanaCardNumber = profile.ghanaCardNumber ?? "";
offices.value = (profile.offices || []).map((o: Office) => ({
  ...o,
  startDate: o.startDate ? o.startDate.split("T")[0] ?? "" : "",
  endDate: o.endDate ? o.endDate.split("T")[0] ?? null : null,
}));

isLoading.value = false;

function resetOfficeForm() {
  officeForm.designation = "";
  officeForm.institutionId = null;
  officeForm.officeCategoryId = null;
  officeForm.startDate = new Date().toISOString().split("T")[0];
  officeForm.endDate = "";
  editingOfficeId.value = null;
  showAddForm.value = false;
  clearAll();
}

function startEdit(office: Office) {
  editingOfficeId.value = office.id;
  officeForm.designation = office.designation;
  officeForm.officeCategoryId = office.officeCategoryId;
  officeForm.institutionId = office.institutionId;
  officeForm.startDate = office.startDate;
  officeForm.endDate = office.endDate || "";
  showAddForm.value = true;
  clearAll();
}

function startAdd() {
  resetOfficeForm();
  showAddForm.value = true;
}

function validateOfficeForm(): boolean {
  clearAll();
  if (!officeForm.designation || officeForm.designation.length < 2) {
    fieldErrors.designation = "Designation is required (at least 2 characters)";
  }
  if (!officeForm.officeCategoryId) {
    fieldErrors.officeCategoryId = "Please select a category";
  }
  if (!officeForm.startDate) {
    fieldErrors.startDate = "Start date is required";
  }
  if (officeForm.endDate && officeForm.startDate && officeForm.endDate <= officeForm.startDate) {
    fieldErrors.endDate = "End date must be after start date";
  }
  return Object.keys(fieldErrors).length === 0;
}

async function saveOffice() {
  if (!validateOfficeForm()) return;

  savingOffice.value = true;
  error.value = "";
  success.value = "";

  const body = {
    designation: officeForm.designation,
    officeCategoryId: officeForm.officeCategoryId,
    institutionId: officeForm.institutionId || undefined,
    startDate: officeForm.startDate,
    endDate: officeForm.endDate || undefined,
  };

  try {
    if (editingOfficeId.value) {
      const response = await authFetch<{ success: boolean; data: Office }>(`/api/profile/offices/${editingOfficeId.value}`, {
        method: "PUT",
        body,
      });

      if (response.success) {
        const idx = offices.value.findIndex((o) => o.id === editingOfficeId.value);
        if (idx !== -1) {
          offices.value[idx] = {
            ...response.data,
            startDate: response.data.startDate.split("T")[0] ?? "",
            endDate: response.data.endDate ? response.data.endDate.split("T")[0] ?? null : null,
          };
        }
        success.value = "Office updated successfully.";
      }
    } else {
      const response = await authFetch<{ success: boolean; data: Office }>("/api/profile/offices", {
        method: "POST",
        body,
      });

      if (response.success) {
        offices.value.push({
          ...response.data,
          startDate: response.data.startDate.split("T")[0] ?? "",
          endDate: response.data.endDate ? response.data.endDate.split("T")[0] ?? null : null,
        });
        success.value = "Office added successfully.";
      }
    }

    resetOfficeForm();
  } catch (err: unknown) {
    error.value = handleServerError(err);
  } finally {
    savingOffice.value = false;
  }
}

async function removeOffice(officeId: string) {
  error.value = "";
  success.value = "";

  try {
    await authFetch(`/api/profile/offices/${officeId}`, { method: "DELETE" });
    offices.value = offices.value.filter((o) => o.id !== officeId);
    success.value = "Office removed successfully.";
    if (editingOfficeId.value === officeId) {
      resetOfficeForm();
    }
  } catch (err: unknown) {
    error.value = handleServerError(err);
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Current";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
</script>

<template>
  <div class="max-w-2xl">
    <AppPageHeader
      title="Edit Profile"
      description="Update your office details and information"
    />

    <Card class="mb-6">
      <CardHeader>
        <CardTitle>Personal Details</CardTitle>
        <CardDescription>
          Legal identity fields are read-only. Contact an administrator to change them.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label>Full Name</Label>
          <input
            type="text"
            :value="readOnly.fullName"
            disabled
            class="w-full px-4 py-2 border rounded-md bg-muted text-muted-foreground cursor-not-allowed"
          >
        </div>
        <div class="space-y-2">
          <Label>Ghana Card Number</Label>
          <input
            type="text"
            :value="readOnly.ghanaCardNumber"
            disabled
            class="w-full px-4 py-2 border rounded-md bg-muted text-muted-foreground cursor-not-allowed uppercase"
          >
        </div>
      </CardContent>
    </Card>

    <!-- Success / Error alerts -->
    <Alert
      v-if="success"
      class="mb-6 border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300"
    >
      <AlertDescription>{{ success }}</AlertDescription>
    </Alert>
    <Alert v-if="error" variant="destructive" class="mb-6">
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <Card>
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle>Office Details</CardTitle>
            <CardDescription>Manage your public offices</CardDescription>
          </div>
          <Button v-if="!showAddForm" type="button" size="sm" @click="startAdd">
            Add Office
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- Existing offices -->
        <div
          v-for="office in offices"
          :key="office.id"
          class="flex items-start justify-between p-4 border rounded-lg"
          :class="office.endDate ? 'bg-muted/30' : ''"
        >
          <div>
            <p class="font-medium text-foreground">{{ office.designation }}</p>
            <p class="text-sm text-muted-foreground">{{ office.officeCategory?.name }}</p>
            <p v-if="office.institution" class="text-sm text-muted-foreground">{{ office.institution.name }}</p>
            <p class="text-xs text-muted-foreground mt-1">
              {{ formatDate(office.startDate) }} —
              <span v-if="office.endDate">{{ formatDate(office.endDate) }}</span>
              <span v-else class="text-primary font-medium">Current</span>
            </p>
          </div>
          <div class="flex gap-2">
            <Button type="button" variant="ghost" size="sm" @click="startEdit(office)">
              Edit
            </Button>
            <Button
              v-if="offices.length > 1"
              type="button"
              variant="ghost"
              size="sm"
              class="text-destructive"
              @click="removeOffice(office.id)"
            >
              Remove
            </Button>
          </div>
        </div>

        <p v-if="offices.length === 0" class="text-center text-muted-foreground py-4">
          No offices added yet.
        </p>

        <!-- Add / Edit office form -->
        <div v-if="showAddForm" class="border rounded-lg p-4 space-y-4 mt-4">
          <h4 class="text-sm font-medium text-foreground">
            {{ editingOfficeId ? "Edit Office" : "Add Office" }}
          </h4>

          <div class="space-y-2">
            <Label for="edit-officeCategoryId">
              Public Office Category <span class="text-destructive">*</span>
            </Label>
            <Select v-model="officeForm.officeCategoryId" @update:model-value="clearFieldError('officeCategoryId')">
              <SelectTrigger
                id="edit-officeCategoryId"
                class="w-full"
                :class="{ 'border-destructive': fieldErrors.officeCategoryId }"
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="cat in categories"
                  :key="cat.id"
                  :value="cat.id"
                >
                  {{ cat.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="fieldErrors.officeCategoryId" class="text-xs text-destructive">
              {{ fieldErrors.officeCategoryId }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="edit-institutionId">Institution</Label>
            <Select v-model="officeForm.institutionId">
              <SelectTrigger id="edit-institutionId" class="w-full">
                <SelectValue placeholder="Select institution (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="null">None</SelectItem>
                <SelectItem
                  v-for="inst in institutions"
                  :key="inst.id"
                  :value="inst.id"
                >
                  {{ inst.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="edit-designation">
              Designation / Position <span class="text-destructive">*</span>
            </Label>
            <Input
              id="edit-designation"
              v-model="officeForm.designation"
              type="text"
              placeholder="e.g., Deputy Minister, Director, etc."
              :class="{ 'border-destructive': fieldErrors.designation }"
              @input="clearFieldError('designation')"
            />
            <p v-if="fieldErrors.designation" class="text-xs text-destructive">
              {{ fieldErrors.designation }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="edit-startDate">Start Date <span class="text-destructive">*</span></Label>
              <Input
                id="edit-startDate"
                v-model="officeForm.startDate"
                type="date"
                :class="{ 'border-destructive': fieldErrors.startDate }"
                @input="clearFieldError('startDate')"
              />
              <p v-if="fieldErrors.startDate" class="text-xs text-destructive">
                {{ fieldErrors.startDate }}
              </p>
            </div>
            <div class="space-y-2">
              <Label for="edit-endDate">End Date</Label>
              <Input
                id="edit-endDate"
                v-model="officeForm.endDate"
                type="date"
              />
              <p v-if="fieldErrors.endDate" class="text-xs text-destructive">
                {{ fieldErrors.endDate }}
              </p>
              <p v-else class="text-xs text-muted-foreground">Leave blank if current</p>
            </div>
          </div>

          <div class="flex gap-2">
            <Button type="button" :disabled="savingOffice" @click="saveOffice">
              {{ savingOffice ? "Saving..." : (editingOfficeId ? "Update Office" : "Add Office") }}
            </Button>
            <Button type="button" variant="outline" @click="resetOfficeForm">Cancel</Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <div class="mt-6">
      <NuxtLink to="/applicant/dashboard">
        <Button type="button" variant="outline">Back to Dashboard</Button>
      </NuxtLink>
    </div>
  </div>
</template>
