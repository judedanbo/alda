<script setup lang="ts">
import { displayId } from "~/utils/displayId";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface VerificationResult {
  declaration: {
    id: string;
    uniqueCode: string;
    status: string;
    submittedAt: string | null;
    createdAt: string;
    applicant: {
      fullName: string;
      idType: import("~/utils/displayId").IdType;
      ghanaCardNumber: string | null;
      alternateIdNumber: string | null;
      ghanaCardFrontUrl: string | null;
      ghanaCardBackUrl: string | null;
      offices: Array<{
        id: string;
        designation: string;
        startDate: string;
        endDate: string | null;
        officeCategory: { name: string; articleReference: string | null } | null;
        institution: { name: string } | null;
      }>;
      user: {
        email: string;
        phone: string | null;
        emailVerified: boolean;
        createdAt: string;
      };
    };
    sectionReviews: Array<{
      id: string;
      section: string;
      isAcceptable: boolean;
      comments: string | null;
      resolvedAt: string | null;
      createdAt: string;
    }>;
    reviews: Array<{
      reviewDate: string;
      status: string;
      rejectionReason: string | null;
      reviewer: { email: string };
    }>;
    receipts: Array<{
      receiptNumber: string;
      pdfUrl: string | null;
      createdAt: string;
    }>;
    statusHistory: Array<{
      status: string;
      notes: string | null;
      createdAt: string;
      changedBy: { email: string } | null;
    }>;
  };
  verification: {
    verified: boolean;
    verifiedAt: string;
    verifiedBy: string;
  };
}

const code = ref("");
const isVerifying = ref(false);
const verificationError = ref("");
const codeError = ref("");
const verificationResult = ref<VerificationResult | null>(null);

const verifyCode = async () => {
  codeError.value = "";
  verificationError.value = "";

  if (!code.value.trim()) {
    codeError.value = "Please enter a declaration code";
    return;
  }

  isVerifying.value = true;
  verificationResult.value = null;

  try {
    const response = await authFetch<{ success: boolean; data: VerificationResult }>(`/api/verify/${encodeURIComponent(code.value.trim())}`);

    if (response.success) {
      verificationResult.value = response.data;
    }
  } catch (error: unknown) {
    const e = error as { data?: { statusMessage?: string } };
    codeError.value = e.data?.statusMessage || "Verification failed. Code may be invalid.";
  } finally {
    isVerifying.value = false;
  }
};

