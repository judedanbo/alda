<script setup lang="ts">
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

interface VerificationProfile {
  id: string;
  fullName: string;
  ghanaCardNumber: string;
  ghanaCardFrontUrl: string;
  ghanaCardBackUrl: string | null;
  verificationStatus: string;
  createdAt: string;
  user: VerificationUser;
  offices: ApplicantOfficeInfo[];
  verificationReviews: VerificationReview[];
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
const submitError = ref("");

async function submitReview() {
  if (!reviewForm.value.status || !reviewForm.value.reason) return;

  submitting.value = true;
  submitError.value = "";

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
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    submitError.value = err.data?.message || "Failed to submit review";
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
                  <dt class="text-muted-foreground">Ghana Card Number</dt>
                  <dd class="font-mono font-medium">{{ profile.ghanaCardNumber }}</dd>
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

          <!-- Ghana Card Images -->
          <Card>
            <CardHeader><CardTitle>Ghana Card Images</CardTitle></CardHeader>
            <CardContent>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
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

                <div v-if="submitError" class="text-sm text-destructive">{{ submitError }}</div>

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
