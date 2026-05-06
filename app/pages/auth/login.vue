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
    <Card>
      <CardHeader class="text-center">
        <CardTitle class="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>

      <CardContent>
        <form @submit.prevent="handleSubmit" class="space-y-6">
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
            />
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
            />
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
