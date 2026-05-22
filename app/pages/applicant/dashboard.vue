<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const { user, isEmailVerified, isVerified } = useAuth();

interface CodeHistoryEntry {
  id: string;
  uniqueCode: string;
  status: string;
  createdAt: string;
}

interface ActiveDeclaration {
  id: string;
  uniqueCode: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  unresolvedComments: number;
}

interface ApplicantDashboardData {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  activeDeclaration: ActiveDeclaration | null;
  codeHistory: CodeHistoryEntry[];
  verificationCount: number;
}

const verificationInfo = ref<{
  reason?: string;
  messageToApplicant?: string;
} | null>(null);

async function fetchVerificationInfo() {
  if (user.value?.hasProfile && !isVerified.value) {
    try {
      const response = await authFetch<{
        data: {
          latestReview: { reason?: string; messageToApplicant?: string };
        };
      }>("/api/applicant/verification");
      verificationInfo.value = response.data.latestReview;
    } catch {
      // Banner shows without details
    }
  }
}

const { data: dashboard, loading } = useDashboardStats<ApplicantDashboardData>(
  "/api/declarations/stats",
);

onMounted(() => {
  fetchVerificationInfo();
});

const showCodeHistory = ref(false);
const codeCopied = ref(false);

const canCreateDeclaration = computed(
  () =>
    user.value?.hasProfile &&
    isVerified.value &&
    !dashboard.value?.activeDeclaration,
);

async function copyCode() {
  const code = dashboard.value?.activeDeclaration?.uniqueCode;
  if (!code) return;
  await navigator.clipboard.writeText(code);
  codeCopied.value = true;
  setTimeout(() => {
    codeCopied.value = false;
  }, 2000);
}

const resendLoading = ref(false);

