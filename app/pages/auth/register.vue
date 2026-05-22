<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "auth",
});

const authStore = useAuthStore();
const router = useRouter();

const form = reactive({
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
});

const error = ref("");
const isLoading = ref(false);
const submitted = ref(false);
const { fieldErrors, clearFieldError, clearAll } = useFieldErrors();

const passwordErrors = computed(() => {
  const errors: string[] = [];
  if (form.password.length > 0) {
    if (form.password.length < 8) {
      errors.push("At least 8 characters");
    }
    if (!/[A-Z]/.test(form.password)) {
      errors.push("One uppercase letter");
    }
    if (!/[a-z]/.test(form.password)) {
      errors.push("One lowercase letter");
    }
    if (!/[0-9]/.test(form.password)) {
      errors.push("One number");
    }
  }
  return errors;
});

const passwordsMatch = computed(() => {
  return form.password === form.confirmPassword;
});

const isFormValid = computed(() => {
  return (
    form.email &&
    form.password &&
    form.confirmPassword &&
    passwordErrors.value.length === 0 &&
    passwordsMatch.value &&
    form.acceptTerms
  );
});

const handleSubmit = async () => {
  submitted.value = true;
  clearAll();
  error.value = "";

  if (!form.email) fieldErrors.email = "Email is required";
  if (!form.password) fieldErrors.password = "Password is required";
  else if (passwordErrors.value.length > 0) fieldErrors.password = passwordErrors.value[0]!;
  if (!form.confirmPassword) fieldErrors.confirmPassword = "Please confirm your password";
  else if (!passwordsMatch.value) fieldErrors.confirmPassword = "Passwords do not match";
  if (!form.acceptTerms) fieldErrors.acceptTerms = "You must accept the terms";

  if (Object.keys(fieldErrors).length > 0) return;
  if (!isFormValid.value) return;

  isLoading.value = true;

  const result = await authStore.register(
    form.email,
    form.password,
    form.phone || undefined
  );

  if (result.success) {
    router.push("/applicant/profile/setup");
  } else {
    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (messages?.length) fieldErrors[field] = messages[0]!;
      }
    }
    if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
      error.value = result.error || "Registration failed";
    }
  }

  isLoading.value = false;
};
</script>

<template>
  <div class="w-full max-w-md">
    <Card>
      <CardHeader class="text-center">
        <CardTitle class="text-2xl">Create an account</CardTitle>
        <CardDescription>Register to submit your asset declaration</CardDescription>
      </CardHeader>

      <CardContent>
        <form class="space-y-5" @submit.prevent="handleSubmit">
          <!-- Error Alert -->
          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>

          <!-- Email Field -->
          <FormField
            v-slot="{ id, ariaInvalid, ariaDescribedby }"
            label="Email address"
            required
            :error="fieldErrors.email"
          >
            <Input
              :id="id"
              v-model="form.email"
              type="email"
              required
              autocomplete="email"
              placeholder="you@example.com"
              :aria-invalid="ariaInvalid"
              :aria-describedby="ariaDescribedby"
              @input="clearFieldError('email')"
            />
          </FormField>

          <!-- Phone Field -->
          <FormField
            v-slot="{ id, ariaInvalid, ariaDescribedby }"
            label="Phone number"
            hint="Ghana phone number format: +233XXXXXXXXX or 0XXXXXXXXX"
            :error="fieldErrors.phone"
          >
            <Input
              :id="id"
              v-model="form.phone"
              type="tel"
              autocomplete="tel"
              placeholder="+233 XX XXX XXXX"
              :aria-invalid="ariaInvalid"
              :aria-describedby="ariaDescribedby"
              @input="clearFieldError('phone')"
            />
          </FormField>

          <!-- Password Field -->
          <FormField
            v-slot="{ id, ariaInvalid, ariaDescribedby }"
            label="Password"
            required
            :error="fieldErrors.password"
          >
            <Input
              :id="id"
              v-model="form.password"
              type="password"
              required
              autocomplete="new-password"
              placeholder="Create a strong password"
              :aria-invalid="ariaInvalid"
              :aria-describedby="ariaDescribedby"
              @input="clearFieldError('password')"
            />
            <ul
              v-if="!fieldErrors.password && passwordErrors.length > 0"
              class="mt-1 space-y-1 text-xs text-destructive"
            >
              <li v-for="err in passwordErrors" :key="err">
                {{ err }}
              </li>
            </ul>
          </FormField>

          <!-- Confirm Password Field -->
          <FormField
            v-slot="{ id, ariaInvalid, ariaDescribedby }"
            label="Confirm password"
            required
            :error="fieldErrors.confirmPassword || (form.confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined)"
          >
            <Input
              :id="id"
              v-model="form.confirmPassword"
              type="password"
              required
              autocomplete="new-password"
              placeholder="Confirm your password"
              :aria-invalid="ariaInvalid"
              :aria-describedby="ariaDescribedby"
              @input="clearFieldError('confirmPassword')"
            />
          </FormField>

          <!-- Terms Checkbox -->
          <div>
            <div class="flex items-start gap-3">
              <Checkbox
                id="terms"
                v-model="form.acceptTerms"
                required
                class="mt-1"
                @update:model-value="clearFieldError('acceptTerms')"
              />
              <label for="terms" class="text-sm text-muted-foreground">
                I agree to the
                <NuxtLink to="/terms" class="text-primary hover:underline">Terms of Service</NuxtLink>
                and
                <NuxtLink to="/privacy" class="text-primary hover:underline">Privacy Policy</NuxtLink>
              </label>
            </div>
            <p v-if="fieldErrors.acceptTerms" class="text-xs text-destructive mt-1">
              {{ fieldErrors.acceptTerms }}
            </p>
          </div>

          <!-- Submit Button -->
          <Button type="submit" class="w-full" :disabled="isLoading || !isFormValid">
            <span v-if="isLoading">Creating account...</span>
            <span v-else>Create account</span>
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
    </Card>
  </div>
</template>
