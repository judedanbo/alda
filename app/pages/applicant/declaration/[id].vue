<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();
const { getAuthHeaders } = useAuth();

const id = route.params.id as string;

// Fetch declaration status
const { data, pending, error, refresh } = await useFetch(`/api/declarations/${id}/status`, {
  headers: getAuthHeaders(),
});

const declaration = computed(() => data.value?.data);

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Timeline icon based on status
const getTimelineIcon = (status: string) => {
  const icons: Record<string, string> = {
    CREATED: "M12 4v16m8-8H4",
    SUBMITTED: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
    RECORDED: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    APPROVED: "M5 13l4 4L19 7",
    REJECTED: "M6 18L18 6M6 6l12 12",
    RECEIPT_READY: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    SEALED: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  };
  return icons[status] || icons.CREATED;
};
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <!-- Back Link -->
    <Button variant="ghost" as-child class="mb-6">
      <NuxtLink to="/applicant/declarations" class="inline-flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Declarations
      </NuxtLink>
    </Button>

    <!-- Loading -->
    <div v-if="pending" class="space-y-6">
      <Card>
        <CardContent class="p-6">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div class="space-y-2">
              <Skeleton class="h-4 w-28" />
              <Skeleton class="h-9 w-52" />
            </div>
            <Skeleton class="h-8 w-32 rounded-full" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-6">
          <Skeleton class="h-6 w-48 mb-6" />
          <div class="space-y-6">
            <div v-for="n in 3" :key="n" class="flex gap-4">
              <Skeleton class="h-8 w-8 rounded-full" />
              <div class="flex-1 space-y-2">
                <Skeleton class="h-5 w-40" />
                <Skeleton class="h-4 w-64" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Error -->
    <Card v-else-if="error" class="text-center py-12">
      <CardContent>
        <p class="text-destructive mb-4">Failed to load declaration</p>
        <Button variant="link" @click="refresh()">
          Try again
        </Button>
      </CardContent>
    </Card>

    <!-- Declaration Details -->
    <template v-else-if="declaration">
      <!-- Header Card -->
      <Card class="mb-6">
        <CardContent class="p-6">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p class="text-sm text-muted-foreground mb-1">Declaration Code</p>
              <h1 class="text-3xl font-bold font-mono text-foreground">
                {{ declaration.uniqueCode }}
              </h1>
            </div>
            <StatusBadge :status="declaration.status" />
          </div>
        </CardContent>
      </Card>

      <!-- Rejection Reason -->
      <Alert
        v-if="declaration.latestReview?.status === 'REJECTED'"
        variant="destructive"
        class="mb-6"
      >
        <AlertTitle>Rejection Reason</AlertTitle>
        <AlertDescription>{{ declaration.latestReview.rejectionReason }}</AlertDescription>
      </Alert>

      <!-- Receipt Info -->
      <Alert
        v-if="declaration.receipt"
        class="mb-6 border-success/20 bg-success/10"
      >
        <AlertTitle class="text-success">Receipt Ready</AlertTitle>
        <AlertDescription>
          Receipt Number: <span class="font-mono font-bold">{{ declaration.receipt.receiptNumber }}</span>
        </AlertDescription>
      </Alert>

      <!-- Timeline -->
      <Card>
        <CardHeader>
          <CardTitle class="text-lg">Declaration Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="relative">
            <!-- Timeline line -->
            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />

            <!-- Timeline items -->
            <div class="space-y-6">
              <div
                v-for="(event, index) in declaration.timeline"
                :key="index"
                class="relative flex gap-4"
              >
                <!-- Icon -->
                <div
                  class="relative z-10 w-8 h-8 rounded-full flex items-center justify-center"
                  :class="[
                    index === declaration.timeline.length - 1
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  ]"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      :d="getTimelineIcon(event.status)"
                    />
                  </svg>
                </div>

                <!-- Content -->
                <div class="flex-1 pb-6">
                  <div class="flex items-start justify-between">
                    <div>
                      <h3 class="font-medium text-foreground">{{ event.title }}</h3>
                      <p class="text-sm text-muted-foreground mt-1">{{ event.description }}</p>
                    </div>
                    <time class="text-sm text-muted-foreground whitespace-nowrap ml-4">
                      {{ formatDate(event.date) }}
                    </time>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Actions -->
      <div
        v-if="declaration.status === 'PENDING'"
        class="mt-6 p-4 bg-muted/50 rounded-lg flex items-center justify-between"
      >
        <p class="text-muted-foreground">
          Your declaration is pending submission
        </p>
        <Button as-child>
          <NuxtLink :to="`/applicant/declaration/${id}/submit`">
            Submit Declaration
          </NuxtLink>
        </Button>
      </div>
    </template>
  </div>
</template>
