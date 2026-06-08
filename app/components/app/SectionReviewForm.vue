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
    idType: import("~/utils/displayId").IdType;
    ghanaCardNumber: string | null;
    alternateIdNumber: string | null;
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

const { toast } = useToast();

const isSubmitting = ref(false);
const isResolving = ref<string | null>(null);
const submitError = ref("");

const showRejectModal = ref(false);
const rejectionReason = ref("");
const reissueCode = ref(false);
const reissueStage = ref<"CODE_GENERATED" | "FORM_COLLECTED">("FORM_COLLECTED");
const collectionOfficeId = ref("");
const isRejecting = ref(false);
const rejectError = ref("");

interface Office {
  id: string;
  name: string;
  type: string;
  region: string | null;
}

const offices = ref<Office[]>([]);
const officesLoaded = ref(false);

const fetchOffices = async () => {
  if (officesLoaded.value) return;
  try {
    const response = await authFetch<{ data: Office[] }>("/api/collection-offices");
    offices.value = response.data;
    officesLoaded.value = true;
  } catch {
    offices.value = [];
  }
};

watch([reissueCode, reissueStage], ([code, stage]) => {
  if (code && stage === "FORM_COLLECTED") fetchOffices();
});

const sections = ref(
  FORM_SECTIONS.map((section) => ({
    section,
    isAcceptable: null as boolean | null,
    comments: "",
  }))
);

const allSectionsDecided = computed(() =>
  sections.value.every((s) => s.isAcceptable !== null)
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

  if (!allSectionsDecided.value) {
    submitError.value = "Please review all sections before submitting.";
    return;
  }

  const hasIssues = sections.value.some((s) => s.isAcceptable === false);
  if (hasIssues) {
    const missing = sections.value.filter((s) => s.isAcceptable === false && !s.comments.trim());
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
          comments: s.isAcceptable === false ? s.comments : undefined,
        })),
      },
    });
    toast.success("Section review submitted.");
    emit("reviewed");
  } catch (error: unknown) {
    toast.fromError(error, "Failed to submit review");
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
    toast.success("Issue resolved.");
    emit("reviewed");
  } catch (error: unknown) {
    toast.fromError(error, "Failed to resolve issue");
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
    toast.success("Declaration approved.");
    emit("reviewed");
  } catch (error: unknown) {
    toast.fromError(error, "Failed to approve");
  } finally {
    isSubmitting.value = false;
  }
};

