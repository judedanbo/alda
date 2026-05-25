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
const { fieldErrors, clearFieldError, clearAll } = useFieldErrors();

const handleSubmit = async () => {
  error.value = "";
  clearAll();

  if (!email.value) {
    fieldErrors.email = "Email is required";
    return;
  }

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
    <Card>
      <!-- Success State -->
      <div v-if="success" class="text-center">
        <CardHeader class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <svg class="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <CardTitle class="text-2xl">Check your email</CardTitle>
          <CardDescription>
            If an account with that email exists, we've sent a password reset link. Please check your inbox and spam folder.
          </CardDescription>
        </CardHeader>
        <CardFooter class="justify-center">
          <Button as-child>
            <NuxtLink to="/auth/login">Back to login</NuxtLink>
          </Button>
        </CardFooter>
      </div>

      <!-- Form State -->
      <template v-else>
        <CardHeader class="text-center">
          <CardTitle class="text-2xl">Forgot password?</CardTitle>
          <CardDescription>Enter your email and we'll send you a reset link</CardDescription>
        </CardHeader>

        <CardContent>
          <form class="space-y-6" @submit.prevent="handleSubmit">
            <!-- Error Alert -->
            <Alert v-if="error" variant="destructive">
              <AlertDescription>{{ error }}</AlertDescription>
            </Alert>

            <!-- Email Field -->
            <FormField
              v-slot="{ id, ariaInvalid, ariaDescribedby }"
              label="Email address"
              :error="fieldErrors.email"
            >
              <Input
                :id="id"
                v-model="email"
                type="email"
                required
                autocomplete="email"
                placeholder="you@example.com"
                :aria-invalid="ariaInvalid"
                :aria-describedby="ariaDescribedby"
                @input="clearFieldError('email')"
              />
            </FormField>

            <!-- Submit Button -->
            <Button type="submit" class="w-full" :disabled="isLoading || !email">
              <span v-if="isLoading">Sending...</span>
              <span v-else>Send reset link</span>
            </Button>
          </form>
        </CardContent>

        <CardFooter class="flex-col gap-4">
          <p class="text-center text-sm text-muted-foreground">
            Remember your password?
            <NuxtLink to="/auth/login" class="text-primary font-medium hover:underline">
              Sign in
            </NuxtLink>
          </p>
        </CardFooter>
      </template>
    </Card>
  </div>
</template>
