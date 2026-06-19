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
    idType: import("~/utils/displayId").IdType;
    ghanaCardNumber: string | null;
    alternateIdNumber: string | null;
    offices: Office[];
  };
}

interface CategoryDataResponse {
  data: Array<{ id: number; name: string }>;
}

interface InstitutionDataResponse {
  data: Array<{ id: string; name: string }>;
}

const readOnly = reactive({
  fullName: "",
  idLabel: "Ghana Card",
  idNumber: "",
});

const isLoading = ref(true);
const { toast } = useToast();
const { handleServerError } = useFieldErrors();

const offices = ref<Office[]>([]);
const editingOfficeId = ref<string | null>(null);
const showOfficeDialog = ref(false);
const savingOffice = ref(false);

interface OfficePayload {
  designation: string;
  officeCategoryId: number;
  institutionId: string | null;
  startDate: string;
  endDate: string;
}

// The office currently being edited, used to seed the dialog form. Null in add mode.
const editingOffice = computed(() => {
  if (!editingOfficeId.value) return null;
  const o = offices.value.find((x) => x.id === editingOfficeId.value);
  if (!o) return null;
  return {
    designation: o.designation,
    officeCategoryId: o.officeCategoryId,
    institutionId: o.institutionId,
    startDate: o.startDate,
    endDate: o.endDate,
  };
});

const [profileRes, institutionsRes, categoriesRes] = await Promise.all([
  authFetch("/api/profile"),
  $fetch("/api/institutions"),
  $fetch("/api/categories"),
]);

const profile = (profileRes as ProfileResponse).data;
const institutions = (institutionsRes as InstitutionDataResponse).data || [];
const categories = (categoriesRes as CategoryDataResponse).data || [];

readOnly.fullName = profile.fullName ?? "";
{
  const { displayId } = await import("~/utils/displayId");
  const view = displayId(profile);
  readOnly.idLabel = view.label;
  readOnly.idNumber = view.value;
}
offices.value = (profile.offices || []).map((o: Office) => ({
  ...o,
  startDate: o.startDate ? o.startDate.split("T")[0] ?? "" : "",
  endDate: o.endDate ? o.endDate.split("T")[0] ?? null : null,
}));

isLoading.value = false;

function closeDialog() {
  showOfficeDialog.value = false;
  editingOfficeId.value = null;
}

function startEdit(office: Office) {
  editingOfficeId.value = office.id;
  showOfficeDialog.value = true;
}

function startAdd() {
  editingOfficeId.value = null;
  showOfficeDialog.value = true;
}

async function saveOffice(payload: OfficePayload) {
  savingOffice.value = true;

  const body = {
    designation: payload.designation,
    officeCategoryId: payload.officeCategoryId,
    institutionId: payload.institutionId || undefined,
    startDate: payload.startDate,
    endDate: payload.endDate || undefined,
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
        toast.success("Office updated successfully.");
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
        toast.success("Office added successfully.");
      }
    }

    closeDialog();
  } catch (err: unknown) {
    const message = handleServerError(err);
    if (message) toast.error(message);
  } finally {
    savingOffice.value = false;
  }
}

async function removeOffice(officeId: string) {
  try {
    await authFetch(`/api/profile/offices/${officeId}`, { method: "DELETE" });
    offices.value = offices.value.filter((o) => o.id !== officeId);
    toast.success("Office removed successfully.");
    if (editingOfficeId.value === officeId) {
      closeDialog();
    }
  } catch (err: unknown) {
    const message = handleServerError(err);
    if (message) toast.error(message);
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

    <Card class="mb-6" data-tour="edit-identity">
      <CardHeader>
        <CardTitle>Personal Details</CardTitle>
        <CardDescription>
          Legal identity fields are read-only. Contact an administrator to change them.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <FormField v-slot="{ id }" label="Full Name">
          <Input
            :id="id"
            :model-value="readOnly.fullName"
            type="text"
            disabled
          />
        </FormField>
        <FormField v-slot="{ id }" :label="`${readOnly.idLabel} Number`">
          <Input
            :id="id"
            :model-value="readOnly.idNumber"
            type="text"
            disabled
            class="uppercase"
          />
        </FormField>
      </CardContent>
    </Card>

    <Card data-tour="edit-offices">
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle>Office Details</CardTitle>
            <CardDescription>Manage your public offices</CardDescription>
          </div>
          <Button v-if="offices.length > 0" type="button" size="sm" @click="startAdd">
            + Add another office
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

        <!-- Empty state: prominent first-office call to action -->
        <div
          v-if="offices.length === 0"
          class="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center"
        >
          <p class="text-sm text-muted-foreground">No offices added yet.</p>
          <Button type="button" @click="startAdd">
            + Add your first office
          </Button>
        </div>

        <ApplicantOfficeFormDialog
          :open="showOfficeDialog"
          :categories="categories"
          :institutions="institutions"
          :office="editingOffice"
          :saving="savingOffice"
          @update:open="(v) => { if (!v) closeDialog(); }"
          @submit="saveOffice"
        />
      </CardContent>
    </Card>

    <div class="mt-6">
      <NuxtLink to="/applicant/dashboard">
        <Button type="button" variant="outline">Back to Dashboard</Button>
      </NuxtLink>
    </div>
  </div>
</template>
