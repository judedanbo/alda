<script setup lang="ts">
import { displayId, type IdType } from "~/utils/displayId";

interface ProfileOffice {
  id: string;
  designation: string;
  officeCategory: { name: string } | null;
  institution: { name: string } | null;
}

interface ProfileData {
  fullName: string;
  idType: IdType;
  ghanaCardNumber: string | null;
  alternateIdNumber: string | null;
  offices: ProfileOffice[];
}

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const { isEmailVerified } = useAuth();

const isLoading = ref(false);
const error = ref("");
const createdDeclaration = ref<{ id: string; uniqueCode: string } | null>(null);

// Check for active declaration — redirect if one exists
const { data: statsData } = await useAsyncData(
  "declaration-new-check",
  () => authFetch<{ data: { activeDeclaration: { id: string } | null } }>("/api/declarations/stats"),
);

if (statsData.value?.data?.activeDeclaration) {
  await navigateTo("/applicant/dashboard", { replace: true });
}

// Fetch user profile
const { data: profileData, error: profileError } = await useAsyncData(
  "declaration-new-profile",
  () => authFetch<{ data: ProfileData }>("/api/profile"),
);

const profile = computed(() => profileData.value?.data);

// Create new declaration
const handleCreate = async () => {
  error.value = "";
  isLoading.value = true;

  try {
    const response = await authFetch<{ success: boolean; data: { id: string; uniqueCode: string } }>("/api/declarations", {
      method: "POST",
    });

    if (response.success) {
      createdDeclaration.value = {
        id: response.data.id,
        uniqueCode: response.data.uniqueCode,
      };
    }
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    error.value = e.data?.message || "Failed to create declaration";
  } finally {
    isLoading.value = false;
  }
};

</script>

<template>
  <div class="max-w-3xl mx-auto">
    <!-- No Profile Warning -->
    <Card v-if="profileError || !profile">
      <CardContent class="text-center p-6">
        <svg class="w-16 h-16 mx-auto text-warning mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 class="text-xl font-semibold text-foreground mb-2">Profile Required</h2>
        <p class="text-muted-foreground mb-6">
          You need to complete your profile before creating a declaration.
        </p>
        <Button as-child>
          <NuxtLink to="/applicant/profile/setup">Complete Profile</NuxtLink>
        </Button>
      </CardContent>
    </Card>

    <!-- Email Not Verified Warning -->
    <Card v-else-if="!isEmailVerified">
      <CardContent class="text-center p-6">
        <svg class="w-16 h-16 mx-auto text-warning mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h2 class="text-xl font-semibold text-foreground mb-2">Email Verification Required</h2>
        <p class="text-muted-foreground mb-6">
          Please verify your email address before creating a declaration. Check your inbox for the verification link.
        </p>
        <Button as-child>
          <NuxtLink to="/applicant/dashboard">Back to Dashboard</NuxtLink>
        </Button>
      </CardContent>
    </Card>

    <!-- Success State - Declaration Created -->
    <Card v-else-if="createdDeclaration">
      <CardContent class="p-8">
        <div class="text-center mb-8">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <svg class="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-foreground mb-2">Declaration Created</h2>
          <p class="text-muted-foreground">Your unique declaration code is:</p>
        </div>

        <div class="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-8">
          <p class="text-4xl font-bold text-primary text-center tracking-wider">
            {{ createdDeclaration.uniqueCode }}
          </p>
          <p class="text-sm text-muted-foreground text-center mt-3">
            This code has been sent to your email and phone
          </p>
        </div>

        <div class="bg-muted/50 rounded-lg p-4 mb-8">
          <h3 class="font-medium text-foreground mb-2">Important:</h3>
          <ul class="text-sm text-muted-foreground space-y-1">
            <li>Keep this code safe for tracking your declaration</li>
            <li>Collect your physical declaration form from any GAS office (headquarters or a regional office)</li>
            <li>A GAS officer will record the collection of your form against this code</li>
            <li>You'll need this code when collecting your receipt</li>
          </ul>
        </div>

        <div class="flex items-center justify-end">
          <Button as-child>
            <NuxtLink to="/applicant/declarations">Done</NuxtLink>
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Create Declaration Form -->
    <Card v-else data-tour="new-declaration-form">
      <CardHeader class="text-center">
        <CardTitle class="text-2xl">New Asset Declaration</CardTitle>
        <CardDescription>
          Create a new asset declaration under Article 286(5)
        </CardDescription>
      </CardHeader>
      <CardContent class="p-8 pt-0">
        <!-- Profile Summary -->
        <div class="bg-muted/50 rounded-lg p-6 mb-8">
          <h3 class="font-medium text-foreground mb-4 flex items-center gap-1.5">
            Declaration Details
            <HelpTip field-id="declaration.confirm" />
          </h3>
          <dl class="space-y-3">
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Full Name</dt>
              <dd class="font-medium text-foreground">{{ profile?.fullName }}</dd>
            </div>
            <div v-if="profile" class="flex justify-between">
              <dt class="text-muted-foreground">{{ displayId(profile).label }}</dt>
              <dd class="font-medium text-foreground">{{ displayId(profile).value }}</dd>
            </div>
          </dl>
          <div v-if="profile?.offices?.length" class="mt-4">
            <p class="text-sm text-muted-foreground mb-2">Office(s) Held:</p>
            <div
              v-for="office in profile.offices"
              :key="office.id"
              class="text-sm border-l-2 border-primary/30 pl-3 mb-2"
            >
              <p class="font-medium text-foreground">{{ office.designation }}</p>
              <p class="text-muted-foreground">{{ office.officeCategory?.name }}</p>
              <p v-if="office.institution" class="text-muted-foreground">{{ office.institution.name }}</p>
            </div>
          </div>
        </div>

        <!-- Terms -->
        <div class="bg-warning/5 border border-warning/20 rounded-lg p-4 mb-8">
          <p class="text-sm text-foreground">
            <strong>Declaration Statement:</strong> By creating this declaration, I confirm that
            all information provided is accurate and complete to the best of my knowledge.
            I understand that providing false information is a punishable offence under the laws of Ghana.
          </p>
        </div>

        <!-- Error Alert -->
        <Alert v-if="error" variant="destructive" class="mb-6">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <div class="flex items-center justify-between">
          <Button variant="ghost" as-child>
            <NuxtLink to="/applicant/dashboard">Cancel</NuxtLink>
          </Button>

          <Button
            :disabled="isLoading"
            @click="handleCreate"
          >
            <span v-if="isLoading">Creating...</span>
            <span v-else>Create Declaration</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
