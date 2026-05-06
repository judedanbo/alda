<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const { user, isEmailVerified, getAuthHeaders } = useAuth();

// Placeholder stats - will be populated from API
const stats = ref([
  { label: "Total Declarations", value: "0", icon: "file-text" },
  { label: "Pending Review", value: "0", icon: "clock" },
  { label: "Approved", value: "0", icon: "check-circle" },
  { label: "Rejected", value: "0", icon: "x-circle" },
]);

const recentDeclarations = ref<any[]>([]);

const resendLoading = ref(false);

async function resendVerification() {
  resendLoading.value = true;
  try {
    await $fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: getAuthHeaders(),
    });
    alert("Verification email sent! Check your inbox.");
  } catch (e: any) {
    alert(e.data?.message || "Failed to send verification email.");
  } finally {
    resendLoading.value = false;
  }
}
</script>

<template>
  <div class="space-y-8">
    <!-- Welcome Header -->
    <PageHeader
      :title="
        'Welcome back' + (user?.email ? ', ' + user.email.split('@')[0] : '')
      "
      description="Manage your asset declarations and track their status"
    />

    <!-- Email Verification Banner -->
    <div
      v-if="user && !isEmailVerified"
      class="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <svg
          class="w-5 h-5 text-amber-600 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <p class="font-medium text-amber-800">Please verify your email</p>
          <p class="text-sm text-amber-600">
            Check your inbox for the verification link, or request a new one.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        :disabled="resendLoading"
        @click="resendVerification"
      >
        {{ resendLoading ? "Sending..." : "Resend" }}
      </Button>
    </div>

    <!-- Profile Setup Alert -->
    <Alert v-if="!user?.hasProfile" class="border-warning/20 bg-warning/10">
      <svg
        class="w-5 h-5 text-warning"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <AlertTitle>Complete Your Profile</AlertTitle>
      <AlertDescription>
        <p>
          You need to complete your profile before you can submit asset
          declarations.
        </p>
        <Button as-child class="mt-3" size="sm">
          <NuxtLink to="/applicant/profile/setup">Complete Profile</NuxtLink>
        </Button>
      </AlertDescription>
    </Alert>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card v-for="stat in stats" :key="stat.label">
        <CardContent class="p-6">
          <p class="text-sm text-muted-foreground">{{ stat.label }}</p>
          <p class="text-3xl font-bold text-foreground mt-2">
            {{ stat.value }}
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- Quick Actions & Recent Declarations -->
    <div class="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle class="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="space-y-3">
            <NuxtLink
              to="/applicant/declaration/new"
              class="flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors"
              :class="{ 'opacity-50 pointer-events-none': !user?.hasProfile }"
            >
              <div
                class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <div>
                <p class="font-medium text-foreground">New Declaration</p>
                <p class="text-sm text-muted-foreground">
                  Submit a new asset declaration
                </p>
              </div>
            </NuxtLink>

            <NuxtLink
              to="/applicant/declarations"
              class="flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors"
            >
              <div
                class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <p class="font-medium text-foreground">View Declarations</p>
                <p class="text-sm text-muted-foreground">
                  See all your declarations
                </p>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="user?.hasProfile"
              to="/applicant/profile/edit"
              class="flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors"
            >
              <div
                class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <p class="font-medium text-foreground">Edit Profile</p>
                <p class="text-sm text-muted-foreground">
                  Update your office details
                </p>
              </div>
            </NuxtLink>
          </div>
        </CardContent>
      </Card>

      <!-- Recent Activity -->
      <Card>
        <CardHeader>
          <CardTitle class="text-lg">Recent Declarations</CardTitle>
        </CardHeader>
        <CardContent>
          <div v-if="recentDeclarations.length === 0" class="text-center py-8">
            <svg
              class="w-12 h-12 text-muted-foreground/30 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p class="text-sm text-muted-foreground">No declarations yet</p>
            <p class="text-xs text-muted-foreground mt-1">
              Your declarations will appear here once submitted
            </p>
          </div>
          <div v-else class="space-y-3">
            <!-- Declaration items would go here -->
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
