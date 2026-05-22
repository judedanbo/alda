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
const { fieldErrors, clearFieldError, clearAll } = useFieldErrors();

const handleSubmit = async () => {
  error.value = "";
  clearAll();

  if (!form.email) fieldErrors.email = "Email is required";
  if (!form.password) fieldErrors.password = "Password is required";
  if (Object.keys(fieldErrors).length > 0) return;

  isLoading.value = true;

  const result = await authStore.login(form.email, form.password);

  if (result.success) {
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
    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (messages?.length) fieldErrors[field] = messages[0]!;
      }
    }
    if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
      error.value = result.error || "Login failed";
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
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <!-- Error Alert -->
          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>

          <!-- Email Field -->
          <div class="space-y-2">
            <Label for="email">Email address</Label>
            <Input
              id="email"
              v-model="form.email"
              type="email"
              required
              autocomplete="email"
              placeholder="you@example.com"
              :class="{ 'border-destructive': fieldErrors.email }"
              @input="clearFieldError('email')"
            />
            <p v-if="fieldErrors.email" class="text-xs text-destructive">
              {{ fieldErrors.email }}
            </p>
          </div>

          <!-- Password Field -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="password">Password</Label>
              <NuxtLink
                to="/auth/forgot-password"
                class="text-sm text-primary hover:underline"
              >
                Forgot password?
              </NuxtLink>
            </div>
            <Input
              id="password"
              v-model="form.password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="Enter your password"
              :class="{ 'border-destructive': fieldErrors.password }"
              @input="clearFieldError('password')"
            />
            <p v-if="fieldErrors.password" class="text-xs text-destructive">
              {{ fieldErrors.password }}
            </p>
          </div>

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
          <NuxtLink to="/auth/register" class="text-primary font-medium hover:underline">
            Create account
          </NuxtLink>
        </p>
      </CardFooter>
    </Card>
  </div>
</template>
