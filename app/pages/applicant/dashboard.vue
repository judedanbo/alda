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
}

interface ApplicantDashboardData {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  activeDeclaration: ActiveDeclaration | null;
  codeHistory: CodeHistoryEntry[];
  verificationCount: number;
  timeline: { month: string; count: number }[];
}

const verificationInfo = ref<{ reason?: string; messageToApplicant?: string } | null>(null);

async function fetchVerificationInfo() {
  if (user.value?.hasProfile && !isVerified.value) {
    try {
      const response = await authFetch<{ data: { latestReview: { reason?: string; messageToApplicant?: string } } }>(
        "/api/applicant/verification",
      );
      verificationInfo.value = response.data.latestReview;
    } catch {
      // Banner shows without details
    }
  }
}

const { data: dashboard, loading } = useDashboardStats<ApplicantDashboardData>("/api/declarations/stats");

onMounted(() => {
  fetchVerificationInfo();
});

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const timelineSeries = computed(() => [
  { name: "Declarations", data: dashboard.value?.timeline.map((t) => t.count) ?? [] },
]);
const timelineOptions = computed(() => ({
  xaxis: {
    categories:
      dashboard.value?.timeline.map((t) => {
        const [y, m] = t.month.split("-");
        return `${monthLabels[Number(m) - 1]} ${y!.slice(2)}`;
      }) ?? [],
  },
}));

