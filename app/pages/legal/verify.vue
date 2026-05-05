<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();

interface VerificationResult {
  declaration: {
    id: string;
    uniqueCode: string;
    status: string;
    submittedAt: string | null;
    createdAt: string;
    applicant: {
      fullName: string;
      ghanaCardNumber: string;
      designation: string;
      ghanaCardFrontUrl: string | null;
      ghanaCardBackUrl: string | null;
      institution: { name: string } | null;
      officeCategory: { name: string; articleReference: string | null } | null;
      user: {
        email: string;
        phone: string | null;
        emailVerified: boolean;
        createdAt: string;
      };
    };
    submissions: Array<{
      submissionDate: string;
      notes: string | null;
      recorder: { email: string };
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
    pickupAuthorization: {
      isSelfPickup: boolean;
      authorizedName: string | null;
      authorizedPhone: string | null;
      pickedUp: boolean;
      pickupDate: string | null;
    } | null;
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
const verificationResult = ref<VerificationResult | null>(null);

const verifyCode = async () => {
  if (!code.value.trim()) {
    verificationError.value = "Please enter a code";
    return;
  }

  isVerifying.value = true;
  verificationError.value = "";
  verificationResult.value = null;

  try {
    const response = await $fetch(`/api/verify/${encodeURIComponent(code.value.trim())}`, {
      headers: authStore.getAuthHeaders(),
    });

    if (response.success) {
      verificationResult.value = response.data as unknown as VerificationResult;
    }
  } catch (error: any) {
    verificationError.value = error.data?.statusMessage || "Verification failed. Code may be invalid.";
  } finally {
    isVerifying.value = false;
  }
};

const clearResults = () => {
  code.value = "";
  verificationResult.value = null;
  verificationError.value = "";
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

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-700",
    SUBMITTED: "bg-blue-100 text-blue-700",
    UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-green-100 text-green-700",
    SEALED: "bg-purple-100 text-purple-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-red-100 text-red-700",
  };
  return colors[status] || "bg-gray-100 text-gray-700";
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-foreground">Code Verification</h1>
        <p class="text-muted-foreground mt-1">Verify declaration codes and view applicant information</p>
      </div>
      <NuxtLink to="/legal/dashboard" class="text-sm text-primary hover:underline">Back to Dashboard</NuxtLink>
    </div>

    <!-- Search Card -->
    <div class="bg-card border rounded-lg p-6">
      <div class="max-w-xl">
        <label class="block text-sm font-medium text-foreground mb-2">Enter Unique Code</label>
        <div class="flex gap-3">
          <input
            v-model="code"
            type="text"
            placeholder="ADLA-XXXXXXXX-XXXXX"
            class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary font-mono uppercase"
            @keyup.enter="verifyCode"
          />
          <button
            :disabled="isVerifying"
            class="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            @click="verifyCode"
          >
            {{ isVerifying ? 'Verifying...' : 'Verify' }}
          </button>
        </div>
        <p class="text-xs text-muted-foreground mt-2">
          Enter the unique declaration code to verify its authenticity
        </p>
      </div>
    </div>

    <!-- Error -->
    <div v-if="verificationError" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-center gap-3">
        <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p class="font-medium text-red-700">Verification Failed</p>
          <p class="text-sm text-red-600">{{ verificationError }}</p>
        </div>
      </div>
    </div>

    <!-- Verification Result -->
    <div v-if="verificationResult" class="space-y-6">
      <!-- Verification Badge -->
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p class="font-semibold text-green-700">Code Verified</p>
            <p class="text-sm text-green-600">
              Verified at {{ formatDate(verificationResult.verification.verifiedAt) }}
            </p>
          </div>
          <button
            class="ml-auto text-sm text-green-700 hover:underline"
            @click="clearResults"
          >
            New Search
          </button>
        </div>
      </div>

      <!-- Declaration Info -->
      <div class="bg-card border rounded-lg overflow-hidden">
        <div class="p-4 bg-muted/50 border-b flex items-center justify-between">
          <div>
            <h3 class="font-semibold text-foreground">Declaration Details</h3>
            <p class="text-sm font-mono text-primary">{{ verificationResult.declaration.uniqueCode }}</p>
          </div>
          <span :class="['px-3 py-1 text-sm font-medium rounded-full', getStatusColor(verificationResult.declaration.status)]">
            {{ verificationResult.declaration.status }}
          </span>
        </div>

        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Applicant Info -->
          <div class="space-y-4">
            <h4 class="font-medium text-foreground border-b pb-2">Applicant Information</h4>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-muted-foreground">Full Name:</span>
                <span class="font-medium">{{ verificationResult.declaration.applicant.fullName }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">Ghana Card:</span>
                <span class="font-mono">{{ verificationResult.declaration.applicant.ghanaCardNumber }}</span>
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
                <span class="font-medium">{{ verificationResult.declaration.applicant.designation }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">Institution:</span>
                <span>{{ verificationResult.declaration.applicant.institution?.name || 'N/A' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">Category:</span>
                <span>{{ verificationResult.declaration.applicant.officeCategory?.name || 'N/A' }}</span>
              </div>
              <div v-if="verificationResult.declaration.applicant.officeCategory?.articleReference" class="flex justify-between">
                <span class="text-muted-foreground">Article:</span>
                <span>{{ verificationResult.declaration.applicant.officeCategory.articleReference }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="bg-card border rounded-lg p-6">
        <h4 class="font-medium text-foreground mb-4">Declaration Timeline</h4>
        <div class="space-y-4">
          <div v-for="(event, index) in verificationResult.declaration.statusHistory" :key="index" class="flex gap-4">
            <div class="flex flex-col items-center">
              <div :class="['w-3 h-3 rounded-full', index === 0 ? 'bg-primary' : 'bg-gray-300']" />
              <div v-if="index < verificationResult.declaration.statusHistory.length - 1" class="w-0.5 h-full bg-gray-200 my-1" />
            </div>
            <div class="flex-1 pb-4">
              <div class="flex items-center gap-2">
                <span :class="['px-2 py-0.5 text-xs font-medium rounded', getStatusColor(event.status)]">
                  {{ event.status }}
                </span>
                <span class="text-xs text-muted-foreground">{{ formatDate(event.createdAt) }}</span>
              </div>
              <p v-if="event.notes" class="text-sm text-muted-foreground mt-1">{{ event.notes }}</p>
              <p v-if="event.changedBy" class="text-xs text-muted-foreground">by {{ event.changedBy.email }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Receipt Info -->
      <div v-if="verificationResult.declaration.receipts[0]" class="bg-card border rounded-lg p-6">
        <h4 class="font-medium text-foreground mb-4">Receipt Information</h4>
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
        <div v-if="verificationResult.declaration.pickupAuthorization" class="mt-4 pt-4 border-t">
          <p class="text-sm">
            <span class="text-muted-foreground">Pickup Status:</span>
            <span :class="verificationResult.declaration.pickupAuthorization.pickedUp ? 'text-green-600' : 'text-yellow-600'" class="ml-2 font-medium">
              {{ verificationResult.declaration.pickupAuthorization.pickedUp ? 'Collected' : 'Pending Collection' }}
            </span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
