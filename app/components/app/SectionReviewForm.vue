<script setup lang="ts">
import { FORM_SECTION_LABELS, FORM_SECTIONS } from "~/utils/form-sections";

interface SectionReview {
  id: string;
  section: string;
  isAcceptable: boolean;
  comments: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  reviewer: { email: string } | null;
  resolvedBy: { email: string } | null;
  createdAt: string;
}

interface Declaration {
  id: string;
  uniqueCode: string;
  status: string;
  applicant: {
    fullName: string;
    ghanaCardNumber: string;
    offices: Array<{
      officeCategory: { name: string } | null;
      institution: { name: string } | null;
    }>;
    user: { email: string; phone: string | null };
  };
}

const props = defineProps<{
  declaration: Declaration;
  existingReviews?: SectionReview[];
}>();

const emit = defineEmits<{
  reviewed: [];
}>();

const isSubmitting = ref(false);
const isResolving = ref<string | null>(null);
const submitError = ref("");

const showRejectModal = ref(false);
const rejectionReason = ref("");
const isRejecting = ref(false);
const rejectError = ref("");

const sections = ref(
  FORM_SECTIONS.map((section) => ({
    section,
    isAcceptable: true,
    comments: "",
  }))
);

const existingIssues = computed(() =>
  (props.existingReviews ?? []).filter((r) => !r.isAcceptable)
);

const unresolvedIssues = computed(() =>
  existingIssues.value.filter((r) => !r.resolvedAt)
);

const hasExistingReviews = computed(() => (props.existingReviews ?? []).length > 0);
const allIssuesResolved = computed(() =>
  hasExistingReviews.value && unresolvedIssues.value.length === 0
);

const canApprove = computed(() => {
  if (!hasExistingReviews.value) return false;
  return allIssuesResolved.value && existingIssues.value.length > 0;
});

const submitSectionReview = async () => {
  submitError.value = "";

  const hasIssues = sections.value.some((s) => !s.isAcceptable);
  if (hasIssues) {
    const missing = sections.value.filter((s) => !s.isAcceptable && !s.comments.trim());
    if (missing.length > 0) {
      submitError.value = "Please provide comments for all sections marked as not acceptable.";
      return;
    }
  }

  isSubmitting.value = true;
  try {
    await authFetch("/api/reviews", {
      method: "POST",
      body: {
        declarationId: props.declaration.id,
        sections: sections.value.map((s) => ({
          section: s.section,
          isAcceptable: s.isAcceptable,
          comments: s.isAcceptable ? undefined : s.comments,
        })),
      },
    });
    emit("reviewed");
  } catch (error: any) {
    submitError.value = error.data?.statusMessage || "Failed to submit review";
  } finally {
    isSubmitting.value = false;
  }
};

const resolveIssue = async (reviewId: string) => {
  isResolving.value = reviewId;
  try {
    await authFetch(`/api/reviews/sections/${reviewId}/resolve`, {
      method: "PATCH",
    });
    emit("reviewed");
  } catch (error: any) {
    submitError.value = error.data?.statusMessage || "Failed to resolve issue";
  } finally {
    isResolving.value = null;
  }
};

const approveDeclaration = async () => {
  isSubmitting.value = true;
  submitError.value = "";
  try {
    await authFetch("/api/reviews/approve", {
      method: "POST",
      body: { declarationId: props.declaration.id },
    });
    emit("reviewed");
  } catch (error: any) {
    submitError.value = error.data?.statusMessage || "Failed to approve";
  } finally {
    isSubmitting.value = false;
  }
};

