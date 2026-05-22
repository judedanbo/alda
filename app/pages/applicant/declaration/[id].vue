<script setup lang="ts">
import { FORM_SECTION_LABELS } from "~/utils/form-sections";

interface TimelineEvent {
  status: string;
  title: string;
  description: string;
  date: string;
}

interface SectionReview {
  id: string;
  section: string;
  isAcceptable: boolean;
  comments: string | null;
  resolvedAt: string | null;
}

interface DeclarationDetail {
  id: string;
  uniqueCode: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  timeline: TimelineEvent[];
  latestReview: { status: string; rejectionReason: string | null } | null;
  receipt: { receiptNumber: string; pdfUrl: string | null } | null;
  sectionReviews: SectionReview[];
  hasPendingReissue: boolean;
}

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();

const id = route.params.id as string;

// Fetch declaration status
const { data, pending, error, refresh } = await useAsyncData(
  `declaration-${id}`,
  () => authFetch<{ data: DeclarationDetail }>(`/api/declarations/${id}/status`),
);

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
    FORM_COLLECTED: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    FORM_REISSUE: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    SUBMITTED: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
    RECORDED: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    APPROVED: "M5 13l4 4L19 7",
    REJECTED: "M6 18L18 6M6 6l12 12",
    RECEIPT_READY: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    SEALED: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  };
  return icons[status] || icons.CREATED;
};

// Lost-form reissue request
const showReissueModal = ref(false);
const reissueNote = ref("");
const submittingReissue = ref(false);
const reissueError = ref("");

const canRequestReissue = computed(
  () =>
    declaration.value?.status === "FORM_COLLECTED" &&
    !declaration.value?.hasPendingReissue
);

const submitReissueRequest = async () => {
  submittingReissue.value = true;
  reissueError.value = "";
  try {
    await authFetch(`/api/declarations/${id}/reissue-request`, {
      method: "POST",
      body: { applicantNote: reissueNote.value || undefined },
    });
    showReissueModal.value = false;
    reissueNote.value = "";
    await refresh();
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string } };
    reissueError.value =
      e.data?.message || e.data?.statusMessage || "Failed to submit reissue request";
  } finally {
    submittingReissue.value = false;
  }
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
            <div data-tour="declaration-code">
              <p class="text-sm text-muted-foreground mb-1">Declaration Code</p>
              <h1 class="text-3xl font-bold font-mono text-foreground">
                {{ declaration.uniqueCode }}
              </h1>
            </div>
            <StatusBadge :status="declaration.status" />
          </div>
          <div v-if="canRequestReissue" class="mt-4 border-t pt-3">
            <Button
              variant="link"
              data-tour="declaration-reissue"
              class="h-auto p-0 text-sm text-muted-foreground"
              @click="showReissueModal = true"
            >
              Lost your form? Request a reissue
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Reissue Pending -->
      <Alert
        v-if="declaration.hasPendingReissue"
        class="mb-6 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
      >
        <AlertTitle class="text-amber-700 dark:text-amber-300">Reissue Request Pending</AlertTitle>
        <AlertDescription>
          Your lost-form reissue request is awaiting review by the Legal Unit
          once the Auditor General's approval letter is received.
        </AlertDescription>
      </Alert>

      <!-- Rejection Reason -->
      <Alert
        v-if="declaration.latestReview?.status === 'REJECTED'"
        variant="destructive"
        class="mb-6"
      >
        <AlertTitle>Rejection Reason</AlertTitle>
        <AlertDescription>{{ declaration.latestReview.rejectionReason }}</AlertDescription>
      </Alert>

      <!-- Section Review Comments -->
      <Card
        v-if="declaration.sectionReviews?.some((r: SectionReview) => !r.isAcceptable)"
        data-tour="declaration-review-comments"
        class="mb-6"
      >
        <CardHeader>
          <CardTitle class="text-lg">Review Comments</CardTitle>
          <CardDescription>
            The following sections need your attention. Please address these issues before your next visit.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <div
            v-for="review in declaration.sectionReviews.filter((r: SectionReview) => !r.isAcceptable)"
            :key="review.id"
            class="rounded-lg border p-4"
            :class="review.resolvedAt
              ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900'
              : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'"
          >
            <div class="flex items-center gap-2 mb-1">
              <h4 class="font-medium text-sm">
                {{ FORM_SECTION_LABELS[review.section] || review.section }}
              </h4>
              <Badge
                :class="review.resolvedAt
                  ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'"
              >
                {{ review.resolvedAt ? 'Resolved' : 'Pending' }}
              </Badge>
            </div>
            <p class="text-sm text-muted-foreground">{{ review.comments }}</p>
            <p v-if="review.resolvedAt" class="text-xs text-muted-foreground mt-1">
              Resolved {{ formatDate(review.resolvedAt) }}
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- Receipt Info -->
      <Alert
        v-if="declaration.receipt"
        data-tour="declaration-receipt"
        class="mb-6 border-success/20 bg-success/10"
      >
        <AlertTitle class="text-success">Receipt Ready</AlertTitle>
        <AlertDescription>
          <p>
            Receipt Number: <span class="font-mono font-bold">{{ declaration.receipt.receiptNumber }}</span>
          </p>
          <div v-if="declaration.receipt.pdfUrl" class="mt-3 flex flex-wrap gap-2">
            <Button as-child size="sm">
              <a :href="declaration.receipt.pdfUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Receipt
              </a>
            </Button>
            <Button as-child size="sm" variant="outline">
              <a :href="declaration.receipt.pdfUrl" :download="`${declaration.receipt.receiptNumber}.pdf`" class="inline-flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </a>
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <!-- Timeline -->
      <Card data-tour="declaration-timeline">
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
                      <p v-if="event.description" class="text-sm text-muted-foreground mt-1">{{ event.description }}</p>
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

      <!-- Reissue Request Modal -->
      <Dialog :open="showReissueModal" @update:open="showReissueModal = $event">
        <DialogContent class="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request a Form Reissue</DialogTitle>
            <DialogDescription>
              Follow this process if you lost your collected declaration form
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-4">
            <ol class="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Write a letter stating the conditions under which the form was
                lost.
              </li>
              <li>
                Submit the letter to the <strong>Auditor General</strong> or your
                nearest <strong>Regional Auditor</strong>.
              </li>
              <li>
                The Auditor General / Regional Auditor will decide whether to
                approve a reissue at their discretion.
              </li>
              <li>
                Once approved, take the approved letter to the Legal Unit. They
                will record the approval and reissue your form.
              </li>
            </ol>

            <p class="text-sm text-muted-foreground">
              Submitting this request notifies the Legal Unit to expect your
              approved letter. It does not replace the offline letter.
            </p>

            <div class="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea
                v-model="reissueNote"
                rows="3"
                placeholder="Brief context about how the form was lost..."
              />
            </div>

            <Alert v-if="reissueError" variant="destructive">
              <AlertDescription>{{ reissueError }}</AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" @click="showReissueModal = false">
              Cancel
            </Button>
            <Button :disabled="submittingReissue" @click="submitReissueRequest">
              {{ submittingReissue ? 'Submitting...' : 'Submit Request' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
