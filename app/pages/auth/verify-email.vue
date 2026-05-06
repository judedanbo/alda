<script setup lang="ts">
definePageMeta({
  layout: "auth",
});

const route = useRoute();
const token = computed(() => route.query.token as string | undefined);

const status = ref<"loading" | "success" | "error">("loading");
const message = ref("");

onMounted(async () => {
  if (!token.value) {
    status.value = "error";
    message.value = "No verification token found. Please check your email link.";
    return;
  }

  try {
    const result = await $fetch<{ success: boolean; message?: string }>(
      `/api/auth/verify-email?token=${encodeURIComponent(token.value)}`
    );
    message.value = result.message || "Your email has been verified.";
    status.value = "success";
  } catch (err: unknown) {
    const e = err as { data?: { message?: string }; message?: string };
    message.value =
      e?.data?.message || e?.message || "Verification failed. The link may have expired.";
    status.value = "error";
  }
});
</script>

<template>
  <div class="w-full max-w-md">
    <div class="bg-card rounded-lg shadow-lg border p-8">
      <!-- Loading State -->
      <div v-if="status === 'loading'" class="text-center py-4">
        <div class="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <svg
            class="w-10 h-10 text-primary animate-spin"
            fill="none"
            viewBox="0 0 24 24"
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
        <h2 class="text-2xl font-bold text-foreground mb-2">Verifying your email...</h2>
        <p class="text-muted-foreground">Please wait a moment.</p>
      </div>

      <!-- Success State -->
      <div v-else-if="status === 'success'" class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
          <svg class="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-foreground mb-2">Email Verified!</h2>
        <p class="text-muted-foreground mb-6">{{ message }}</p>
        <NuxtLink
          to="/auth/login"
          class="inline-block py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          Sign in
        </NuxtLink>
      </div>

      <!-- Error State -->
      <div v-else class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg class="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-foreground mb-2">Verification Failed</h2>
        <p class="text-muted-foreground mb-6">{{ message }}</p>
        <NuxtLink
          to="/auth/login"
          class="inline-block py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          Back to login
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
