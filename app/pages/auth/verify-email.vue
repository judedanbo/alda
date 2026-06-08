<script setup lang="ts">
definePageMeta({
  layout: "auth",
});

const route = useRoute();
const token = computed(() => route.query.token as string | undefined);

const status = ref<"loading" | "success" | "error">("loading");
const message = ref("");
const { toast } = useToast();

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
    toast.success(message.value);
  } catch (err: unknown) {
    const e = err as { data?: { message?: string }; message?: string };
    message.value =
      e?.data?.message || e?.message || "Verification failed. The link may have expired.";
    status.value = "error";
    toast.error(message.value);
  }
});
</script>

<template>
  <div class="w-full max-w-md">
    <Card role="status" aria-live="polite">
      <!-- Loading State -->
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
          <CardTitle class="text-2xl">Verifying your email...</CardTitle>
          <CardDescription>Please wait a moment.</CardDescription>
        </CardHeader>
      </div>

      <!-- Success State -->
      <div v-else-if="status === 'success'" class="text-center">
        <CardHeader class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <svg class="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <CardTitle class="text-2xl">Email Verified!</CardTitle>
          <CardDescription>{{ message }}</CardDescription>
        </CardHeader>
        <CardFooter class="justify-center">
          <Button as-child>
            <NuxtLink to="/auth/login">Sign in</NuxtLink>
          </Button>
        </CardFooter>
      </div>

      <!-- Error State -->
      <div v-else class="text-center">
        <CardHeader class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg class="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <CardTitle class="text-2xl">Verification Failed</CardTitle>
          <CardDescription>{{ message }}</CardDescription>
        </CardHeader>
        <CardFooter class="justify-center">
          <Button as-child>
            <NuxtLink to="/auth/login">Back to login</NuxtLink>
          </Button>
        </CardFooter>
      </div>
    </Card>
  </div>
</template>
