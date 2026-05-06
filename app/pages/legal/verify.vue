<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const { getAuthHeaders } = useAuth();

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
      headers: getAuthHeaders(),
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
              @keyup.enter="verifyCode"
            />
            <Button :disabled="isVerifying" @click="verifyCode">
              {{ isVerifying ? 'Verifying...' : 'Verify' }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            Enter the unique declaration code to verify its authenticity
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- Error -->
    <Alert v-if="verificationError" variant="destructive">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <AlertTitle>Verification Failed</AlertTitle>
      <AlertDescription>{{ verificationError }}</AlertDescription>
    </Alert>

    <!-- Verification Result -->
    <div v-if="verificationResult" class="space-y-6">
      <!-- Verification Badge -->
      <Alert class="border-green-200 bg-green-50 text-green-700">
        <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <AlertTitle class="text-green-700">Code Verified</AlertTitle>
        <AlertDescription class="text-green-600">
          Verified at {{ formatDate(verificationResult.verification.verifiedAt) }}
        </AlertDescription>
        <AlertAction>
          <Button variant="link" class="text-green-700" @click="clearResults">New Search</Button>
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
                <div :class="['w-3 h-3 rounded-full', index === 0 ? 'bg-primary' : 'bg-gray-300']" />
                <div v-if="index < verificationResult.declaration.statusHistory.length - 1" class="w-0.5 h-full bg-gray-200 my-1" />
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
          <div v-if="verificationResult.declaration.pickupAuthorization" class="mt-4 pt-4 border-t">
            <p class="text-sm">
              <span class="text-muted-foreground">Pickup Status:</span>
              <Badge :class="verificationResult.declaration.pickupAuthorization.pickedUp ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'" class="ml-2">
                {{ verificationResult.declaration.pickupAuthorization.pickedUp ? 'Collected' : 'Pending Collection' }}
              </Badge>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
