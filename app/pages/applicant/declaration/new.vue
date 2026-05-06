<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const { getAuthHeaders } = useAuth();
const router = useRouter();

const isLoading = ref(false);
const error = ref("");
const createdDeclaration = ref<{ id: string; uniqueCode: string } | null>(null);

// Fetch user profile
const { data: profileData, error: profileError } = await useFetch("/api/profile", {
  headers: getAuthHeaders(),
});

const profile = computed(() => profileData.value?.data);

// Create new declaration
const handleCreate = async () => {
  error.value = "";
  isLoading.value = true;

  try {
    const response = await $fetch("/api/declarations", {
      method: "POST",
      headers: getAuthHeaders(),
    });

    if (response.success) {
      createdDeclaration.value = {
        id: response.data.id,
        uniqueCode: response.data.uniqueCode,
      };
    }
  } catch (err: any) {
    error.value = err.data?.message || "Failed to create declaration";
  } finally {
    isLoading.value = false;
  }
};

// Submit declaration
const handleSubmit = async () => {
  if (!createdDeclaration.value) return;

  error.value = "";
  isLoading.value = true;

  try {
    const response = await $fetch(`/api/declarations/${createdDeclaration.value.id}/submit`, {
      method: "POST",
      headers: getAuthHeaders(),
    });

    if (response.success) {
      router.push(`/applicant/declaration/${createdDeclaration.value.id}`);
    }
  } catch (err: any) {
    error.value = err.data?.message || "Failed to submit declaration";
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
        <svg class="w-16 h-16 mx-auto text-warning mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

    <!-- Success State - Declaration Created -->
    <Card v-else-if="createdDeclaration">
      <CardContent class="p-8">
        <div class="text-center mb-8">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <svg class="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <li>You'll need it when collecting your receipt</li>
            <li>Reference this code in any correspondence</li>
          </ul>
        </div>

        <!-- Error Alert -->
        <Alert v-if="error" variant="destructive" class="mb-6">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <div class="flex items-center justify-between">
          <Button variant="ghost" as-child>
            <NuxtLink to="/applicant/declarations">View All Declarations</NuxtLink>
          </Button>

          <Button
            :disabled="isLoading"
            @click="handleSubmit"
          >
            <span v-if="isLoading">Submitting...</span>
            <span v-else>Submit for Review</span>
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Create Declaration Form -->
    <Card v-else>
      <CardHeader class="text-center">
        <CardTitle class="text-2xl">New Asset Declaration</CardTitle>
        <CardDescription>
          Create a new asset declaration under Article 286(5)
        </CardDescription>
      </CardHeader>
      <CardContent class="p-8 pt-0">
        <!-- Profile Summary -->
        <div class="bg-muted/50 rounded-lg p-6 mb-8">
          <h3 class="font-medium text-foreground mb-4">Declaration Details</h3>
          <dl class="space-y-3">
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Full Name</dt>
              <dd class="font-medium text-foreground">{{ profile?.fullName }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Ghana Card</dt>
              <dd class="font-medium text-foreground">{{ profile?.ghanaCardNumber }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Office Category</dt>
              <dd class="font-medium text-foreground">{{ profile?.officeCategory?.name }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Designation</dt>
              <dd class="font-medium text-foreground">{{ profile?.designation }}</dd>
            </div>
            <div v-if="profile?.institution" class="flex justify-between">
              <dt class="text-muted-foreground">Institution</dt>
              <dd class="font-medium text-foreground">{{ profile?.institution?.name }}</dd>
            </div>
          </dl>
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