const showCodeHistory = ref(false);

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

    <!-- Email Verification Banner -->
    <div
      v-if="user && !isEmailVerified"
      class="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p class="font-medium text-amber-800">Please verify your email</p>
          <p class="text-sm text-amber-600">
            Check your inbox for the verification link, or request a new one.
          </p>
        </div>
      </div>
      <Button size="sm" variant="outline" :disabled="resendLoading" @click="resendVerification">
        {{ resendLoading ? "Sending..." : "Resend" }}
      </Button>
    </div>

    <!-- Profile Setup Alert -->
    <Alert v-if="!user?.hasProfile" class="border-warning/20 bg-warning/10">
      <svg class="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <AlertTitle>Complete Your Profile</AlertTitle>
      <AlertDescription>
        <p>You need to complete your profile before you can submit asset declarations.</p>
        <Button as-child class="mt-3" size="sm">
          <NuxtLink to="/applicant/profile/setup">Complete Profile</NuxtLink>
        </Button>
      </AlertDescription>
    </Alert>

    <!-- Verification Status Banner -->
    <Alert
      v-if="user?.hasProfile && user?.verificationStatus && user.verificationStatus !== 'VERIFIED'"
      :class="{
        'border-amber-200 bg-amber-50': user.verificationStatus === 'PENDING_VERIFICATION',
        'border-orange-200 bg-orange-50': user.verificationStatus === 'ON_HOLD',
        'border-blue-200 bg-blue-50': user.verificationStatus === 'MORE_INFO_REQUIRED',
        'border-red-200 bg-red-50': user.verificationStatus === 'REJECTED',
      }"
    >
      <svg
        class="w-5 h-5"
        :class="{
          'text-amber-600': user.verificationStatus === 'PENDING_VERIFICATION',
          'text-orange-600': user.verificationStatus === 'ON_HOLD',
          'text-blue-600': user.verificationStatus === 'MORE_INFO_REQUIRED',
          'text-red-600': user.verificationStatus === 'REJECTED',
        }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <AlertTitle>
        <span v-if="user.verificationStatus === 'PENDING_VERIFICATION'">Registration Under Review</span>
        <span v-else-if="user.verificationStatus === 'ON_HOLD'">Registration Under Investigation</span>
        <span v-else-if="user.verificationStatus === 'MORE_INFO_REQUIRED'">Action Required</span>
        <span v-else-if="user.verificationStatus === 'REJECTED'">Registration Not Approved</span>
      </AlertTitle>
      <AlertDescription>
        <p v-if="user.verificationStatus === 'PENDING_VERIFICATION'">
          Your registration is being reviewed by the legal office. You will be notified once a decision is made.
        </p>
        <div v-else-if="user.verificationStatus === 'ON_HOLD'">
          <p>Your registration is under review. Please wait for further updates.</p>
          <p v-if="verificationInfo?.messageToApplicant" class="mt-2 p-3 bg-orange-100 rounded text-sm">
            {{ verificationInfo.messageToApplicant }}
          </p>
        </div>
        <div v-else-if="user.verificationStatus === 'MORE_INFO_REQUIRED'">
          <p>The legal office has requested additional information.</p>
          <p v-if="verificationInfo?.messageToApplicant" class="mt-2 p-3 bg-blue-100 rounded text-sm">
            {{ verificationInfo.messageToApplicant }}
          </p>
          <Button as-child size="sm" class="mt-3">
            <NuxtLink to="/applicant/profile/edit">Edit Profile &amp; Resubmit</NuxtLink>
          </Button>
        </div>
        <div v-else-if="user.verificationStatus === 'REJECTED'">
          <p>Your registration was not approved.</p>
          <p v-if="verificationInfo?.reason" class="mt-2 p-3 bg-red-100 rounded text-sm">
            {{ verificationInfo.reason }}
          </p>
          <Button as-child size="sm" class="mt-3">
            <NuxtLink to="/applicant/profile/edit">Edit Profile &amp; Resubmit</NuxtLink>
          </Button>
        </div>
      </AlertDescription>
    </Alert>

    <!-- Active Code Hero -->
    <Card v-if="dashboard?.activeDeclaration" class="border-primary/30 bg-primary/5">
      <CardContent class="p-6">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="space-y-3 min-w-0">
            <div class="flex items-center gap-2">
              <span class="inline-flex w-2 h-2 rounded-full bg-primary animate-pulse" />
              <p class="text-sm font-medium text-primary">Your Active Declaration Code</p>
            </div>
            <CodeBadge :code="dashboard.activeDeclaration.uniqueCode" size="lg" show-qr />
            <p class="text-xs text-muted-foreground">
              Status: <StatusBadge :status="dashboard.activeDeclaration.status" />
              <span class="ml-2">
                · Issued
                {{ new Date(dashboard.activeDeclaration.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) }}
              </span>
            </p>
            <p class="text-xs text-muted-foreground">
              Share this code with the Legal Unit to verify your declaration.
            </p>
          </div>
          <div class="flex gap-2">
            <Button as-child variant="outline" size="sm">
              <NuxtLink :to="`/applicant/declaration/${dashboard.activeDeclaration.id}`">
                View Details
              </NuxtLink>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Declarations"
        :value="dashboard?.total ?? 0"
        :loading="loading"
        icon-bg="bg-blue-100"
        icon-color="text-blue-600"
        icon-path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
      <StatCard
        label="Pending Review"
        :value="dashboard?.pending ?? 0"
        :loading="loading"
        icon-bg="bg-yellow-100"
        icon-color="text-yellow-600"
        icon-path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
      <StatCard
        label="Approved"
        :value="dashboard?.approved ?? 0"
        :loading="loading"
        value-color="text-emerald-600"
        icon-bg="bg-emerald-100"
        icon-color="text-emerald-600"
        icon-path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
      <StatCard
        label="Rejected"
        :value="dashboard?.rejected ?? 0"
        :loading="loading"
        value-color="text-red-600"
        icon-bg="bg-red-100"
        icon-color="text-red-600"
        icon-path="M6 18L18 6M6 6l12 12"
      />
    </div>

    <!-- Verification activity + Quick actions -->
    <div class="grid md:grid-cols-3 gap-4">
      <StatCard
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
              class="flex items-center gap-3 p-3 rounded-md border hover:bg-muted transition-colors"
              :class="{ 'opacity-50 pointer-events-none': !user?.hasProfile || !isVerified }"
            >
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p class="font-medium text-sm">New Declaration</p>
                <p class="text-xs text-muted-foreground">Submit a new declaration</p>
              </div>
            </NuxtLink>
            <NuxtLink
              to="/applicant/declarations"
              class="flex items-center gap-3 p-3 rounded-md border hover:bg-muted transition-colors"
            >
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p class="font-medium text-sm">All Declarations</p>
                <p class="text-xs text-muted-foreground">See your full history</p>
              </div>
            </NuxtLink>
            <NuxtLink
              v-if="user?.hasProfile"
              to="/applicant/profile/edit"
              class="flex items-center gap-3 p-3 rounded-md border hover:bg-muted transition-colors"
            >
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p class="font-medium text-sm">Edit Profile</p>
                <p class="text-xs text-muted-foreground">Update office details</p>
              </div>
            </NuxtLink>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Timeline chart + Code history -->
    <div class="grid lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2">
        <ChartCard
          title="Declarations Over Time"
          description="Your declaration activity over the last 12 months"
          type="area"
          :series="timelineSeries"
          :options="timelineOptions"
          :loading="loading"
          :height="280"
        />
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
              {{ showCodeHistory ? "Show less" : `Show all (${dashboard?.codeHistory.length})` }}
            </Button>
          </CardTitle>
          <CardDescription>Past codes issued to you</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="space-y-2">
            <Skeleton v-for="i in 3" :key="i" class="h-10 w-full" />
          </div>
          <div v-else-if="!dashboard?.codeHistory.length" class="text-sm text-muted-foreground py-4 text-center">
            No declaration codes yet.
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="entry in (showCodeHistory ? dashboard.codeHistory : dashboard.codeHistory.slice(0, 3))"
              :key="entry.id"
              class="flex items-center justify-between gap-2 p-2 rounded border bg-muted/30"
            >
              <div class="min-w-0 flex-1">
                <code class="font-mono text-xs">{{ entry.uniqueCode }}</code>
                <p class="text-xs text-muted-foreground mt-1">
                  {{ new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) }}
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
