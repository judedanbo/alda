<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "auth",
  middleware: "auth",
});

const authStore = useAuthStore();
const router = useRouter();

const checkingProfile = ref(true);

onMounted(async () => {
  try {
    const response = await $fetch("/api/auth/me", {
      headers: authStore.getAuthHeaders(),
    });
    if (response.success && response.data.profile) {
      router.replace("/applicant/dashboard");
      return;
    }
  } catch {
    // If the check fails, let the user proceed with the form
  } finally {
    checkingProfile.value = false;
  }
});

// Form state
const form = reactive({
  fullName: "",
  ghanaCardNumber: "",
  ghanaCardFrontUrl: "",
  ghanaCardBackUrl: "",
});

interface OfficeApiResponse {
  id: string;
  designation: string;
  institutionId: string | null;
  officeCategoryId: number | null;
  startDate: string;
  endDate: string | null;
  officeCategory: { name: string } | null;
  institution: { name: string } | null;
}

interface OfficeEntry {
  id?: string;
  designation: string;
  institutionId: string | null;
  officeCategoryId: number | null;
  startDate: string;
  endDate: string;
}

const officeForm = reactive<OfficeEntry>({
  designation: "",
  institutionId: null,
  officeCategoryId: null,
  startDate: new Date().toISOString().split("T")[0]!,
  endDate: "",
});

const offices = ref<(OfficeEntry & { id: string; categoryName?: string; institutionName?: string })[]>([]);
const addingOffice = ref(false);

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const error = ref("");
const isLoading = ref(false);
const currentStep = ref(1);
const totalSteps = 3;
const stepTitles = [
  "Personal Information",
  "Upload Ghana Card",
  "Office Details",
] as const;
const stepAnnouncement = computed(
  () => `Step ${currentStep.value} of ${totalSteps}: ${stepTitles[currentStep.value - 1]}`,
);
const { fieldErrors, clearFieldError, clearAll, handleServerError } = useFieldErrors();

// Fetch reference data
const { data: categories } = await useFetch("/api/categories");
const { data: institutions } = await useFetch("/api/institutions");

// File upload state
const uploadingFront = ref(false);
const uploadingBack = ref(false);

// Upload Ghana Card image
const uploadGhanaCard = async (file: File, side: "front" | "back") => {
  if (side === "front") uploadingFront.value = true;
  else uploadingBack.value = true;

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("side", side);

    const response = await authFetch<{ success: boolean; data: { url: string } }>("/api/upload/ghana-card", {
      method: "POST",
      body: formData,
    });

    if (response.success) {
      if (side === "front") {
        form.ghanaCardFrontUrl = response.data.url;
        clearFieldError("ghanaCardFront");
      } else {
        form.ghanaCardBackUrl = response.data.url;
      }
    }
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    error.value = e.data?.message || `Failed to upload Ghana Card ${side}`;
  } finally {
    if (side === "front") uploadingFront.value = false;
    else uploadingBack.value = false;
  }
};

// Ghana Card validation
const ghanaCardRegex = /^GHA-\d{9}-\d$/i;
const isGhanaCardValid = computed(() => ghanaCardRegex.test(form.ghanaCardNumber));

// Validate current step
const _isStepValid = computed(() => {
  switch (currentStep.value) {
    case 1:
      return form.fullName.length >= 2 && isGhanaCardValid.value;
    case 2:
      return form.ghanaCardFrontUrl !== "";
    case 3:
      return offices.value.length > 0;
    default:
      return false;
  }
});

// Convert Ghana Card number to uppercase as user types
watch(() => form.ghanaCardNumber, (newVal) => {
  const upperVal = newVal.toUpperCase();
  if (newVal !== upperVal) {
    form.ghanaCardNumber = upperVal;
  }
});

// Validate and show field errors for current step
const validateStep = (): boolean => {
  clearAll();
  switch (currentStep.value) {
    case 1:
      if (!form.fullName || form.fullName.length < 2) {
        fieldErrors.fullName = "Name must be at least 2 characters";
      }
      if (!form.ghanaCardNumber) {
        fieldErrors.ghanaCardNumber = "Ghana Card number is required";
      } else if (!isGhanaCardValid.value) {
        fieldErrors.ghanaCardNumber = "Invalid format. Use: GHA-XXXXXXXXX-X";
      }
      break;
    case 2:
      if (!form.ghanaCardFrontUrl) {
        fieldErrors.ghanaCardFront = "Ghana Card front image is required";
      }
      break;
    case 3:
      break;
  }
  return Object.keys(fieldErrors).length === 0;
};