const clearResults = () => {
  code.value = "";
  verificationResult.value = null;
  verificationError.value = "";
  codeError.value = "";
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Code Verification" description="Verify declaration codes and view applicant information">
      <template #actions>
        <Button variant="ghost" as-child>
          <NuxtLink to="/legal/dashboard">Back to Dashboard</NuxtLink>
        </Button>
      </template>
    </PageHeader>

    <!-- Search Card -->
    <Card>
      <CardContent class="pt-6">
        <div class="max-w-xl">
          <Label for="unique-code" class="mb-2">Enter Unique Code</Label>
          <div class="flex gap-3 mt-2">
            <Input
              id="unique-code"
              v-model="code"
              type="text"
              placeholder="ADLA-XXXXXXXX-XXXXX"
              class="flex-1 font-mono uppercase"
              :class="{ 'border-destructive': codeError }"
              @keyup.enter="verifyCode"
              @input="codeError = ''"
            />
            <Button :disabled="isVerifying" @click="verifyCode">
              {{ isVerifying ? 'Verifying...' : 'Verify' }}
            </Button>
          </div>
          <p v-if="codeError" class="text-xs text-destructive mt-2">
            {{ codeError }}
          </p>
          <p v-else class="text-xs text-muted-foreground mt-2">
            Enter the unique declaration code to verify its authenticity
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- Verification Result -->
    <div v-if="verificationResult" class="space-y-6">
      <!-- Verification Badge -->
      <Alert class="border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
        <svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <AlertTitle class="text-green-700 dark:text-green-300">Code Verified</AlertTitle>
        <AlertDescription class="text-green-600 dark:text-green-400">
          Verified at {{ formatDate(verificationResult.verification.verifiedAt) }}
        </AlertDescription>
        <AlertAction>
          <Button variant="link" class="text-green-700 dark:text-green-300" @click="clearResults">New Search</Button>
        </AlertAction>
      </Alert>

      <!-- Declaration Info -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 bg-muted/50">
          <div>
            <CardTitle>Declaration Details</CardTitle>
            <CardDescription class="font-mono text-primary">{{ verificationResult.declaration.uniqueCode }}</CardDescription>
          </div>
          <StatusBadge :status="verificationResult.declaration.status" />
        </CardHeader>
        <CardContent class="pt-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Applicant Info -->
            <div class="space-y-4">
              <h4 class="font-medium text-foreground border-b pb-2">Applicant Information</h4>
              <div class="space-y-3 text-sm">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Full Name:</span>
                  <span class="font-medium">{{ verificationResult.declaration.applicant.fullName }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">{{ displayId(verificationResult.declaration.applicant).label }}:</span>
                  <span class="font-mono">{{ displayId(verificationResult.declaration.applicant).value }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Email:</span>
                  <span>{{ verificationResult.declaration.applicant.user.email }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Phone:</span>
                  <span>{{ verificationResult.declaration.applicant.user.phone || 'N/A' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Registered:</span>
                  <span>{{ formatDate(verificationResult.declaration.applicant.user.createdAt) }}</span>
                </div>
              </div>
            </div>

            <!-- Office Info -->
            <div class="space-y-4">
              <h4 class="font-medium text-foreground border-b pb-2">Office Details</h4>
              <div class="space-y-3 text-sm">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Designation:</span>
                  <span class="font-medium">{{ verificationResult.declaration.applicant.offices?.[0]?.designation || 'N/A' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Institution:</span>
                  <span>{{ verificationResult.declaration.applicant.offices?.[0]?.institution?.name || 'N/A' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Category:</span>
                  <span>{{ verificationResult.declaration.applicant.offices?.[0]?.officeCategory?.name || 'N/A' }}</span>
                </div>
                <div v-if="verificationResult.declaration.applicant.offices?.[0]?.officeCategory?.articleReference" class="flex justify-between">
                  <span class="text-muted-foreground">Article:</span>
                  <span>{{ verificationResult.declaration.applicant.offices?.[0]?.officeCategory?.articleReference }}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Timeline -->
      <Card>
        <CardHeader>
          <CardTitle>Declaration Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div v-for="(event, index) in verificationResult.declaration.statusHistory" :key="index" class="flex gap-4">
              <div class="flex flex-col items-center">
                <div :class="['w-3 h-3 rounded-full', index === 0 ? 'bg-primary' : 'bg-muted-foreground/30']" />
                <div v-if="index < verificationResult.declaration.statusHistory.length - 1" class="w-0.5 h-full bg-border my-1" />
              </div>
              <div class="flex-1 pb-4">
                <div class="flex items-center gap-2">
                  <StatusBadge :status="event.status" />
                  <span class="text-xs text-muted-foreground">{{ formatDate(event.createdAt) }}</span>
                </div>
                <p v-if="event.notes" class="text-sm text-muted-foreground mt-1">{{ event.notes }}</p>
                <p v-if="event.changedBy" class="text-xs text-muted-foreground">by {{ event.changedBy.email }}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Receipt Info -->
      <Card v-if="verificationResult.declaration.receipts[0]">
        <CardHeader>
          <CardTitle>Receipt Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-muted-foreground">Receipt Number:</span>
              <p class="font-mono font-medium">{{ verificationResult.declaration.receipts[0].receiptNumber }}</p>
            </div>
            <div>
              <span class="text-muted-foreground">Generated:</span>
              <p>{{ formatDate(verificationResult.declaration.receipts[0].createdAt) }}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
