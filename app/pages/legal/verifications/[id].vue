<script setup lang="ts">
import { displayId, altReasonLabel, ID_TYPE_LABEL, type IdType, type AltReason } from "~/utils/displayId";
import type { VerificationDocument } from "~/shared/verification";

interface VerificationUser {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  createdAt: string;
}

interface OfficeCategoryInfo {
  name: string;
  articleReference: string | null;
}

interface InstitutionInfo {
  id: string;
  name: string;
}

interface ApplicantOfficeInfo {
  id: string;
  designation: string;
  officeCategory: OfficeCategoryInfo;
  institution: InstitutionInfo | null;
}

interface VerificationReview {
  id: string;
  status: string;
  reason: string;
  messageToApplicant: string | null;
  createdAt: string;
  reviewer: { email: string };
}

interface IdMatch {
  id: string;
  fullName: string;
  idType: IdType;
  ghanaCardNumber: string | null;
  alternateIdNumber: string | null;
  verificationStatus: string;
  createdAt: string;
  user: { email: string };
}

interface IdCheck {
  idType: IdType;
  number: string;
  unique: boolean;
  checkedAt: string;
  matches: IdMatch[];
}

interface VerificationProfile {
  id: string;
  fullName: string;
  idType: IdType;
  ghanaCardNumber: string | null;
  ghanaCardFrontUrl: string | null;
  ghanaCardBackUrl: string | null;
  alternateIdNumber: string | null;
  alternateIdScanUrl: string | null;
  alternateIdReason: AltReason | null;
  alternateIdDetails: string | null;
  verificationStatus: string;
  createdAt: string;
  user: VerificationUser;
  offices: ApplicantOfficeInfo[];
  verificationReviews: VerificationReview[];
  verificationDocuments: VerificationDocument[];
  idCheck: IdCheck;
}

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();
const id = route.params.id as string;

const { data, pending, error, refresh } = await useAsyncData(
  `verification-${id}`,
  () => authFetch<{ data: VerificationProfile }>(`/api/legal/verifications/${id}`),
);

const profile = computed(() => data.value?.data);

const reviewForm = ref({
  status: "" as string,
  reason: "",
  messageToApplicant: "",
});

const submitting = ref(false);
const { toast } = useToast();

async function submitReview() {
  if (!reviewForm.value.status || !reviewForm.value.reason) return;

  submitting.value = true;

  try {
    await authFetch(`/api/legal/verifications/${id}/review`, {
      method: "POST",
      body: {
        status: reviewForm.value.status,
        reason: reviewForm.value.reason,
        messageToApplicant: reviewForm.value.messageToApplicant || undefined,
      },
    });

    reviewForm.value = { status: "", reason: "", messageToApplicant: "" };
    await refresh();
    toast.success("Verification decision submitted.");
  } catch (e: unknown) {
    toast.fromError(e, "Failed to submit review");
  } finally {
    submitting.value = false;
  }
}

const statusColors: Record<string, string> = {
  PENDING_VERIFICATION: TONE_BADGE.amber,
  VERIFIED: TONE_BADGE.green,
  ON_HOLD: TONE_BADGE.orange,
  MORE_INFO_REQUIRED: TONE_BADGE.blue,
  REJECTED: TONE_BADGE.red,
};