// Go to next step
const nextStep = async () => {
  if (!validateStep()) return;

  if (currentStep.value === 2) {
    try {
      await createProfile();
    } catch (err: unknown) {
      const e = err as { status?: number; statusCode?: number; data?: { statusCode?: number } };
      const status = e?.status ?? e?.statusCode ?? e?.data?.statusCode;
      if (status !== 409) {
        return;
      }
      error.value = "";
    }
    currentStep.value = 3;
    return;
  }

  if (currentStep.value < totalSteps) {
    currentStep.value++;
  }
};

// Go to previous step
const prevStep = () => {
  if (currentStep.value > 1) {
    clearAll();
    currentStep.value--;
  }
};

// Create profile (called when moving from step 2 to step 3)
const createProfile = async () => {
  error.value = "";
  isLoading.value = true;

  try {
    await authFetch("/api/profile", {
      method: "POST",
      body: {
        fullName: form.fullName,
        ghanaCardNumber: form.ghanaCardNumber,
        ghanaCardFrontUrl: form.ghanaCardFrontUrl,
        ghanaCardBackUrl: form.ghanaCardBackUrl || undefined,
      },
    });
  } catch (err: unknown) {
    error.value = handleServerError(err);
    throw err;
  } finally {
    isLoading.value = false;
  }
};

// Validate office form fields
const validateOfficeForm = (): boolean => {
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
};

// Add an office
const addOffice = async () => {
  if (!validateOfficeForm()) return;

  addingOffice.value = true;
  error.value = "";

  try {
    const response = await authFetch<{ success: boolean; data: OfficeApiResponse }>("/api/profile/offices", {
      method: "POST",
      body: {
        designation: officeForm.designation,
        officeCategoryId: officeForm.officeCategoryId,
        institutionId: officeForm.institutionId || undefined,
        startDate: officeForm.startDate,
        endDate: officeForm.endDate || undefined,
      },
    });

    if (response.success) {
      offices.value.push({
        id: response.data.id,
        designation: response.data.designation,
        officeCategoryId: response.data.officeCategoryId,
        institutionId: response.data.institutionId,
        startDate: response.data.startDate,
        endDate: response.data.endDate || "",
        categoryName: response.data.officeCategory?.name,
        institutionName: response.data.institution?.name,
      });

      officeForm.designation = "";
      officeForm.institutionId = null;
      officeForm.officeCategoryId = null;
      officeForm.startDate = new Date().toISOString().split("T")[0]!;
      officeForm.endDate = "";
      clearAll();
    }
  } catch (err: unknown) {
    error.value = handleServerError(err);
  } finally {
    addingOffice.value = false;
  }
};

// Remove an office
const removeOffice = async (officeId: string) => {
  try {
    await authFetch(`/api/profile/offices/${officeId}`, { method: "DELETE" });
    offices.value = offices.value.filter((o) => o.id !== officeId);
  } catch (err: unknown) {
    error.value = handleServerError(err);
  }
};

// Complete setup
const handleSubmit = async () => {
  if (offices.value.length === 0) {
    error.value = "Please add at least one office.";
    return;
  }

  await authStore.fetchUser();
  router.push("/applicant/dashboard");
};
</script>

