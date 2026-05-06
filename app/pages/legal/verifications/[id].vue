<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();
const id = route.params.id as string;

const { data, pending, error, refresh } = await useAsyncData(
  `verification-${id}`,
  () => authFetch<{ data: any }>(`/api/legal/verifications/${id}`),
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
  } catch (e: any) {
    submitError.value = e.data?.message || "Failed to submit review";
  } finally {
    submitting.value = false;
  }
}

const statusColors: Record<string, string> = {
  PENDING_VERIFICATION: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-green-100 text-green-800",
  ON_HOLD: "bg-orange-100 text-orange-800",
  MORE_INFO_REQUIRED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
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
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <div v-else-if="error" class="text-center py-12">
      <p class="text-destructive">Failed to load applicant details</p>
      <Button variant="link" class="mt-4" @click="refresh()">Try again</Button>
    </div>

    <template v-else-if="profile">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">{{ profile.fullName }}</h1>
          <p class="text-muted-foreground">{{ profile.user?.email }}</p>
        </div>
        <span
          class="px-4 py-2 rounded-full text-sm font-medium"
          :class="statusColors[profile.verificationStatus] || 'bg-muted'"
        >
          {{ statusLabels[profile.verificationStatus] || profile.verificationStatus }}
        </span>
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
                    <span v-if="profile.user?.emailVerified" class="ml-2 text-xs text-green-600">(Verified)</span>
                    <span v-else class="ml-2 text-xs text-amber-600">(Not Verified)</span>
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
                    />
                  </a>
                </div>
                <div v-if="profile.ghanaCardBackUrl">
                  <p class="text-sm text-muted-foreground mb-2">Back</p>
                  <a :href="profile.ghanaCardBackUrl" target="_blank" class="block">
                    <img
                      :src="profile.ghanaCardBackUrl"
                      alt="Ghana Card Back"
                      class="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Office Details -->
          <Card>
            <CardHeader><CardTitle>Office Details</CardTitle></CardHeader>
            <CardContent>
              <dl class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt class="text-muted-foreground">Designation</dt>
                  <dd class="font-medium">{{ profile.designation }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Office Category</dt>
                  <dd class="font-medium">
                    {{ profile.officeCategory?.name }}
                    <span v-if="profile.officeCategory?.articleReference" class="text-xs text-muted-foreground ml-1">
                      ({{ profile.officeCategory.articleReference }})
                    </span>
                  </dd>
                </div>
                <div v-if="profile.institution">
                  <dt class="text-muted-foreground">Institution</dt>
                  <dd class="font-medium">{{ profile.institution.name }}</dd>
                </div>
              </dl>
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
                <div>
                  <label class="text-sm font-medium mb-2 block">Decision</label>
                  <Select v-model="reviewForm.status">
                    <SelectTrigger>
                      <SelectValue placeholder="Select decision..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VERIFIED">Verify (Approve)</SelectItem>
                      <SelectItem value="ON_HOLD">Put On Hold</SelectItem>
                      <SelectItem value="MORE_INFO_REQUIRED">Request More Info</SelectItem>
                      <SelectItem value="REJECTED">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label class="text-sm font-medium mb-2 block">
                    Reason <span class="text-destructive">*</span>
                  </label>
                  <textarea
                    v-model="reviewForm.reason"
                    rows="3"
                    class="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Explain the reason for this decision..."
                  />
                </div>

                <div v-if="reviewForm.status === 'MORE_INFO_REQUIRED' || reviewForm.status === 'REJECTED'">
                  <label class="text-sm font-medium mb-2 block">
                    Message to Applicant
                    <span v-if="reviewForm.status === 'MORE_INFO_REQUIRED'" class="text-destructive">*</span>
                    <span v-else class="text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    v-model="reviewForm.messageToApplicant"
                    rows="3"
                    class="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Specific message to the applicant..."
                  />
                </div>

                <div v-if="submitError" class="text-sm text-destructive">{{ submitError }}</div>

                <Button
                  class="w-full"
                  :disabled="!reviewForm.status || !reviewForm.reason || submitting"
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
                    <span
                      class="px-2 py-0.5 rounded text-xs font-medium"
                      :class="statusColors[review.status] || 'bg-muted'"
                    >
                      {{ statusLabels[review.status] || review.status }}
                    </span>
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
