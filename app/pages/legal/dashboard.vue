<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const { getAuthHeaders } = useAuth();

const recentVerifications = ref<Array<{
  code: string;
  applicantName: string;
  status: string;
  verifiedAt: string;
}>>([]);

const stats = ref({
  todayVerifications: 0,
  weekVerifications: 0,
  monthVerifications: 0,
});
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Legal Unit Dashboard" description="Verify declaration codes and recall applicant information" />

    <!-- Quick Verify Card -->
    <Card>
      <CardHeader>
        <CardTitle>Quick Code Verification</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-muted-foreground mb-4">
          Enter a unique declaration code to verify its authenticity and view applicant details.
        </p>
        <Button as-child>
          <NuxtLink to="/legal/verify" class="inline-flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Verify Code
          </NuxtLink>
        </Button>
      </CardContent>
    </Card>

    <!-- Info Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Verification Process</CardTitle>
        </CardHeader>
        <CardContent>
          <ol class="space-y-3 text-sm text-muted-foreground">
            <li class="flex gap-3">
              <span class="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">1</span>
              <span>Receive unique code from applicant or officer</span>
            </li>
            <li class="flex gap-3">
              <span class="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">2</span>
              <span>Enter code in verification system</span>
            </li>
            <li class="flex gap-3">
              <span class="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">3</span>
              <span>View applicant details and declaration status</span>
            </li>
            <li class="flex gap-3">
              <span class="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">4</span>
              <span>Confirm authenticity to requesting party</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Code Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div>
              <p class="text-sm text-muted-foreground mb-2">Valid codes follow this format:</p>
              <code class="block px-4 py-2 bg-muted rounded text-sm font-mono">
                ADLA-YYYYMMDD-XXXXX
              </code>
            </div>
            <div class="text-sm text-muted-foreground">
              <p><strong>ADLA</strong> - System prefix</p>
              <p><strong>YYYYMMDD</strong> - Date issued</p>
              <p><strong>XXXXX</strong> - Unique identifier</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Declaration Statuses Reference -->
    <Card>
      <CardHeader>
        <CardTitle>Declaration Status Reference</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div class="text-center p-3 bg-muted/50 rounded-lg">
            <StatusBadge status="PENDING" class="mb-2" />
            <p class="text-xs text-muted-foreground">Code issued, not submitted</p>
          </div>
          <div class="text-center p-3 bg-muted/50 rounded-lg">
            <StatusBadge status="SUBMITTED" class="mb-2" />
            <p class="text-xs text-muted-foreground">Awaiting recording</p>
          </div>
          <div class="text-center p-3 bg-muted/50 rounded-lg">
            <StatusBadge status="UNDER_REVIEW" class="mb-2" />
            <p class="text-xs text-muted-foreground">Being reviewed</p>
          </div>
          <div class="text-center p-3 bg-muted/50 rounded-lg">
            <StatusBadge status="APPROVED" class="mb-2" />
            <p class="text-xs text-muted-foreground">Approved, pending receipt</p>
          </div>
          <div class="text-center p-3 bg-muted/50 rounded-lg">
            <StatusBadge status="SEALED" class="mb-2" />
            <p class="text-xs text-muted-foreground">Receipt generated</p>
          </div>
          <div class="text-center p-3 bg-muted/50 rounded-lg">
            <StatusBadge status="REJECTED" class="mb-2" />
            <p class="text-xs text-muted-foreground">Requires resubmission</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
