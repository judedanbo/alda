<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();
const id = route.params.id as string;

const { data, pending, error, refresh } = await useAsyncData(
  `form-reissue-${id}`,
  () => authFetch<{ data: any }>(`/api/legal/form-reissues/${id}`),
);

const request = computed(() => data.value?.data);
const declaration = computed(() => request.value?.declaration);
const formCollection = computed(() => declaration.value?.formCollections?.[0]);
const history = computed(() => declaration.value?.formReissueRequests || []);

const decisionForm = ref({
  status: "" as string,
  approverType: "" as string,
  approverDetail: "",
  decisionReason: "",
});

const letterScanUrl = ref("");
const uploadingLetter = ref(false);
const uploadError = ref("");
const submitting = ref(false);
const submitError = ref("");

async function handleLetterUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  uploadingLetter.value = true;
  uploadError.value = "";
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await authFetch<{ data: { url: string } }>(
      "/api/upload/reissue-letter",
      { method: "POST", body: formData }
    );
    letterScanUrl.value = response.data.url;
  } catch (e: any) {
    uploadError.value =
      e.data?.message || e.data?.statusMessage || "Failed to upload letter";
  } finally {
    uploadingLetter.value = false;
  }
}

const canSubmit = computed(() => {
  if (decisionForm.value.status === "APPROVED") {
    return !!letterScanUrl.value && !!decisionForm.value.approverType;
  }
  if (decisionForm.value.status === "DECLINED") {
    return !!decisionForm.value.decisionReason;
  }
  return false;
});

async function submitDecision() {
  if (!canSubmit.value) return;

  submitting.value = true;
  submitError.value = "";
  try {
    await authFetch(`/api/legal/form-reissues/${id}/decision`, {
      method: "POST",
      body: {
        status: decisionForm.value.status,
        letterScanUrl:
          decisionForm.value.status === "APPROVED" ? letterScanUrl.value : undefined,
        approverType:
          decisionForm.value.status === "APPROVED"
            ? decisionForm.value.approverType
            : undefined,
        approverDetail: decisionForm.value.approverDetail || undefined,
        decisionReason: decisionForm.value.decisionReason || undefined,
      },
    });
    decisionForm.value = { status: "", approverType: "", approverDetail: "", decisionReason: "" };
    letterScanUrl.value = "";
    await refresh();
  } catch (e: any) {
    submitError.value = e.data?.message || e.data?.statusMessage || "Failed to submit decision";
  } finally {
    submitting.value = false;
  }
}

const statusColors: Record<string, string> = {
  PENDING: TONE_BADGE.amber,
  APPROVED: TONE_BADGE.green,
  DECLINED: TONE_BADGE.red,
};

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DECLINED: "Declined",
};