<template>
  <div class="w-full max-w-2xl">
    <div v-if="checkingProfile" class="flex items-center justify-center py-20">
      <p class="text-muted-foreground">Loading...</p>
    </div>
    <Card v-else class="shadow-lg">
      <!-- Header -->
      <CardHeader class="text-center">
        <CardTitle class="text-2xl">Complete Your Profile</CardTitle>
        <CardDescription>
          Step {{ currentStep }} of {{ totalSteps }}
        </CardDescription>
      </CardHeader>

      <CardContent class="p-8 pt-0">
        <!-- SR-only live region announcing step changes. -->
        <p class="sr-only" role="status" aria-live="polite">
          {{ stepAnnouncement }}
        </p>

        <!-- Progress Bar -->
        <div
          data-tour="profile-progress"
          class="mb-8"
          role="progressbar"
          :aria-valuenow="currentStep"
          :aria-valuemin="1"
          :aria-valuemax="totalSteps"
          :aria-valuetext="stepAnnouncement"
        >
          <div class="flex items-center justify-between mb-2" aria-hidden="true">
            <span
              v-for="step in totalSteps"
              :key="step"
              class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
              :class="[
                step <= currentStep
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              ]"
            >
              {{ step }}
            </span>
          </div>
          <div class="h-2 bg-muted rounded-full" aria-hidden="true">
            <div
              class="h-full bg-primary rounded-full transition-all duration-300"
              :style="{ width: `${(currentStep / totalSteps) * 100}%` }"
            />
          </div>
        </div>

        <!-- Error Alert -->
        <Alert v-if="error" variant="destructive" class="mb-6">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <form novalidate @submit.prevent="currentStep === totalSteps ? handleSubmit() : nextStep()">
          <!-- Step 1: Personal Information -->
          <div
            v-show="currentStep === 1"
            data-tour="profile-personal"
            class="space-y-6"
          >
            <h3 class="text-lg font-semibold text-foreground">Personal Information</h3>

            <FormField
              v-slot="{ id, ariaInvalid, ariaDescribedby }"
              label="Full Name (as on Ghana Card)"
              required
              :error="fieldErrors.fullName || (form.fullName && form.fullName.length < 2 ? 'Name must be at least 2 characters' : undefined)"
            >
              <Input
                :id="id"
                v-model="form.fullName"
                type="text"
                required
                placeholder="Enter your full name"
                :aria-invalid="ariaInvalid"
                :aria-describedby="ariaDescribedby"
                @input="clearFieldError('fullName')"
              />
            </FormField>

            <FormField
              required
              hint="Format: GHA-XXXXXXXXX-X (e.g., GHA-123456789-0)"
              :error="fieldErrors.ghanaCardNumber || (form.ghanaCardNumber && !isGhanaCardValid ? 'Invalid format. Use: GHA-XXXXXXXXX-X (e.g., GHA-123456789-0)' : undefined)"
            >
              <template #label>
                Ghana Card Number
                <HelpTip field-id="profile.ghanaCardNumber" />
              </template>
              <template #default="{ id, ariaInvalid, ariaDescribedby }">
                <Input
                  :id="id"
                  v-model="form.ghanaCardNumber"
                  type="text"
                  required
                  class="uppercase"
                  placeholder="GHA-XXXXXXXXX-X"
                  :aria-invalid="ariaInvalid"
                  :aria-describedby="ariaDescribedby"
                  @input="clearFieldError('ghanaCardNumber')"
                />
              </template>
            </FormField>
          </div>

          <!-- Step 2: Ghana Card Upload -->
          <div v-show="currentStep === 2" class="space-y-6">
            <h3 class="text-lg font-semibold text-foreground">Upload Ghana Card</h3>

            <AppFileUploadDropzone
              label="Ghana Card Front"
              required
              :uploading="uploadingFront"
              :image-url="form.ghanaCardFrontUrl"
              image-alt="Ghana Card Front"
              :error="fieldErrors.ghanaCardFront"
              help-text="JPG or PNG. Click, press Enter, or drop a file."
              success-text="Front uploaded successfully"
              placeholder-text="Upload front of Ghana Card"
              @file-selected="(file) => uploadGhanaCard(file, 'front')"
            >
              <template #label-suffix>
                <HelpTip field-id="profile.ghanaCardFront" />
              </template>
            </AppFileUploadDropzone>

            <AppFileUploadDropzone
              label="Ghana Card Back (Optional)"
              :uploading="uploadingBack"
              :image-url="form.ghanaCardBackUrl"
              image-alt="Ghana Card Back"
              help-text="JPG or PNG. Click, press Enter, or drop a file."
              success-text="Back uploaded successfully"
              placeholder-text="Upload back of Ghana Card"
              @file-selected="(file) => uploadGhanaCard(file, 'back')"
            >
              <template #label-suffix>
                <HelpTip field-id="profile.ghanaCardBack" />
              </template>
            </AppFileUploadDropzone>
          </div>

          <!-- Step 3: Office Details -->
          <div v-show="currentStep === 3" class="space-y-6">
            <h3 class="text-lg font-semibold text-foreground">Office Details</h3>
            <p class="text-sm text-muted-foreground">Add at least one public office you currently hold or have held.</p>

            <!-- Added offices list -->
            <div v-if="offices.length > 0" class="space-y-3">
              <div
                v-for="office in offices"
                :key="office.id"
                class="flex items-start justify-between p-4 border rounded-lg bg-muted/30"
              >
                <div>
                  <p class="font-medium text-foreground">{{ office.designation }}</p>
                  <p class="text-sm text-muted-foreground">{{ office.categoryName }}</p>
                  <p v-if="office.institutionName" class="text-sm text-muted-foreground">{{ office.institutionName }}</p>
                  <p class="text-xs text-muted-foreground mt-1">
                    From {{ formatDate(office.startDate) }}
                    <span v-if="office.endDate"> to {{ formatDate(office.endDate) }}</span>
                    <span v-else class="text-primary font-medium"> — Current</span>
                  </p>
                </div>
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

            <!-- Add office form -->
            <div class="border rounded-lg p-4 space-y-4">
              <h4 class="text-sm font-medium text-foreground">Add Office</h4>

              <FormField :error="fieldErrors.officeCategoryId" required>
                <template #label>
                  Public Office Category
                  <HelpTip field-id="profile.category" />
                </template>
                <template #default="{ id, ariaDescribedby }">
                  <Select
                    v-model="officeForm.officeCategoryId"
                    @update:model-value="clearFieldError('officeCategoryId')"
                  >
                    <SelectTrigger :id="id" :aria-describedby="ariaDescribedby" class="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="cat in categories?.data || []"
                        :key="cat.id"
                        :value="cat.id"
                      >
                        {{ cat.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </template>
              </FormField>

              <FormField>
                <template #label>
                  Institution
                  <HelpTip field-id="profile.institution" />
                </template>
                <template #default="{ id }">
                  <Select v-model="officeForm.institutionId">
                    <SelectTrigger :id="id" class="w-full">
                      <SelectValue placeholder="Select institution (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem :value="null">
                        None
                      </SelectItem>
                      <SelectItem
                        v-for="inst in institutions?.data || []"
                        :key="inst.id"
                        :value="inst.id"
                      >
                        {{ inst.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </template>
              </FormField>

              <FormField :error="fieldErrors.designation" required>
                <template #label>
                  Designation / Position
                  <HelpTip field-id="profile.designation" />
                </template>
                <template #default="{ id, ariaInvalid, ariaDescribedby }">
                  <Input
                    :id="id"
                    v-model="officeForm.designation"
                    type="text"
                    placeholder="e.g., Deputy Minister, Director, etc."
                    :aria-invalid="ariaInvalid"
                    :aria-describedby="ariaDescribedby"
                    @input="clearFieldError('designation')"
                  />
                </template>
              </FormField>

              <div class="grid grid-cols-2 gap-4">
                <FormField
                  v-slot="{ id, ariaInvalid, ariaDescribedby }"
                  label="Start Date"
                  required
                  :error="fieldErrors.startDate"
                >
                  <Input
                    :id="id"
                    v-model="officeForm.startDate"
                    type="date"
                    :aria-invalid="ariaInvalid"
                    :aria-describedby="ariaDescribedby"
                    @input="clearFieldError('startDate')"
                  />
                </FormField>
                <FormField
                  v-slot="{ id, ariaInvalid, ariaDescribedby }"
                  label="End Date"
                  hint="Leave blank if current"
                  :error="fieldErrors.endDate"
                >
                  <Input
                    :id="id"
                    v-model="officeForm.endDate"
                    type="date"
                    :aria-invalid="ariaInvalid"
                    :aria-describedby="ariaDescribedby"
                  />
                </FormField>
              </div>

              <Button
                type="button"
                variant="outline"
                :disabled="addingOffice"
                @click="addOffice"
              >
                {{ addingOffice ? "Adding..." : "Add Office" }}
              </Button>
            </div>
          </div>

          <!-- Navigation Buttons -->
          <div class="flex items-center justify-between mt-8 pt-6 border-t">
            <Button
              v-if="currentStep > 1"
              type="button"
              variant="ghost"
              @click="prevStep"
            >
              Back
            </Button>
            <div v-else />

            <Button
              v-if="currentStep === totalSteps"
              type="submit"
              :disabled="isLoading || offices.length === 0"
            >
              <span v-if="isLoading">Completing...</span>
              <span v-else>Complete Setup</span>
            </Button>
            <Button
              v-else
              type="submit"
              data-tour="profile-continue"
              :disabled="isLoading"
            >
              <span v-if="isLoading">Loading...</span>
              <span v-else>Continue</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
