<script setup lang="ts">
definePageMeta({
  layout: "auth",
});

const route = useRoute();
const token = computed(() => route.query.token as string | undefined);

const password = ref("");
const confirmPassword = ref("");
const error = ref("");
const success = ref(false);
const isLoading = ref(false);

const passwordStrength = computed(() => {
  const p = password.value;
  return {
    hasMinLength: p.length >= 8,
    hasUppercase: /[A-Z]/.test(p),
    hasLowercase: /[a-z]/.test(p),
    hasDigit: /[0-9]/.test(p),
  };
});

const isPasswordValid = computed(() =>
  Object.values(passwordStrength.value).every(Boolean)
);

const passwordsMatch = computed(
  () => confirmPassword.value === "" || password.value === confirmPassword.value
);

const canSubmit = computed(
  () =>
    token.value &&
    isPasswordValid.value &&
    password.value === confirmPassword.value &&
    confirmPassword.value !== ""
);

const handleSubmit = async () => {
  error.value = "";
  isLoading.value = true;

  try {
    await $fetch("/api/auth/reset-password", {
      method: "POST",
      body: { token: token.value, password: password.value },
    });
    success.value = true;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string }; message?: string };
    error.value =
      e?.data?.message || e?.message || "Failed to reset password. Please try again.";
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="w-full max-w-md">
    <Card>
      <!-- No Token State -->
      <div v-if="!token" class="text-center">
        <CardHeader class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg class="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <CardTitle class="text-2xl">Invalid reset link</CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardFooter class="justify-center">
          <Button as-child>
            <NuxtLink to="/auth/forgot-password">Request a new link</NuxtLink>
          </Button>
        </CardFooter>
      </div>

      <!-- Success State -->
      <div v-else-if="success" class="text-center">
        <CardHeader class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <svg class="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <CardTitle class="text-2xl">Password Reset Successfully</CardTitle>
          <CardDescription>
            Your password has been updated. You can now sign in with your new password.
          </CardDescription>
        </CardHeader>
        <CardFooter class="justify-center">
          <Button as-child>
            <NuxtLink to="/auth/login">Sign in</NuxtLink>
          </Button>
        </CardFooter>
      </div>

      <!-- Form State -->
      <template v-else>
        <CardHeader class="text-center">
          <CardTitle class="text-2xl">Reset your password</CardTitle>
          <CardDescription>Enter a new password for your account</CardDescription>
        </CardHeader>

        <CardContent>
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Error Alert -->
            <Alert v-if="error" variant="destructive">
              <AlertDescription>{{ error }}</AlertDescription>
            </Alert>

            <!-- New Password Field -->
            <div class="space-y-2">
              <Label for="password">New password</Label>
              <Input
                id="password"
                v-model="password"
                type="password"
                required
                autocomplete="new-password"
                placeholder="Enter new password"
              />

              <!-- Strength Indicators -->
              <div v-if="password" class="space-y-1 mt-2">
                <div class="flex items-center gap-2 text-xs">
                  <svg
                    class="w-3.5 h-3.5 shrink-0"
                    :class="passwordStrength.hasMinLength ? 'text-success' : 'text-muted-foreground'"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      v-if="passwordStrength.hasMinLength"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                    <circle v-else cx="12" cy="12" r="9" stroke-width="2" />
                  </svg>
                  <span :class="passwordStrength.hasMinLength ? 'text-success' : 'text-muted-foreground'">
                    At least 8 characters
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  <svg
                    class="w-3.5 h-3.5 shrink-0"
                    :class="passwordStrength.hasUppercase ? 'text-success' : 'text-muted-foreground'"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      v-if="passwordStrength.hasUppercase"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                    <circle v-else cx="12" cy="12" r="9" stroke-width="2" />
                  </svg>
                  <span :class="passwordStrength.hasUppercase ? 'text-success' : 'text-muted-foreground'">
                    One uppercase letter
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  <svg
                    class="w-3.5 h-3.5 shrink-0"
                    :class="passwordStrength.hasLowercase ? 'text-success' : 'text-muted-foreground'"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      v-if="passwordStrength.hasLowercase"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                    <circle v-else cx="12" cy="12" r="9" stroke-width="2" />
                  </svg>
                  <span :class="passwordStrength.hasLowercase ? 'text-success' : 'text-muted-foreground'">
                    One lowercase letter
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  <svg
                    class="w-3.5 h-3.5 shrink-0"
                    :class="passwordStrength.hasDigit ? 'text-success' : 'text-muted-foreground'"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      v-if="passwordStrength.hasDigit"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                    <circle v-else cx="12" cy="12" r="9" stroke-width="2" />
                  </svg>
                  <span :class="passwordStrength.hasDigit ? 'text-success' : 'text-muted-foreground'">
                    One number
                  </span>
                </div>
              </div>
            </div>

            <!-- Confirm Password Field -->
            <div class="space-y-2">
              <Label for="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                v-model="confirmPassword"
                type="password"
                required
                autocomplete="new-password"
                :class="{ 'border-destructive focus:ring-destructive': confirmPassword && !passwordsMatch }"
                placeholder="Confirm new password"
              />
              <p v-if="confirmPassword && !passwordsMatch" class="text-xs text-destructive">
                Passwords do not match
              </p>
            </div>

            <!-- Submit Button -->
            <Button type="submit" class="w-full" :disabled="isLoading || !canSubmit">
              <span v-if="isLoading">Resetting...</span>
              <span v-else>Reset password</span>
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