const approverLabels: Record<string, string> = {
  AUDITOR_GENERAL: "Auditor General",
  REGIONAL_AUDITOR: "Regional Auditor",
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
</script>

<template>
  <div class="space-y-6">
    <NuxtLink to="/legal/form-reissues" class="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Reissue Requests
    </NuxtLink>

    <!-- Loading -->
    <div v-if="pending" class="space-y-4">
      <Skeleton class="h-8 w-64" />
      <Card><CardContent class="p-6"><Skeleton class="h-40 w-full" /></CardContent></Card>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-destructive">Failed to load reissue request</p>
      <Button variant="link" class="mt-4" @click="refresh()">Try again</Button>
    </div>

    <template v-else-if="request">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">
            {{ declaration?.applicant?.fullName }}
          </h1>
          <p class="text-muted-foreground font-mono">{{ declaration?.uniqueCode }}</p>
        </div>
        <span
          class="px-4 py-2 rounded-full text-sm font-medium"
          :class="statusColors[request.status] || 'bg-muted'"
        >
          {{ statusLabels[request.status] || request.status }}
        </span>
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Left column -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Applicant / declaration -->
          <Card>
            <CardHeader><CardTitle>Applicant & Declaration</CardTitle></CardHeader>
            <CardContent>
              <dl class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt class="text-muted-foreground">Full Name</dt>
                  <dd class="font-medium">{{ declaration?.applicant?.fullName }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Ghana Card Number</dt>
                  <dd class="font-mono font-medium">{{ declaration?.applicant?.ghanaCardNumber }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Email</dt>
                  <dd class="font-medium">{{ declaration?.applicant?.user?.email }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Declaration Code</dt>
                  <dd class="font-mono font-medium">{{ declaration?.uniqueCode }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Requested</dt>
                  <dd class="font-medium">{{ formatDate(request.createdAt) }}</dd>
                </div>
                <div v-if="request.applicantNote" class="col-span-2">
                  <dt class="text-muted-foreground">Applicant Note</dt>
                  <dd class="font-medium">{{ request.applicantNote }}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <!-- Form collection -->
          <Card v-if="formCollection">
            <CardHeader><CardTitle>Original Form Collection</CardTitle></CardHeader>
            <CardContent>
              <dl class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt class="text-muted-foreground">Collection Office</dt>
                  <dd class="font-medium">{{ formCollection.collectionOffice?.name }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Collected At</dt>
                  <dd class="font-medium">{{ formatDate(formCollection.collectedAt) }}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <!-- Reissue history -->
          <Card>
            <CardHeader><CardTitle>Reissue Request History</CardTitle></CardHeader>
            <CardContent>
              <div v-if="!history.length" class="text-sm text-muted-foreground text-center py-4">
                No prior requests
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="h in history"
                  :key="h.id"
                  class="border-l-2 pl-4 pb-4"
                  :class="{
                    'border-amber-500': h.status === 'PENDING',
                    'border-green-500': h.status === 'APPROVED',
                    'border-red-500': h.status === 'DECLINED',
                  }"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="px-2 py-0.5 rounded text-xs font-medium"
                      :class="statusColors[h.status] || 'bg-muted'"
                    >
                      {{ statusLabels[h.status] || h.status }}
                    </span>
                    <span class="text-xs text-muted-foreground">{{ formatDate(h.createdAt) }}</span>
                  </div>
                  <p v-if="h.applicantNote" class="text-sm mt-1">{{ h.applicantNote }}</p>
                  <p v-if="h.status !== 'PENDING'" class="text-xs text-muted-foreground mt-1">
                    <template v-if="h.status === 'APPROVED'">
                      Approved ({{ approverLabels[h.approverType] || h.approverType }}<span v-if="h.approverDetail"> — {{ h.approverDetail }}</span>)
                    </template>
                    <template v-else>Declined: {{ h.decisionReason }}</template>
                    <span v-if="h.reviewedBy?.email"> by {{ h.reviewedBy.email }}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Right column: decision panel -->
        <div class="space-y-6">
          <Card v-if="request.status === 'PENDING'">
            <CardHeader><CardTitle>Record Decision</CardTitle></CardHeader>
            <CardContent>
              <div class="space-y-4">
                <div>
                  <label class="text-sm font-medium mb-2 block">Decision</label>
                  <Select v-model="decisionForm.status">
                    <SelectTrigger>
                      <SelectValue placeholder="Select decision..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APPROVED">Approve & Reissue</SelectItem>
                      <SelectItem value="DECLINED">Decline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <template v-if="decisionForm.status === 'APPROVED'">
                  <div>
                    <label class="text-sm font-medium mb-2 block">
                      Scanned Approved Letter <span class="text-destructive">*</span>
                    </label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      class="w-full text-sm"
                      @change="handleLetterUpload"
                    />
                    <p v-if="uploadingLetter" class="text-xs text-muted-foreground mt-1">Uploading...</p>
                    <p v-else-if="letterScanUrl" class="text-xs text-green-600 dark:text-green-400 mt-1">Letter uploaded</p>
                    <p v-if="uploadError" class="text-xs text-destructive mt-1">{{ uploadError }}</p>
                  </div>

                  <div>
                    <label class="text-sm font-medium mb-2 block">
                      Approved By <span class="text-destructive">*</span>
                    </label>
                    <Select v-model="decisionForm.approverType">
                      <SelectTrigger>
                        <SelectValue placeholder="Select approver..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUDITOR_GENERAL">Auditor General</SelectItem>
                        <SelectItem value="REGIONAL_AUDITOR">Regional Auditor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label class="text-sm font-medium mb-2 block">
                      Approver Detail <span class="text-muted-foreground">(optional)</span>
                    </label>
                    <input
                      v-model="decisionForm.approverDetail"
                      type="text"
                      placeholder="e.g. Regional Auditor, Ashanti"
                      class="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label class="text-sm font-medium mb-2 block">
                      Reasons <span class="text-muted-foreground">(optional)</span>
                    </label>
                    <textarea
                      v-model="decisionForm.decisionReason"
                      rows="3"
                      class="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Any notes about this reissue..."
                    />
                  </div>
                </template>

                <div v-else-if="decisionForm.status === 'DECLINED'">
                  <label class="text-sm font-medium mb-2 block">
                    Reason <span class="text-destructive">*</span>
                  </label>
                  <textarea
                    v-model="decisionForm.decisionReason"
                    rows="3"
                    class="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Explain why the reissue is declined..."
                  />
                </div>

                <div v-if="submitError" class="text-sm text-destructive">{{ submitError }}</div>

                <Button
                  class="w-full"
                  :disabled="!canSubmit || submitting || uploadingLetter"
                  @click="submitDecision"
                >
                  {{ submitting ? "Submitting..." : "Submit Decision" }}
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- Recorded decision (already decided) -->
          <Card v-else>
            <CardHeader><CardTitle>Decision Recorded</CardTitle></CardHeader>
            <CardContent class="space-y-2 text-sm">
              <div class="flex items-center gap-2">
                <span
                  class="px-2 py-0.5 rounded text-xs font-medium"
                  :class="statusColors[request.status] || 'bg-muted'"
                >
                  {{ statusLabels[request.status] || request.status }}
                </span>
                <span class="text-xs text-muted-foreground">{{ formatDate(request.reviewedAt) }}</span>
              </div>
              <p v-if="request.status === 'APPROVED'">
                Approved by {{ approverLabels[request.approverType] || request.approverType }}
                <span v-if="request.approverDetail"> — {{ request.approverDetail }}</span>
              </p>
              <p v-if="request.decisionReason">{{ request.decisionReason }}</p>
              <a
                v-if="request.letterScanUrl"
                :href="request.letterScanUrl"
                target="_blank"
                class="text-primary underline"
              >
                View approved letter
              </a>
              <p class="text-xs text-muted-foreground">by {{ request.reviewedBy?.email }}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </template>
  </div>
</template>
