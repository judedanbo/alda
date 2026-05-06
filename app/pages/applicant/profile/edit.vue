<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();
const router = useRouter();

// Form state — editable fields only
const form = reactive({
  designation: "",
  institutionId: null as string | null,
  officeCategoryId: null as number | null,
});

// Read-only display values
const readOnly = reactive({
  fullName: "",
  ghanaCardNumber: "",
});

const isLoading = ref(true);
const isSaving = ref(false);
const error = ref("");
const success = ref("");
const { fieldErrors, clearFieldError, clearAll, handleServerError } = useFieldErrors();

// Fetch profile, institutions, and categories in parallel
const [profileRes, institutionsRes, categoriesRes] = await Promise.all([
  $fetch("/api/profile", { headers: authStore.getAuthHeaders() }),
  $fetch("/api/institutions"),
  $fetch("/api/categories"),
]);

const profile = (profileRes as any).data;
const institutions = (institutionsRes as any).data || [];
const categories = (categoriesRes as any).data || [];

// Pre-fill form from existing profile
readOnly.fullName = profile.fullName ?? "";
readOnly.ghanaCardNumber = profile.ghanaCardNumber ?? "";
form.designation = profile.designation ?? "";
form.institutionId = profile.institutionId ?? null;
form.officeCategoryId = profile.officeCategoryId ?? null;

isLoading.value = false;

async function handleSave() {
  error.value = "";
  success.value = "";
  clearAll();

  if (!form.designation || form.designation.length < 2) {
    fieldErrors.designation = "Designation is required (at least 2 characters)";
  }
  if (!form.officeCategoryId) {
    fieldErrors.officeCategoryId = "Please select a category";
  }
  if (Object.keys(fieldErrors).length > 0) return;

  isSaving.value = true;

  try {
    const body: Record<string, unknown> = {};
    if (form.designation) body.designation = form.designation;
    if (form.institutionId) body.institutionId = form.institutionId;
    if (form.officeCategoryId) body.officeCategoryId = form.officeCategoryId;

    await $fetch("/api/profile", {
      method: "PUT",
      body,
      headers: authStore.getAuthHeaders(),
    });

    success.value = "Profile updated successfully.";
  } catch (err: unknown) {
    error.value = handleServerError(err);
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <AppPageHeader
      title="Edit Profile"
      description="Update your office details and information"
    />

    <Card>
      <CardHeader>
        <CardTitle>Profile Details</CardTitle>
        <CardDescription>
          Legal identity fields are read-only. Contact an administrator to change them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <!-- Success alert -->
        <Alert v-if="success" class="mb-6 border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{{ success }}</AlertDescription>
        </Alert>

        <!-- Error alert -->
        <Alert v-if="error" variant="destructive" class="mb-6">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <form class="space-y-6" novalidate @submit.prevent="handleSave">
          <!-- Read-only: Full Name -->
          <div class="space-y-2">
            <Label for="fullName">Full Name</Label>
            <input
              id="fullName"
              type="text"
              :value="readOnly.fullName"
              disabled
              class="w-full px-4 py-2 border rounded-md bg-muted text-muted-foreground cursor-not-allowed"
            />
            <p class="text-xs text-muted-foreground">Legal identity field — read-only</p>
          </div>

          <!-- Read-only: Ghana Card Number -->
          <div class="space-y-2">
            <Label for="ghanaCardNumber">Ghana Card Number</Label>
            <input
              id="ghanaCardNumber"
              type="text"
              :value="readOnly.ghanaCardNumber"
              disabled
              class="w-full px-4 py-2 border rounded-md bg-muted text-muted-foreground cursor-not-allowed uppercase"
            />
            <p class="text-xs text-muted-foreground">Legal identity field — read-only</p>
          </div>

          <!-- Editable: Designation -->
          <div class="space-y-2">
            <Label for="designation">Designation / Position <span class="text-destructive">*</span></Label>
            <Input
              id="designation"
              v-model="form.designation"
              type="text"
              placeholder="e.g., Deputy Minister, Director, etc."
              required
              :class="{ 'border-destructive': fieldErrors.designation }"
              @input="clearFieldError('designation')"
            />
            <p v-if="fieldErrors.designation" class="text-xs text-destructive">
              {{ fieldErrors.designation }}
            </p>
          </div>

          <!-- Editable: Institution -->
          <div class="space-y-2">
            <Label for="institution">Institution</Label>
            <Select v-model="form.institutionId">
              <SelectTrigger id="institution" class="w-full">
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

          <!-- Editable: Office Category -->
          <div class="space-y-2">
            <Label for="officeCategory">Public Office Category <span class="text-destructive">*</span></Label>
            <Select v-model="form.officeCategoryId" @update:model-value="clearFieldError('officeCategoryId')">
              <SelectTrigger
                id="officeCategory"
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
            <p v-else class="text-xs text-muted-foreground">Article 286(5) of the 1992 Constitution</p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-4 pt-2">
            <Button type="submit" :disabled="isSaving">
              {{ isSaving ? "Saving..." : "Save Changes" }}
            </Button>
            <NuxtLink to="/applicant/dashboard">
              <Button type="button" variant="outline">Cancel</Button>
            </NuxtLink>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
