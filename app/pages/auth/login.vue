<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "auth",
});

const authStore = useAuthStore();
const router = useRouter();

const form = reactive({
  email: "",
  password: "",
});

const error = ref("");
const isLoading = ref(false);

const handleSubmit = async () => {
  error.value = "";
  isLoading.value = true;

  const result = await authStore.login(form.email, form.password);

  if (result.success) {
    // Redirect based on user role
    if (authStore.isAdmin) {
      router.push("/admin/dashboard");
    } else if (authStore.isOfficer) {
      router.push("/officer/dashboard");
    } else if (authStore.isLegalUnit) {
      router.push("/legal/dashboard");
    } else if (result.hasProfile) {
      router.push("/applicant/dashboard");
    } else {
      router.push("/applicant/profile/setup");
    }
  } else {
    error.value = result.error || "Login failed";
  }

  isLoading.value = false;
};
</script>

<template>
  <div class="w-full max-w-md">
    <div class="bg-card rounded-lg shadow-lg border p-8">
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold text-foreground">Welcome back</h2>
        <p class="text-muted-foreground mt-2">Sign in to your account</p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Error Alert -->
        <div
          v-if="error"
          class="p-4 rounded-md bg-destructive/10 text-destructive text-sm"
        >
          {{ error }}
        </div>

        <!-- Email Field -->
        <div class="space-y-2">
          <label for="email" class="text-sm font-medium text-foreground">
            Email address
          </label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            required
            autocomplete="email"
            class="w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <!-- Password Field -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label for="password" class="text-sm font-medium text-foreground">
              Password
            </label>
            <NuxtLink
              to="/auth/forgot-password"
              class="text-sm text-primary hover:underline"
            >
              Forgot password?
            </NuxtLink>
          </div>
          <input
            id="password"
            v-model="form.password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Enter your password"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isLoading"
          class="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span v-if="isLoading">Signing in...</span>
          <span v-else>Sign in</span>
        </button>
      </form>

      <!-- Register Link -->
      <p class="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?
        <NuxtLink to="/auth/register" class="text-primary font-medium hover:underline">
          Create account
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
