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

    const response = await $fetch("/api/upload/ghana-card", {
      method: "POST",
      body: formData,
      headers: authStore.getAuthHeaders(),
    });

    if (response.success) {
      if (side === "front") {
        form.ghanaCardFrontUrl = response.data.url;
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

// Go to next step
const nextStep = () => {
  if (currentStep.value < totalSteps && isStepValid.value) {
    currentStep.value++;
  }
};

// Go to previous step
const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
};

// Submit profile
const handleSubmit = async () => {
  if (!isStepValid.value) return;

  error.value = "";
  isLoading.value = true;

  try {
    const response = await $fetch("/api/profile", {
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
      headers: authStore.getAuthHeaders(),
    });

    if (response.success) {
      // Refresh user data
      await authStore.fetchUser();
      router.push("/applicant/dashboard");
    }
  } catch (err: any) {
    error.value = err.data?.message || "Failed to create profile";
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="w-full max-w-2xl">
    <div class="bg-card rounded-lg shadow-lg border p-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold text-foreground">Complete Your Profile</h2>
        <p class="text-muted-foreground mt-2">
          Step {{ currentStep }} of {{ totalSteps }}
        </p>
      </div>

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
      <div
        v-if="error"
        class="mb-6 p-4 rounded-md bg-destructive/10 text-destructive text-sm"
      >
        {{ error }}
      </div>

      <form novalidate @submit.prevent="currentStep === totalSteps ? handleSubmit() : nextStep()">
        <!-- Step 1: Personal Information -->
        <div v-show="currentStep === 1" class="space-y-6">
          <h3 class="text-lg font-semibold text-foreground">Personal Information</h3>

          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">
              Full Name (as on Ghana Card) <span class="text-destructive">*</span>
            </label>
            <input
              v-model="form.fullName"
              type="text"
              required
              class="w-full px-4 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              :class="{ 'border-destructive': form.fullName && form.fullName.length < 2 }"
              placeholder="Enter your full name"
            />
            <p v-if="form.fullName && form.fullName.length < 2" class="text-xs text-destructive">
              Name must be at least 2 characters
            </p>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">
              Ghana Card Number <span class="text-destructive">*</span>
            </label>
            <input
              v-model="form.ghanaCardNumber"
              type="text"
              required
              class="w-full px-4 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary uppercase"
              :class="{ 'border-destructive': form.ghanaCardNumber && !isGhanaCardValid }"
              placeholder="GHA-XXXXXXXXX-X"
            />
            <p v-if="form.ghanaCardNumber && !isGhanaCardValid" class="text-xs text-destructive">
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
            <label class="text-sm font-medium text-foreground">
              Ghana Card Front <span class="text-destructive">*</span>
            </label>
            <div
              class="border-2 border-dashed rounded-lg p-6 text-center transition-colors"
              :class="form.ghanaCardFrontUrl ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'"
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
                :id="'front-upload'"
                @change="(e) => handleFileSelect(e, 'front')"
              />
              <label
                for="front-upload"
                class="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors"
              >
                {{ form.ghanaCardFrontUrl ? 'Change Image' : 'Select Image' }}
              </label>
            </div>
          </div>

          <!-- Back (Optional) -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">
              Ghana Card Back (Optional)
            </label>
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
                :id="'back-upload'"
                @change="(e) => handleFileSelect(e, 'back')"
              />
              <label
                for="back-upload"
                class="inline-block px-4 py-2 bg-muted text-foreground rounded-md text-sm font-medium cursor-pointer hover:bg-muted/80 transition-colors"
              >
                {{ form.ghanaCardBackUrl ? 'Change Image' : 'Select Image' }}
              </label>
            </div>
          </div>
        </div>

        <!-- Step 3: Office Details -->
        <div v-show="currentStep === 3" class="space-y-6">
          <h3 class="text-lg font-semibold text-foreground">Office Details</h3>

          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">
              Public Office Category <span class="text-destructive">*</span>
            </label>
            <select
              v-model="form.officeCategoryId"
              required
              class="w-full px-4 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
            <p class="text-xs text-muted-foreground">
              Article 286(5) of the 1992 Constitution
            </p>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">
              Institution
            </label>
            <select
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
            <label class="text-sm font-medium text-foreground">
              Designation / Position <span class="text-destructive">*</span>
            </label>
            <input
              v-model="form.designation"
              type="text"
              required
              class="w-full px-4 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., Deputy Minister, Director, etc."
            />
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="flex items-center justify-between mt-8 pt-6 border-t">
          <button
            v-if="currentStep > 1"
            type="button"
            class="px-4 py-2 text-foreground rounded-md hover:bg-muted transition-colors"
            @click="prevStep"
          >
            Back
          </button>
          <div v-else />

          <button
            type="submit"
            :disabled="!isStepValid || isLoading"
            class="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="isLoading">Creating...</span>
            <span v-else-if="currentStep === totalSteps">Complete Setup</span>
            <span v-else>Continue</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
