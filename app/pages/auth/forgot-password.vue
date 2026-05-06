<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "auth",
});

const authStore = useAuthStore();

const email = ref("");
const error = ref("");
const success = ref(false);
const isLoading = ref(false);

const handleSubmit = async () => {
  error.value = "";
  isLoading.value = true;

  const result = await authStore.forgotPassword(email.value);

  if (result.success) {
    success.value = true;
  } else {
    error.value = result.error || "Failed to send reset email";
  }

  isLoading.value = false;
};
</script>

<template>
  <div class="w-full max-w-md">
    <div class="bg-card rounded-lg shadow-lg border p-8">
      <!-- Success State -->
      <div v-if="success" class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
          <svg class="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-foreground mb-2">Check your email</h2>
        <p class="text-muted-foreground mb-6">
          If an account with that email exists, we've sent a password reset link. Please check your inbox and spam folder.
        </p>
        <NuxtLink
          to="/auth/login"
          class="inline-block py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          Back to login
        </NuxtLink>
      </div>

      <!-- Form State -->
      <template v-else>
        <div class="text-center mb-8">
          <h2 class="text-2xl font-bold text-foreground">Forgot password?</h2>
          <p class="text-muted-foreground mt-2">
            Enter your email and we'll send you a reset link
          </p>
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
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading || !email"
            class="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="isLoading">Sending...</span>
            <span v-else>Send reset link</span>
          </button>
        </form>

        <!-- Back to Login -->
        <p class="mt-6 text-center text-sm text-muted-foreground">
          Remember your password?
          <NuxtLink to="/auth/login" class="text-primary font-medium hover:underline">
            Sign in
          </NuxtLink>
        </p>
      </template>
    </div>
  </div>
</template>