const statusLabels: Record<string, string> = {
  PENDING_VERIFICATION: "Pending Verification",
  VERIFIED: "Verified",
  ON_HOLD: "On Hold",
  MORE_INFO_REQUIRED: "More Info Required",
  REJECTED: "Rejected",
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
</script>

<template>
  <div class="space-y-6">
    <!-- Back link -->
    <NuxtLink to="/legal/verifications" class="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Verifications
    </NuxtLink>

    <!-- Loading -->
    <div v-if="pending" class="space-y-4">
      <Skeleton class="h-8 w-64" />
      <Card><CardContent class="p-6"><Skeleton class="h-40 w-full" /></CardContent></Card>
    </div>

    <!-- Error -->
    <EmptyState v-else-if="error" title="Failed to load applicant details">
      <template #action>
        <Button variant="link" @click="refresh()">
          Try again
        </Button>
      </template>
    </EmptyState>

    <template v-else-if="profile">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">{{ profile.fullName }}</h1>
          <p class="text-muted-foreground">{{ profile.user?.email }}</p>
        </div>
        <Badge :class="statusColors[profile.verificationStatus] || 'bg-muted text-muted-foreground'">
          {{ statusLabels[profile.verificationStatus] || profile.verificationStatus }}
        </Badge>
      </div>

      <!-- Alternate ID context banner -->
      <div
        v-if="profile.idType !== 'GHANA_CARD'"
        role="status"
        aria-live="polite"
        class="flex items-start gap-3 rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 p-4"
      >
        <svg
          class="w-6 h-6 flex-shrink-0 text-amber-600 dark:text-amber-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-amber-900 dark:text-amber-100">
            Alternate ID — applicant has no Ghana Card
          </p>
          <p class="text-sm mt-1 text-amber-800 dark:text-amber-200">
            Submitted under <strong>{{ ID_TYPE_LABEL[profile.idType] }}</strong>. Reason: <em>{{ altReasonLabel(profile.alternateIdReason) }}</em>. Verify the uploaded scan carefully before approving.
          </p>
          <p
            v-if="profile.alternateIdDetails"
            class="text-sm mt-2 text-amber-900 dark:text-amber-100 whitespace-pre-wrap"
          >
            <span class="font-medium">Applicant note:</span> {{ profile.alternateIdDetails }}
          </p>
        </div>
      </div>

      <!-- ID uniqueness banner -->
      <div
        v-if="profile.idCheck"
        role="status"
        :aria-live="profile.idCheck.unique ? 'polite' : 'assertive'"
        class="flex items-start gap-3 rounded-lg border-2 p-4"
        :class="profile.idCheck.unique
          ? 'border-green-500 bg-green-50 dark:bg-green-950/40'
          : 'border-red-500 bg-red-50 dark:bg-red-950/40'"
      >
        <svg
          v-if="profile.idCheck.unique"
          class="w-6 h-6 flex-shrink-0 text-green-600 dark:text-green-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <svg
          v-else
          class="w-6 h-6 flex-shrink-0 text-red-600 dark:text-red-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div class="flex-1 min-w-0">
          <p class="font-semibold" :class="profile.idCheck.unique ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'">
            <span v-if="profile.idCheck.unique">{{ ID_TYPE_LABEL[profile.idType] }} number is unique</span>
            <span v-else>Duplicate {{ ID_TYPE_LABEL[profile.idType] }} number detected ({{ profile.idCheck.matches.length }} match{{ profile.idCheck.matches.length === 1 ? '' : 'es' }})</span>
          </p>
          <p class="text-sm mt-1" :class="profile.idCheck.unique ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'">
            <span v-if="profile.idCheck.unique">
              <span class="font-mono">{{ displayId(profile).value }}</span> does not appear on any other applicant profile.
            </span>
            <span v-else>
              <span class="font-mono">{{ displayId(profile).value }}</span> is also registered to the following profile(s). Review carefully before approving.
            </span>
          </p>
          <ul v-if="!profile.idCheck.unique" class="mt-3 space-y-1 text-sm">
            <li
              v-for="match in profile.idCheck.matches"
              :key="match.id"
              class="flex items-center gap-2"
            >
              <NuxtLink
                :to="`/legal/verifications/${match.id}`"
                class="font-medium text-red-900 dark:text-red-100 underline hover:no-underline"
              >
                {{ match.fullName }}
              </NuxtLink>
              <span class="text-red-800 dark:text-red-200">— {{ match.user?.email }}</span>
              <Badge :class="statusColors[match.verificationStatus] || 'bg-muted text-muted-foreground'">
                {{ statusLabels[match.verificationStatus] || match.verificationStatus }}
              </Badge>
            </li>
          </ul>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Left column: Applicant info -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Personal Info -->
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent>
              <dl class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt class="text-muted-foreground">Full Name</dt>
                  <dd class="font-medium">{{ profile.fullName }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">{{ displayId(profile).label }} Number</dt>
                  <dd class="font-mono font-medium">{{ displayId(profile).value }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Email</dt>
                  <dd class="font-medium">
                    {{ profile.user?.email }}
                    <span v-if="profile.user?.emailVerified" class="ml-2 text-xs text-green-600 dark:text-green-400">(Verified)</span>
                    <span v-else class="ml-2 text-xs text-amber-600 dark:text-amber-400">(Not Verified)</span>
                  </dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Phone</dt>
                  <dd class="font-medium">{{ profile.user?.phone || "Not provided" }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Registered</dt>
                  <dd class="font-medium">{{ formatDate(profile.user?.createdAt) }}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <!-- ID document images -->
          <Card>
            <CardHeader>
              <CardTitle>
                {{ profile.idType === "GHANA_CARD" ? "Ghana Card Images" : `${ID_TYPE_LABEL[profile.idType]} Scan` }}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div v-if="profile.idType === 'GHANA_CARD'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-if="profile.ghanaCardFrontUrl">
                  <p class="text-sm text-muted-foreground mb-2">Front</p>
                  <a :href="profile.ghanaCardFrontUrl" target="_blank" class="block">
                    <img
                      :src="profile.ghanaCardFrontUrl"
                      alt="Ghana Card Front"
                      class="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                    >
                  </a>
                </div>
                <div v-if="profile.ghanaCardBackUrl">
                  <p class="text-sm text-muted-foreground mb-2">Back</p>
                  <a :href="profile.ghanaCardBackUrl" target="_blank" class="block">
                    <img
                      :src="profile.ghanaCardBackUrl"
                      alt="Ghana Card Back"
                      class="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                    >
                  </a>
                </div>
              </div>
              <div v-else-if="profile.alternateIdScanUrl">
                <a :href="profile.alternateIdScanUrl" target="_blank" class="block">
                  <img
                    :src="profile.alternateIdScanUrl"
                    :alt="`${ID_TYPE_LABEL[profile.idType]} scan`"
                    class="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                  >
                </a>
              </div>
              <p v-else class="text-sm text-muted-foreground">No scan uploaded.</p>
            </CardContent>
          </Card>

          <!-- Documents submitted in response to a request for information -->
          <Card v-if="profile.verificationDocuments?.length">
            <CardHeader>
              <CardTitle>Documents Submitted by Applicant</CardTitle>
            </CardHeader>
            <CardContent>
              <ul class="space-y-2">
                <li
                  v-for="doc in profile.verificationDocuments"
                  :key="doc.id"
                  class="flex items-start gap-3 rounded-lg border p-3"
                >
                  <svg
                    class="w-5 h-5 flex-shrink-0 text-muted-foreground mt-0.5"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div class="flex-1 min-w-0">
                    <a
                      :href="doc.url"
                      target="_blank"
                      rel="noopener"
                      class="text-sm font-medium text-primary underline hover:no-underline truncate block"
                    >
                      {{ doc.fileName }}
                    </a>
                    <p class="text-xs text-muted-foreground">
                      {{ formatBytes(doc.size) }} · {{ formatDate(doc.createdAt) }}
                    </p>
                    <p v-if="doc.note" class="text-xs text-muted-foreground mt-1 italic">
                      {{ doc.note }}
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <!-- Office Details -->
          <Card>
            <CardHeader><CardTitle>Office Details</CardTitle></CardHeader>
            <CardContent>
              <div v-if="profile.offices?.length" class="space-y-4">
                <dl v-for="office in profile.offices" :key="office.id" class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt class="text-muted-foreground">Designation</dt>
                    <dd class="font-medium">{{ office.designation }}</dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground">Office Category</dt>
                    <dd class="font-medium">
                      {{ office.officeCategory?.name }}
                      <span v-if="office.officeCategory?.articleReference" class="text-xs text-muted-foreground ml-1">
                        ({{ office.officeCategory.articleReference }})
                      </span>
                    </dd>
                  </div>
                  <div v-if="office.institution">
                    <dt class="text-muted-foreground">Institution</dt>
                    <dd class="font-medium">{{ office.institution.name }}</dd>
                  </div>
                </dl>
              </div>
              <p v-else class="text-sm text-muted-foreground">No office details on record.</p>
            </CardContent>
          </Card>
        </div>

        <!-- Right column: Review panel + history -->
        <div class="space-y-6">
          <!-- Review Action Panel -->
          <Card>
            <CardHeader><CardTitle>Review Decision</CardTitle></CardHeader>
            <CardContent>
              <div class="space-y-4">
                <FormField>
                  <template #label>
                    Decision
                    <HelpTip field-id="verification.decision" />
                  </template>
                  <template #default="{ id: fieldId }">
                    <Select v-model="reviewForm.status">
                      <SelectTrigger :id="fieldId" class="w-full">
                        <SelectValue placeholder="Select decision..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VERIFIED">
                          Verify (Approve)
                        </SelectItem>
                        <SelectItem value="ON_HOLD">
                          Put On Hold
                        </SelectItem>
                        <SelectItem value="MORE_INFO_REQUIRED">
                          Request More Info
                        </SelectItem>
                        <SelectItem value="REJECTED">
                          Reject
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </template>
                </FormField>

                <FormField required>
                  <template #label>
                    Reason
                    <HelpTip field-id="verification.reason" />
                  </template>
                  <template #default="{ id: fieldId }">
                    <Textarea
                      :id="fieldId"
                      v-model="reviewForm.reason"
                      :rows="3"
                      placeholder="Explain the reason for this decision..."
                    />
                  </template>
                </FormField>

                <FormField
                  v-if="reviewForm.status === 'MORE_INFO_REQUIRED' || reviewForm.status === 'REJECTED' || reviewForm.status === 'ON_HOLD'"
                  v-slot="{ id: fieldId }"
                  :required="reviewForm.status === 'MORE_INFO_REQUIRED'"
                  :hint="reviewForm.status === 'MORE_INFO_REQUIRED' ? undefined : 'Optional'"
                  label="Message to Applicant"
                >
                  <Textarea
                    :id="fieldId"
                    v-model="reviewForm.messageToApplicant"
                    :rows="3"
                    placeholder="Specific message to the applicant..."
                  />
                </FormField>

                <Button
                  class="w-full"
                  :disabled="!reviewForm.status || !reviewForm.reason || submitting || (reviewForm.status === 'MORE_INFO_REQUIRED' && !reviewForm.messageToApplicant)"
                  @click="submitReview"
                >
                  {{ submitting ? "Submitting..." : "Submit Decision" }}
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- Review History -->
          <Card>
            <CardHeader><CardTitle>Review History</CardTitle></CardHeader>
            <CardContent>
              <div v-if="!profile.verificationReviews?.length" class="text-sm text-muted-foreground text-center py-4">
                No reviews yet
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="review in profile.verificationReviews"
                  :key="review.id"
                  class="border-l-2 pl-4 pb-4"
                  :class="{
                    'border-green-500': review.status === 'VERIFIED',
                    'border-orange-500': review.status === 'ON_HOLD',
                    'border-blue-500': review.status === 'MORE_INFO_REQUIRED',
                    'border-red-500': review.status === 'REJECTED',
                    'border-amber-500': review.status === 'PENDING_VERIFICATION',
                  }"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <Badge :class="statusColors[review.status] || 'bg-muted text-muted-foreground'">
                      {{ statusLabels[review.status] || review.status }}
                    </Badge>
                    <span class="text-xs text-muted-foreground">
                      {{ formatDate(review.createdAt) }}
                    </span>
                  </div>
                  <p class="text-sm mt-1">{{ review.reason }}</p>
                  <p v-if="review.messageToApplicant" class="text-sm text-muted-foreground mt-1 italic">
                    To applicant: {{ review.messageToApplicant }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-1">
                    by {{ review.reviewer?.email }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </template>
  </div>
</template>
