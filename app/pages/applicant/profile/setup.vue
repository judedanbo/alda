<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "auth",
  middleware: "auth",
});

const authStore = useAuthStore();
const router = useRouter();

// Form state
const form = reactive({
  fullName: "",
  ghanaCardNumber: "",
  designation: "",
  institutionId: null as string | null,
  officeCategoryId: null as number | null,
  ghanaCardFrontUrl: "",
  ghanaCardBackUrl: "",
});

const error = ref("");
const isLoading = ref(false);
const currentStep = ref(1);
const totalSteps = 3;
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
  } catch (err: any) {
    error.value = err.data?.message || `Failed to upload Ghana Card ${side}`;
  } finally {
    if (side === "front") uploadingFront.value = false;
    else uploadingBack.value = false;
  }
};

// Handle file selection
const handleFileSelect = (event: Event, side: "front" | "back") => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    uploadGhanaCard(input.files[0], side);
  }
};

// Ghana Card validation
const ghanaCardRegex = /^GHA-\d{9}-\d$/i;
const isGhanaCardValid = computed(() => ghanaCardRegex.test(form.ghanaCardNumber));

// Validate current step
const isStepValid = computed(() => {
  switch (currentStep.value) {
    case 1:
      return form.fullName.length >= 2 && isGhanaCardValid.value;
    case 2:
      return form.ghanaCardFrontUrl !== "";
    case 3:
      return form.designation.length >= 2 && form.officeCategoryId !== null;
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
      if (!form.designation || form.designation.length < 2) {
        fieldErrors.designation = "Designation is required";
      }
      if (!form.officeCategoryId) {
        fieldErrors.officeCategoryId = "Please select a category";
      }
      break;
  }
  return Object.keys(fieldErrors).length === 0;
};

// Go to next step
const nextStep = () => {
  if (currentStep.value < totalSteps && validateStep()) {
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

// Submit profile
const handleSubmit = async () => {
  if (!validateStep()) return;

  error.value = "";
  isLoading.value = true;

  try {
    const response = await authFetch<{ success: boolean }>("/api/profile", {
      method: "POST",
      body: {
        fullName: form.fullName,
        ghanaCardNumber: form.ghanaCardNumber,
        ghanaCardFrontUrl: form.ghanaCardFrontUrl,
        ghanaCardBackUrl: form.ghanaCardBackUrl || undefined,
        designation: form.designation,
        institutionId: form.institutionId || undefined,
        officeCategoryId: form.officeCategoryId,
      },
    });

    if (response.success) {
      await authStore.fetchUser();
      router.push("/applicant/dashboard");
    }
  } catch (err: unknown) {
    error.value = handleServerError(err);
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="w-full max-w-2xl">
    <Card class="shadow-lg">
      <!-- Header -->
      <CardHeader class="text-center">
        <CardTitle class="text-2xl">Complete Your Profile</CardTitle>
        <CardDescription>
          Step {{ currentStep }} of {{ totalSteps }}
        </CardDescription>
      </CardHeader>

      <CardContent class="p-8 pt-0">
        <!-- Progress Bar -->
        <div class="mb-8">
          <div class="flex items-center justify-between mb-2">
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
          <div class="h-2 bg-muted rounded-full">
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
          <div v-show="currentStep === 1" class="space-y-6">
            <h3 class="text-lg font-semibold text-foreground">Personal Information</h3>

            <div class="space-y-2">
              <Label for="fullName">
                Full Name (as on Ghana Card) <span class="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                v-model="form.fullName"
                type="text"
                required
                placeholder="Enter your full name"
                :class="{ 'border-destructive': fieldErrors.fullName || (form.fullName && form.fullName.length < 2) }"
                @input="clearFieldError('fullName')"
              />
              <p v-if="fieldErrors.fullName" class="text-xs text-destructive">
                {{ fieldErrors.fullName }}
              </p>
              <p v-else-if="form.fullName && form.fullName.length < 2" class="text-xs text-destructive">
                Name must be at least 2 characters
              </p>
            </div>

            <div class="space-y-2">
              <Label for="ghanaCardNumber">
                Ghana Card Number <span class="text-destructive">*</span>
              </Label>
              <Input
                id="ghanaCardNumber"
                v-model="form.ghanaCardNumber"
                type="text"
                required
                class="uppercase"
                placeholder="GHA-XXXXXXXXX-X"
                :class="{ 'border-destructive': fieldErrors.ghanaCardNumber || (form.ghanaCardNumber && !isGhanaCardValid) }"
                @input="clearFieldError('ghanaCardNumber')"
              />
              <p v-if="fieldErrors.ghanaCardNumber" class="text-xs text-destructive">
                {{ fieldErrors.ghanaCardNumber }}
              </p>
              <p v-else-if="form.ghanaCardNumber && !isGhanaCardValid" class="text-xs text-destructive">
                Invalid format. Use: GHA-XXXXXXXXX-X (e.g., GHA-123456789-0)
              </p>
              <p v-else class="text-xs text-muted-foreground">
                Format: GHA-XXXXXXXXX-X (e.g., GHA-123456789-0)
              </p>
            </div>
          </div>

          <!-- Step 2: Ghana Card Upload -->
          <div v-show="currentStep === 2" class="space-y-6">
            <h3 class="text-lg font-semibold text-foreground">Upload Ghana Card</h3>

            <!-- Front -->
            <div class="space-y-2">
              <Label>
                Ghana Card Front <span class="text-destructive">*</span>
              </Label>
              <div
                class="border-2 border-dashed rounded-lg p-6 text-center transition-colors"
                :class="form.ghanaCardFrontUrl ? 'border-primary bg-primary/5' : fieldErrors.ghanaCardFront ? 'border-destructive' : 'border-muted-foreground/30'"
              >
                <div v-if="uploadingFront" class="text-muted-foreground">
                  Uploading...
                </div>
                <div v-else-if="form.ghanaCardFrontUrl">
                  <img
                    :src="form.ghanaCardFrontUrl"
                    alt="Ghana Card Front"
                    class="max-h-40 mx-auto rounded-md mb-2"
                  />
                  <p class="text-sm text-success">Front uploaded successfully</p>
                </div>
                <div v-else>
                  <svg class="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p class="text-sm text-muted-foreground mb-2">Upload front of Ghana Card</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  id="front-upload"
                  @change="(e) => handleFileSelect(e, 'front')"
                />
                <label
                  for="front-upload"
                  class="inline-block cursor-pointer"
                >
                  <Button
                    type="button"
                    size="sm"
                    :variant="form.ghanaCardFrontUrl ? 'outline' : 'default'"
                    as="span"
                  >
                    {{ form.ghanaCardFrontUrl ? 'Change Image' : 'Select Image' }}
                  </Button>
                </label>
              </div>
              <p v-if="fieldErrors.ghanaCardFront" class="text-xs text-destructive">
                {{ fieldErrors.ghanaCardFront }}
              </p>
            </div>

            <!-- Back (Optional) -->
            <div class="space-y-2">
              <Label>
                Ghana Card Back (Optional)
              </Label>
              <div
                class="border-2 border-dashed rounded-lg p-6 text-center transition-colors"
                :class="form.ghanaCardBackUrl ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'"
              >
                <div v-if="uploadingBack" class="text-muted-foreground">
                  Uploading...
                </div>
                <div v-else-if="form.ghanaCardBackUrl">
                  <img
                    :src="form.ghanaCardBackUrl"
                    alt="Ghana Card Back"
                    class="max-h-40 mx-auto rounded-md mb-2"
                  />
                  <p class="text-sm text-success">Back uploaded successfully</p>
                </div>
                <div v-else>
                  <svg class="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p class="text-sm text-muted-foreground mb-2">Upload back of Ghana Card</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  id="back-upload"
                  @change="(e) => handleFileSelect(e, 'back')"
                />
                <label
                  for="back-upload"
                  class="inline-block cursor-pointer"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    as="span"
                  >
                    {{ form.ghanaCardBackUrl ? 'Change Image' : 'Select Image' }}
                  </Button>
                </label>
              </div>
            </div>
          </div>

          <!-- Step 3: Office Details -->
          <div v-show="currentStep === 3" class="space-y-6">
            <h3 class="text-lg font-semibold text-foreground">Office Details</h3>

            <div class="space-y-2">
              <Label for="officeCategoryId">
                Public Office Category <span class="text-destructive">*</span>
              </Label>
              <select
                id="officeCategoryId"
                v-model="form.officeCategoryId"
                required
                class="w-full px-4 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                :class="{ 'border-destructive': fieldErrors.officeCategoryId }"
                @change="clearFieldError('officeCategoryId')"
              >
                <option :value="null" disabled>Select category</option>
                <option
                  v-for="cat in categories?.data || []"
                  :key="cat.id"
                  :value="cat.id"
                >
                  {{ cat.name }}
                </option>
              </select>
              <p v-if="fieldErrors.officeCategoryId" class="text-xs text-destructive">
                {{ fieldErrors.officeCategoryId }}
              </p>
              <p v-else class="text-xs text-muted-foreground">
                Article 286(5) of the 1992 Constitution
              </p>
            </div>

            <div class="space-y-2">
              <Label for="institutionId">
                Institution
              </Label>
              <select
                id="institutionId"
                v-model="form.institutionId"
                class="w-full px-4 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option :value="null">Select institution (optional)</option>
                <option
                  v-for="inst in institutions?.data || []"
                  :key="inst.id"
                  :value="inst.id"
                >
                  {{ inst.name }}
                </option>
              </select>
            </div>

            <div class="space-y-2">
              <Label for="designation">
                Designation / Position <span class="text-destructive">*</span>
              </Label>
              <Input
                id="designation"
                v-model="form.designation"
                type="text"
                required
                placeholder="e.g., Deputy Minister, Director, etc."
                :class="{ 'border-destructive': fieldErrors.designation }"
                @input="clearFieldError('designation')"
              />
              <p v-if="fieldErrors.designation" class="text-xs text-destructive">
                {{ fieldErrors.designation }}
              </p>
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
              type="submit"
              :disabled="isLoading"
            >
              <span v-if="isLoading">Creating...</span>
              <span v-else-if="currentStep === totalSteps">Complete Setup</span>
              <span v-else>Continue</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