async function resendVerification() {
  resendLoading.value = true;
  try {
    await authFetch("/api/auth/resend-verification", { method: "POST" });
    alert("Verification email sent! Check your inbox.");
  } catch (e) {
    const err = e as { data?: { message?: string } };
    alert(err.data?.message || "Failed to send verification email.");
  } finally {
    resendLoading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="'Welcome' + (user?.fullName ? ', ' + user.fullName : '')"
      description="Manage your asset declarations and track their status"
    />

    <AnalyticsSealedSummaryWidget role="applicant" />

    <!-- Email Verification Banner -->
    <div
      v-if="user && !isEmailVerified"
      class="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between dark:bg-amber-950/30 dark:border-amber-900"
    >
      <div class="flex items-center gap-3">
        <svg
          class="w-5 h-5 text-amber-600 flex-shrink-0 dark:text-amber-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <p class="font-medium text-amber-800 dark:text-amber-200">Please verify your email</p>
          <p class="text-sm text-amber-600 dark:text-amber-400">
            Check your inbox for the verification link, or request a new one.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        :disabled="resendLoading"
        @click="resendVerification"
      >
        {{ resendLoading ? "Sending..." : "Resend" }}
      </Button>
    </div>

    <!-- Profile Setup Alert -->
    <Alert v-if="!user?.hasProfile" class="border-warning/20 bg-warning/10">
      <svg
        class="w-5 h-5 text-warning"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <AlertTitle>Complete Your Profile</AlertTitle>
      <AlertDescription>
        <p>
          You need to complete your profile before you can submit asset
          declarations.
        </p>
        <Button as-child class="mt-3" size="sm">
          <NuxtLink to="/applicant/profile/setup">Complete Profile</NuxtLink>
        </Button>
      </AlertDescription>
    </Alert>

    <!-- Verification Status Banner -->
    <Alert
      v-if="
        user?.hasProfile &&
        user?.verificationStatus &&
        user.verificationStatus !== 'VERIFIED'
      "
      :class="{
        'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30':
          user.verificationStatus === 'PENDING_VERIFICATION',
        'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30':
          user.verificationStatus === 'ON_HOLD',
        'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30':
          user.verificationStatus === 'MORE_INFO_REQUIRED',
        'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30':
          user.verificationStatus === 'REJECTED',
      }"
    >
      <svg
        class="w-5 h-5"
        :class="{
          'text-amber-600 dark:text-amber-400': user.verificationStatus === 'PENDING_VERIFICATION',
          'text-orange-600 dark:text-orange-400': user.verificationStatus === 'ON_HOLD',
          'text-blue-600 dark:text-blue-400': user.verificationStatus === 'MORE_INFO_REQUIRED',
          'text-red-600 dark:text-red-400': user.verificationStatus === 'REJECTED',
        }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <AlertTitle>
        <span v-if="user.verificationStatus === 'PENDING_VERIFICATION'"
          >Registration Under Review</span
        >
        <span v-else-if="user.verificationStatus === 'ON_HOLD'"
          >Registration Under Investigation</span
        >
        <span v-else-if="user.verificationStatus === 'MORE_INFO_REQUIRED'"
          >Action Required</span
        >
        <span v-else-if="user.verificationStatus === 'REJECTED'"
          >Registration Not Approved</span
        >
      </AlertTitle>
      <AlertDescription>
        <p v-if="user.verificationStatus === 'PENDING_VERIFICATION'">
          Your registration is being reviewed by the legal office. You will be
          notified once a decision is made.
        </p>
        <div v-else-if="user.verificationStatus === 'ON_HOLD'">
          <p>
            Your registration is under review. Please wait for further updates.
          </p>
          <p
            v-if="verificationInfo?.messageToApplicant"
            class="mt-2 p-3 bg-orange-100 rounded text-sm dark:bg-orange-950/40"
          >
            {{ verificationInfo.messageToApplicant }}
          </p>
        </div>
        <div v-else-if="user.verificationStatus === 'MORE_INFO_REQUIRED'">
          <p>The legal office has requested additional information.</p>
          <p
            v-if="verificationInfo?.messageToApplicant"
            class="mt-2 p-3 bg-blue-100 rounded text-sm dark:bg-blue-950/40"
          >
            {{ verificationInfo.messageToApplicant }}
          </p>
          <Button as-child size="sm" class="mt-3">
            <NuxtLink to="/applicant/profile/edit"
              >Edit Profile &amp; Resubmit</NuxtLink
            >
          </Button>
        </div>
        <div v-else-if="user.verificationStatus === 'REJECTED'">
          <p>Your registration was not approved.</p>
          <p
            v-if="verificationInfo?.reason"
            class="mt-2 p-3 bg-red-100 rounded text-sm dark:bg-red-950/40"
          >
            {{ verificationInfo.reason }}
          </p>
          <Button as-child size="sm" class="mt-3">
            <NuxtLink to="/applicant/profile/edit"
              >Edit Profile &amp; Resubmit</NuxtLink
            >
          </Button>
        </div>
      </AlertDescription>
    </Alert>

    <!-- Active Code Hero -->
    <Card
      v-if="dashboard?.activeDeclaration"
      class="border-primary/30 bg-primary/5"
    >
      <CardContent class="p-6">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="space-y-3 min-w-0">
            <div class="flex items-center gap-2">
              <span
                class="inline-flex w-2 h-2 rounded-full bg-primary animate-pulse"
              />
              <p class="text-sm font-medium text-primary">
                Your Active Declaration
              </p>
            </div>
            <div class="flex items-start gap-2">
              <p
                class="text-2xl font-bold font-mono tracking-wide text-foreground"
              >
                {{ dashboard.activeDeclaration.uniqueCode }}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Copy code"
                @click="copyCode"
              >
                <svg
                  v-if="!codeCopied"
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <svg
                  v-else
                  class="w-4 h-4 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </Button>
              <AppCodeBadge
                :code="dashboard.activeDeclaration.uniqueCode"
                size="lg"
                show-qr
              />
            </div>
            <p class="text-xs text-muted-foreground">
              Status:
              <StatusBadge :status="dashboard.activeDeclaration.status" />
              <span class="ml-2">
                · Issued
                {{
                  new Date(
                    dashboard.activeDeclaration.createdAt,
                  ).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                }}
              </span>
            </p>
            <p class="text-xs text-muted-foreground">
              Share this code with the Legal Unit to verify your declaration.
            </p>
          </div>
          <div class="flex gap-2">
            <Button as-child variant="outline" size="sm">
              <NuxtLink
                :to="`/applicant/declaration/${dashboard.activeDeclaration.id}`"
              >
                View Details
              </NuxtLink>
            </Button>
          </div>
        </div>

        <!-- Unresolved Review Comments Banner -->
        <div
          v-if="dashboard.activeDeclaration.unresolvedComments > 0"
          class="mt-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30"
        >
          <svg
            class="w-5 h-5 text-amber-600 shrink-0 dark:text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
              {{ dashboard.activeDeclaration.unresolvedComments }} unresolved
              review
              {{
                dashboard.activeDeclaration.unresolvedComments === 1
                  ? "comment"
                  : "comments"
              }}
            </p>
            <p class="text-xs text-amber-600 dark:text-amber-400">
              A reviewer has flagged sections of your declaration that need
              attention.
            </p>
          </div>
          <Button
            as-child
            size="sm"
            variant="outline"
            class="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
          >
            <NuxtLink
              :to="`/applicant/declaration/${dashboard.activeDeclaration.id}`"
            >
              View Comments
            </NuxtLink>
          </Button>
        </div>

        <!-- New declaration note -->
        <p class="mt-4 text-xs text-muted-foreground italic">
          A new declaration can only be started once this one has been completed
          (sealed) or rejected.
        </p>
      </CardContent>
    </Card>

    <!-- Verification activity + Quick actions -->
    <div class="grid md:grid-cols-3 gap-4">
      <AppStatCard
        label="Verification Lookups"
        :value="dashboard?.verificationCount ?? 0"
        :loading="loading"
        footnote="Times your code was verified by the Legal Unit"
        value-color="text-primary"
        icon-bg="bg-primary/10"
        icon-color="text-primary"
        icon-path="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
      <Card class="md:col-span-2">
        <CardHeader>
          <CardTitle class="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NuxtLink
              to="/applicant/declaration/new"
              class="flex items-center gap-3 p-3 rounded-md border transition-colors"
              :class="
                canCreateDeclaration
                  ? 'hover:bg-muted'
                  : 'opacity-50 pointer-events-none cursor-not-allowed'
              "
            >
              <div
                class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <div>
                <p class="font-medium text-sm">New Declaration</p>
                <p class="text-xs text-muted-foreground">
                  {{
                    canCreateDeclaration
                      ? "Submit a new declaration"
                      : "Active declaration in progress"
                  }}
                </p>
              </div>
            </NuxtLink>
            <NuxtLink
              to="/applicant/declarations"
              class="flex items-center gap-3 p-3 rounded-md border hover:bg-muted transition-colors"
            >
              <div
                class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <p class="font-medium text-sm">All Declarations</p>
                <p class="text-xs text-muted-foreground">
                  See your full history
                </p>
              </div>
            </NuxtLink>
            <NuxtLink
              v-if="user?.hasProfile"
              to="/applicant/profile/edit"
              class="flex items-center gap-3 p-3 rounded-md border hover:bg-muted transition-colors"
            >
              <div
                class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <svg
                  class="w-5 h-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <p class="font-medium text-sm">Edit Profile</p>
                <p class="text-xs text-muted-foreground">
                  Update office details
                </p>
              </div>
            </NuxtLink>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Summary + Code history -->
    <div class="grid lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2">
        <Card>
          <CardHeader class="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle class="text-base">Declarations Overview</CardTitle>
              <CardDescription
                >Your declaration activity at a glance</CardDescription
              >
            </div>
            <NuxtLink
              to="/applicant/analytics"
              class="text-xs text-primary hover:underline"
            >
              View Full Analytics →
            </NuxtLink>
          </CardHeader>
          <CardContent>
            <Skeleton v-if="loading" class="h-24 w-full" />
            <div v-else class="grid grid-cols-4 gap-4">
              <div class="text-center p-3 bg-blue-500/5 rounded-lg">
                <p class="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                  {{ dashboard?.total ?? 0 }}
                </p>
                <p class="text-[10px] text-muted-foreground mt-1">Total</p>
              </div>
              <div class="text-center p-3 bg-yellow-500/5 rounded-lg">
                <p class="text-2xl font-extrabold text-yellow-600 dark:text-yellow-400">
                  {{ dashboard?.pending ?? 0 }}
                </p>
                <p class="text-[10px] text-muted-foreground mt-1">Pending</p>
              </div>
              <div class="text-center p-3 bg-emerald-500/5 rounded-lg">
                <p class="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {{ dashboard?.approved ?? 0 }}
                </p>
                <p class="text-[10px] text-muted-foreground mt-1">Approved</p>
              </div>
              <div class="text-center p-3 bg-red-500/5 rounded-lg">
                <p class="text-2xl font-extrabold text-red-600 dark:text-red-400">
                  {{ dashboard?.rejected ?? 0 }}
                </p>
                <p class="text-[10px] text-muted-foreground mt-1">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle class="text-base flex items-center justify-between">
            Code History
            <Button
              v-if="(dashboard?.codeHistory.length ?? 0) > 3"
              size="sm"
              variant="ghost"
              @click="showCodeHistory = !showCodeHistory"
            >
              {{
                showCodeHistory
                  ? "Show less"
                  : `Show all (${dashboard?.codeHistory.length})`
              }}
            </Button>
          </CardTitle>
          <CardDescription>Past codes issued to you</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="space-y-2">
            <Skeleton v-for="i in 3" :key="i" class="h-10 w-full" />
          </div>
          <div
            v-else-if="!dashboard?.codeHistory.length"
            class="text-sm text-muted-foreground py-4 text-center"
          >
            No declaration codes yet.
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="entry in showCodeHistory
                ? dashboard.codeHistory
                : dashboard.codeHistory.slice(0, 3)"
              :key="entry.id"
              class="flex items-center justify-between gap-2 p-2 rounded border bg-muted/30"
            >
              <div class="min-w-0 flex-1">
                <code class="font-mono text-xs">{{ entry.uniqueCode }}</code>
                <p class="text-xs text-muted-foreground mt-1">
                  {{
                    new Date(entry.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  }}
                </p>
              </div>
              <StatusBadge :status="entry.status" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
