<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();

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
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-foreground">Legal Unit Dashboard</h1>
      <p class="text-muted-foreground mt-1">Verify declaration codes and recall applicant information</p>
    </div>

    <!-- Quick Verify Card -->
    <div class="bg-card border rounded-lg p-6">
      <h2 class="text-lg font-semibold text-foreground mb-4">Quick Code Verification</h2>
      <p class="text-muted-foreground mb-4">
        Enter a unique declaration code to verify its authenticity and view applicant details.
      </p>
      <NuxtLink
        to="/legal/verify"
        class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Verify Code
      </NuxtLink>
    </div>

    <!-- Info Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-card border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-3">Verification Process</h3>
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
      </div>

      <div class="bg-card border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-3">Code Format</h3>
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
      </div>
    </div>

    <!-- Declaration Statuses Reference -->
    <div class="bg-card border rounded-lg p-6">
      <h3 class="text-lg font-semibold text-foreground mb-4">Declaration Status Reference</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <span class="inline-block px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded mb-2">PENDING</span>
          <p class="text-xs text-muted-foreground">Code issued, not submitted</p>
        </div>
        <div class="text-center p-3 bg-blue-50 rounded-lg">
          <span class="inline-block px-2 py-1 text-xs font-medium bg-blue-200 text-blue-700 rounded mb-2">SUBMITTED</span>
          <p class="text-xs text-muted-foreground">Awaiting recording</p>
        </div>
        <div class="text-center p-3 bg-yellow-50 rounded-lg">
          <span class="inline-block px-2 py-1 text-xs font-medium bg-yellow-200 text-yellow-700 rounded mb-2">UNDER_REVIEW</span>
          <p class="text-xs text-muted-foreground">Being reviewed</p>
        </div>
        <div class="text-center p-3 bg-green-50 rounded-lg">
          <span class="inline-block px-2 py-1 text-xs font-medium bg-green-200 text-green-700 rounded mb-2">APPROVED</span>
          <p class="text-xs text-muted-foreground">Approved, pending receipt</p>
        </div>
        <div class="text-center p-3 bg-purple-50 rounded-lg">
          <span class="inline-block px-2 py-1 text-xs font-medium bg-purple-200 text-purple-700 rounded mb-2">SEALED</span>
          <p class="text-xs text-muted-foreground">Receipt generated</p>
        </div>
        <div class="text-center p-3 bg-red-50 rounded-lg">
          <span class="inline-block px-2 py-1 text-xs font-medium bg-red-200 text-red-700 rounded mb-2">REJECTED</span>
          <p class="text-xs text-muted-foreground">Requires resubmission</p>
        </div>
      </div>
    </div>
  </div>
</template>
