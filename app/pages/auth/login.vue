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

const isLoading = ref(false);
const { toast } = useToast();
const { fieldErrors, clearFieldError, clearAll } = useFieldErrors();

const handleSubmit = async () => {
  clearAll();

  if (!form.email) fieldErrors.email = "Email is required";
  if (!form.password) fieldErrors.password = "Password is required";
  if (Object.keys(fieldErrors).length > 0) return;

  isLoading.value = true;

  const result = await authStore.login(form.email, form.password);

  if (result.success) {
    toast.success("Signed in successfully.");
    // New applicants without a profile go to setup first; everyone else
    // (and applicants who already have a profile) goes to their dashboard.
    if (authStore.dashboardPath === "/applicant/dashboard" && !result.hasProfile) {
      router.push("/applicant/profile/setup");
    } else {
      router.push(authStore.dashboardPath);
    }
  } else {
    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (messages?.length) fieldErrors[field] = messages[0]!;
      }
    }
    if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
      toast.error(result.error || "Login failed");
    }
  }

  isLoading.value = false;
};
</script>

<template>
  <div class="w-full max-w-md">
    <Card>
      <CardHeader class="text-center">
        <CardTitle class="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>

      <CardContent>
        <form class="space-y-6" data-tour="auth-login-form" @submit.prevent="handleSubmit">
          <!-- Email Field -->
          <FormField
            v-slot="{ id, ariaInvalid, ariaDescribedby }"
            label="Email address"
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

          <!-- Password Field -->
          <FormField for="password" :error="fieldErrors.password">
            <template #label>
              <div class="flex items-center justify-between w-full">
                <span>Password</span>
                <NuxtLink
                  to="/auth/forgot-password"
                  data-tour="auth-forgot-link"
                  class="text-sm text-primary hover:underline font-normal"
                >
                  Forgot password?
                </NuxtLink>
              </div>
            </template>
            <template #default="{ id, ariaInvalid, ariaDescribedby }">
              <Input
                :id="id"
                v-model="form.password"
                type="password"
                required
                autocomplete="current-password"
                placeholder="Enter your password"
                :aria-invalid="ariaInvalid"
                :aria-describedby="ariaDescribedby"
                @input="clearFieldError('password')"
              />
            </template>
          </FormField>

          <!-- Submit Button -->
          <Button type="submit" class="w-full" :disabled="isLoading">
            <span v-if="isLoading">Signing in...</span>
            <span v-else>Sign in</span>
          </Button>
        </form>
      </CardContent>

      <CardFooter class="flex-col gap-4">
        <p class="text-center text-sm text-muted-foreground">
          Don't have an account?
          <NuxtLink to="/auth/register" data-tour="auth-register-link" class="text-primary font-medium hover:underline">
            Create account
          </NuxtLink>
        </p>
      </CardFooter>
    </Card>
  </div>
</template>