const rejectDeclaration = async () => {
  if (!rejectionReason.value.trim()) {
    rejectError.value = "Please provide a reason for rejection.";
    return;
  }
  isRejecting.value = true;
  rejectError.value = "";
  try {
    await authFetch("/api/reviews/reject", {
      method: "POST",
      body: {
        declarationId: props.declaration.id,
        rejectionReason: rejectionReason.value,
      },
    });
    showRejectModal.value = false;
    emit("reviewed");
  } catch (error: any) {
    rejectError.value = error.data?.statusMessage || "Failed to reject";
  } finally {
    isRejecting.value = false;
  }
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
</script>

<template>
  <div class="space-y-6">
    <!-- Declaration Info -->
    <Card>
      <CardContent class="p-4">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-muted-foreground">Code:</span>
            <span class="ml-2 font-mono font-medium">{{ declaration.uniqueCode }}</span>
          </div>
          <div>
            <span class="text-muted-foreground">Applicant:</span>
            <span class="ml-2 font-medium">{{ declaration.applicant.fullName }}</span>
          </div>
          <div>
            <span class="text-muted-foreground">Category:</span>
            <span class="ml-2">{{ declaration.applicant.offices?.[0]?.officeCategory?.name || 'N/A' }}</span>
          </div>
          <div>
            <span class="text-muted-foreground">Institution:</span>
            <span class="ml-2">{{ declaration.applicant.offices?.[0]?.institution?.name || 'N/A' }}</span>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Existing Issues (if previously reviewed) -->
    <template v-if="hasExistingReviews && existingIssues.length > 0">
      <Card>
        <CardHeader>
          <CardTitle class="text-lg">Existing Review Issues</CardTitle>
          <CardDescription>
            {{ unresolvedIssues.length === 0
              ? 'All issues have been resolved. You can now approve the declaration.'
              : `${unresolvedIssues.length} issue(s) still need to be resolved.` }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <div
            v-for="review in existingIssues"
            :key="review.id"
            class="flex items-start justify-between rounded-lg border p-4"
            :class="review.resolvedAt ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h4 class="font-medium text-sm">
                  {{ FORM_SECTION_LABELS[review.section] || review.section }}
                </h4>
                <Badge
                  :class="review.resolvedAt
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'"
                >
                  {{ review.resolvedAt ? 'Resolved' : 'Pending' }}
                </Badge>
              </div>
              <p class="text-sm text-muted-foreground mt-1">{{ review.comments }}</p>
              <p v-if="review.resolvedAt" class="text-xs text-muted-foreground mt-1">
                Resolved {{ formatDate(review.resolvedAt) }}
                <span v-if="review.resolvedBy"> by {{ review.resolvedBy.email }}</span>
              </p>
            </div>
            <Button
              v-if="!review.resolvedAt"
              size="sm"
              variant="outline"
              :disabled="isResolving === review.id"
              @click="resolveIssue(review.id)"
            >
              {{ isResolving === review.id ? 'Resolving...' : 'Resolve' }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Approve button when all resolved -->
      <div v-if="canApprove" class="flex gap-3">
        <Button
          class="flex-1"
          :disabled="isSubmitting"
          @click="approveDeclaration"
        >
          {{ isSubmitting ? 'Approving...' : 'Approve Declaration' }}
        </Button>
        <Button
          variant="destructive"
          @click="showRejectModal = true"
        >
          Reject
        </Button>
      </div>
    </template>

    <!-- Fresh section review (no existing reviews or all acceptable) -->
    <template v-if="!hasExistingReviews || existingIssues.length === 0">
      <Card>
        <CardHeader>
          <CardTitle class="text-lg">Section Review</CardTitle>
          <CardDescription>
            Review each section of the declaration form. Mark whether each section has been filled correctly.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            v-for="(item, index) in sections"
            :key="item.section"
            class="rounded-lg border p-4 space-y-3"
            :class="item.isAcceptable ? '' : 'border-red-200 bg-red-50/50'"
          >
            <div class="flex items-center justify-between">
              <h4 class="font-medium text-sm">
                {{ index + 1 }}. {{ FORM_SECTION_LABELS[item.section] }}
              </h4>
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted-foreground">
                  {{ item.isAcceptable ? 'Acceptable' : 'Needs Attention' }}
                </span>
                <Switch
                  :checked="item.isAcceptable"
                  @update:checked="item.isAcceptable = $event"
                />
              </div>
            </div>
            <div v-if="!item.isAcceptable" class="space-y-1">
              <Label class="text-sm">
                Comments <span class="text-red-500">*</span>
              </Label>
              <Textarea
                v-model="item.comments"
                rows="2"
                placeholder="Describe what needs to be corrected..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div class="flex gap-3">
        <Button
          class="flex-1"
          :disabled="isSubmitting"
          @click="submitSectionReview"
        >
          {{ isSubmitting ? 'Submitting...' : 'Submit Review' }}
        </Button>
        <Button
          variant="destructive"
          @click="showRejectModal = true"
        >
          Reject
        </Button>
      </div>
    </template>

    <!-- Error -->
    <Alert v-if="submitError" variant="destructive">
      <AlertDescription>{{ submitError }}</AlertDescription>
    </Alert>

    <!-- Reject Modal -->
    <Dialog :open="showRejectModal" @update:open="showRejectModal = $event">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reject Declaration</DialogTitle>
          <DialogDescription>
            This will reject the declaration and issue a new code for resubmission.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label>
              Rejection Reason <span class="text-red-500">*</span>
            </Label>
            <Textarea
              v-model="rejectionReason"
              rows="3"
              placeholder="Explain why this declaration is being rejected..."
            />
          </div>
          <p class="text-xs text-muted-foreground">
            A new unique code will be issued for resubmission.
          </p>
          <Alert v-if="rejectError" variant="destructive">
            <AlertDescription>{{ rejectError }}</AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showRejectModal = false">Cancel</Button>
          <Button
            variant="destructive"
            :disabled="isRejecting"
            @click="rejectDeclaration"
          >
            {{ isRejecting ? 'Rejecting...' : 'Confirm Rejection' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