const rejectDeclaration = async () => {
  if (!rejectionReason.value.trim()) {
    rejectError.value = "Please provide a reason for rejection.";
    return;
  }
  if (reissueCode.value && reissueStage.value === "FORM_COLLECTED" && !collectionOfficeId.value) {
    rejectError.value = "Please select the office where the form was collected.";
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
        reissueCode: reissueCode.value,
        ...(reissueCode.value ? { reissueStage: reissueStage.value } : {}),
        ...(reissueCode.value && reissueStage.value === "FORM_COLLECTED" ? { collectionOfficeId: collectionOfficeId.value } : {}),
      },
    });
    const issuedNewCode = reissueCode.value;
    showRejectModal.value = false;
    rejectionReason.value = "";
    reissueCode.value = false;
    reissueStage.value = "FORM_COLLECTED";
    collectionOfficeId.value = "";
    toast.success(issuedNewCode ? "Declaration rejected and a new code issued." : "Declaration rejected.");
    emit("reviewed");
  } catch (error: unknown) {
    // Keep the inline error in the (still-open) modal, and surface a toast too.
    rejectError.value = toastErrorMessage(error, "Failed to reject");
    toast.error(rejectError.value);
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
            :class="review.resolvedAt
              ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900'
              : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2">
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
          <CardTitle class="text-lg flex items-center gap-1.5">
            Section Review
            <HelpTip field-id="review.sectionAcceptable" />
          </CardTitle>
          <CardDescription>
            Review each section of the declaration form. Select "Acceptable" or "Needs Attention" for every section before submitting.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            v-for="(item, index) in sections"
            :key="item.section"
            class="rounded-lg border-2 p-4 space-y-3 transition-colors"
            :class="[
              item.isAcceptable === true && 'border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20',
              item.isAcceptable === false && 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30',
              item.isAcceptable === null && 'border-dashed border-amber-300 bg-amber-50/20 dark:border-amber-800 dark:bg-amber-950/20',
            ]"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-2">
                <h4 class="font-medium text-sm">
                  {{ index + 1 }}. {{ FORM_SECTION_LABELS[item.section] }}
                </h4>
                <span
                  v-if="item.isAcceptable === null"
                  class="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded dark:text-amber-300 dark:bg-amber-950/40"
                >
                  Pending
                </span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-medium rounded-l-md border transition-colors"
                  :class="item.isAcceptable === true
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-card text-muted-foreground border-border hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-950/30 dark:hover:text-green-300 dark:hover:border-green-800'"
                  @click="item.isAcceptable = true"
                >
                  Acceptable
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-medium rounded-r-md border border-l-0 transition-colors"
                  :class="item.isAcceptable === false
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-card text-muted-foreground border-border hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:hover:bg-red-950/30 dark:hover:text-red-300 dark:hover:border-red-800'"
                  @click="item.isAcceptable = false"
                >
                  Needs Attention
                </button>
              </div>
            </div>
            <div v-if="item.isAcceptable === false" class="space-y-1">
              <Label class="text-sm inline-flex items-center gap-1.5">
                Comments <span class="text-destructive">*</span>
                <HelpTip field-id="review.sectionComment" />
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

      <div class="space-y-2">
        <div v-if="!allSectionsDecided" class="text-sm text-amber-600 dark:text-amber-400">
          {{ sections.filter(s => s.isAcceptable === null).length }} of {{ sections.length }} sections still need a decision.
        </div>
        <div class="flex gap-3">
          <Button
            class="flex-1"
            :disabled="isSubmitting || !allSectionsDecided"
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
            This will reject the declaration. You can optionally issue a new code for resubmission.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label class="inline-flex items-center gap-1.5">
              Rejection Reason <span class="text-destructive">*</span>
              <HelpTip field-id="review.rejectReason" />
            </Label>
            <Textarea
              v-model="rejectionReason"
              rows="3"
              placeholder="Explain why this declaration is being rejected..."
            />
          </div>

          <label class="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <Checkbox
              v-model="reissueCode"
              class="mt-0.5"
            />
            <div>
              <p class="text-sm font-medium">Issue a new declaration code</p>
              <p class="text-xs text-muted-foreground">
                A new unique code will be generated so the applicant can resubmit.
                Leave unchecked if the declaration is being rejected outright.
              </p>
            </div>
          </label>

          <!-- Reissue options (shown when reissue is checked) -->
          <template v-if="reissueCode">
            <div class="space-y-2">
              <Label>New declaration stage</Label>
              <Select v-model="reissueStage">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CODE_GENERATED">Code Generated</SelectItem>
                  <SelectItem value="FORM_COLLECTED">Form Collected</SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground">
                The new declaration will start at this stage. "Form Collected" skips the code collection step.
              </p>
            </div>

            <!-- Office selector (shown when stage is FORM_COLLECTED) -->
            <div v-if="reissueStage === 'FORM_COLLECTED'" class="space-y-2">
              <Label>
                Collection Office <span class="text-destructive">*</span>
              </Label>
              <Select v-model="collectionOfficeId">
                <SelectTrigger>
                  <SelectValue placeholder="Select office..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="office in offices"
                    :key="office.id"
                    :value="office.id"
                  >
                    {{ office.name }}
                    <span v-if="office.region" class="text-muted-foreground"> — {{ office.region }}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground">
                The office where the replacement form was collected.
              </p>
            </div>
          </template>

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
