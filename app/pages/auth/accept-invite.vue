<script setup lang="ts">
definePageMeta({
  layout: "auth",
});

const route = useRoute();
const token = computed(() => route.query.token as string | undefined);

// Three-phase state: verifying the token on mount, then ready to set password, or error
const status = ref<"loading" | "ready" | "error">("loading");
const verifyError = ref("");
const verifiedEmail = ref("");

const password = ref("");
const confirmPassword = ref("");
const submitError = ref("");
const success = ref(false);
const isLoading = ref(false);
const { fieldErrors, clearFieldError, clearAll, handleServerError } = useFieldErrors();

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

onMounted(async () => {
  if (!token.value) {
    verifyError.value = "This invitation link is invalid. Please contact an administrator to resend the invite.";
    status.value = "error";
    return;
  }

  try {
    const result = await $fetch<{ success: boolean; email: string }>(
      "/api/auth/accept-invite",
      { method: "POST", body: { token: token.value } }
    );
    verifiedEmail.value = result.email;
    status.value = "ready";
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string }; message?: string };
    verifyError.value =
      e?.data?.message ||
      e?.data?.statusMessage ||
      e?.message ||
      "This invitation link is invalid or has expired. Ask an administrator to resend it.";
    status.value = "error";
  }
});

const handleSubmit = async () => {
  submitError.value = "";
  clearAll();

  if (!password.value) {
    fieldErrors.password = "Password is required";
  } else if (!isPasswordValid.value) {
    fieldErrors.password = "Password does not meet requirements";
  }
  if (!confirmPassword.value) {
    fieldErrors.confirmPassword = "Please confirm your password";
  } else if (password.value !== confirmPassword.value) {
    fieldErrors.confirmPassword = "Passwords do not match";
  }
  if (Object.keys(fieldErrors).length > 0) return;

  isLoading.value = true;

  try {
    await $fetch("/api/auth/reset-password", {
      method: "POST",
      body: { token: token.value, password: password.value },
    });
    success.value = true;
  } catch (err: unknown) {
    submitError.value = handleServerError(err);
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="w-full max-w-md">
    <Card role="status" aria-live="polite">
      <!-- Loading / Verifying State -->
      <div v-if="status === 'loading'" class="text-center py-4">
        <CardHeader class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <svg
              class="w-10 h-10 text-primary animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
          <CardTitle class="text-2xl">Verifying your invitation...</CardTitle>
          <CardDescription>Please wait a moment.</CardDescription>
        </CardHeader>
      </div>

      <!-- Error State (bad/missing/expired token) -->
      <div v-else-if="status === 'error'" class="text-center">
        <CardHeader class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg class="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <CardTitle class="text-2xl">Invalid Invitation Link</CardTitle>
          <CardDescription>{{ verifyError }}</CardDescription>
        </CardHeader>
        <CardFooter class="justify-center">
          <Button as-child>
            <NuxtLink to="/auth/login">Back to login</NuxtLink>
          </Button>
        </CardFooter>
      </div>

      <!-- Success State (password set) -->
      <div v-else-if="success" class="text-center">
        <CardHeader class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <svg class="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <CardTitle class="text-2xl">Account Activated</CardTitle>
          <CardDescription>
            Your password has been set. You can now sign in with your new password.
          </CardDescription>
        </CardHeader>
        <CardFooter class="justify-center">
          <Button as-child>
            <NuxtLink to="/auth/login">Sign in</NuxtLink>
          </Button>
        </CardFooter>
      </div>

      <!-- Ready State: set-password form -->
      <template v-else>
        <CardHeader class="text-center">
          <CardTitle class="text-2xl">Set your password</CardTitle>
          <CardDescription>
            Email verified — set your password to finish activating your account.
            <span v-if="verifiedEmail" class="block mt-1 font-medium text-foreground">{{ verifiedEmail }}</span>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form class="space-y-6" @submit.prevent="handleSubmit">
            <!-- Error Alert -->
            <Alert v-if="submitError" variant="destructive">
              <AlertDescription>{{ submitError }}</AlertDescription>
            </Alert>

            <!-- Password Field -->
            <FormField
              v-slot="{ id, ariaInvalid, ariaDescribedby }"
              label="Password"
              :error="fieldErrors.password"
            >
              <Input
                :id="id"
                v-model="password"
                type="password"
                required
                autocomplete="new-password"
                placeholder="Enter password"
                :aria-invalid="ariaInvalid"
                :aria-describedby="ariaDescribedby"
                @input="clearFieldError('password')"
              />

              <!-- Strength Indicators -->
              <div v-if="password && !fieldErrors.password" class="space-y-1 mt-2">
                <div class="flex items-center gap-2 text-xs">
                  <svg
                    class="w-3.5 h-3.5 shrink-0"
                    :class="passwordStrength.hasMinLength ? 'text-success' : 'text-muted-foreground'"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
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
                  <span class="sr-only">
                    {{ passwordStrength.hasMinLength ? "(met)" : "(not met)" }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  <svg
                    class="w-3.5 h-3.5 shrink-0"
                    :class="passwordStrength.hasUppercase ? 'text-success' : 'text-muted-foreground'"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
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
                  <span class="sr-only">
                    {{ passwordStrength.hasUppercase ? "(met)" : "(not met)" }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  <svg
                    class="w-3.5 h-3.5 shrink-0"
                    :class="passwordStrength.hasLowercase ? 'text-success' : 'text-muted-foreground'"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
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
                  <span class="sr-only">
                    {{ passwordStrength.hasLowercase ? "(met)" : "(not met)" }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  <svg
                    class="w-3.5 h-3.5 shrink-0"
                    :class="passwordStrength.hasDigit ? 'text-success' : 'text-muted-foreground'"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
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
                  <span class="sr-only">
                    {{ passwordStrength.hasDigit ? "(met)" : "(not met)" }}
                  </span>
                </div>
              </div>
            </FormField>

            <!-- Confirm Password Field -->
            <FormField
              v-slot="{ id, ariaInvalid, ariaDescribedby }"
              label="Confirm password"
              :error="fieldErrors.confirmPassword || (confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined)"
            >
              <Input
                :id="id"
                v-model="confirmPassword"
                type="password"
                required
                autocomplete="new-password"
                placeholder="Confirm password"
                :aria-invalid="ariaInvalid"
                :aria-describedby="ariaDescribedby"
                @input="clearFieldError('confirmPassword')"
              />
            </FormField>

            <!-- Submit Button -->
            <Button type="submit" class="w-full" :disabled="isLoading || !canSubmit">
              <span v-if="isLoading">Activating...</span>
              <span v-else>Activate account</span>
            </Button>
          </form>
        </CardContent>

        <CardFooter class="flex-col gap-4">
          <p class="text-center text-sm text-muted-foreground">
            Already have an account?
            <NuxtLink to="/auth/login" class="text-primary font-medium hover:underline">
              Sign in
            </NuxtLink>
          </p>
        </CardFooter>
      </template>
    </Card>
  </div>
</template>
