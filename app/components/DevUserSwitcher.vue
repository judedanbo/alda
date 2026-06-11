<script setup lang="ts">
import { ROLE_DASHBOARDS } from "~/utils/roles";

const authStore = useAuthStore();
const config = useRuntimeConfig();
const router = useRouter();

interface DevUser {
  id: string;
  email: string;
  roles: string[];
}

const users = ref<DevUser[]>([]);
const switching = ref<string | null>(null);
const collapsed = ref(false);

const roleColors: Record<string, string> = {
  admin: "bg-red-500",
  schedule_officer: "bg-blue-500",
  legal_unit: "bg-purple-500",
  applicant: "bg-green-500",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  schedule_officer: "Officer",
  legal_unit: "Legal",
  applicant: "Applicant",
};

const currentRole = computed(() => {
  if (!authStore.user) return null;
  return authStore.user.roles[0] ?? null;
});

const currentEmail = computed(() => authStore.user?.email ?? "Not logged in");

async function fetchDevUsers() {
  try {
    const res = await $fetch<{ success: boolean; data: DevUser[] }>("/api/dev/users");
    if (res.success) {
      users.value = res.data;
    }
  } catch {
    // silently fail — dev endpoint might not be available
  }
}

async function switchToUser(user: DevUser) {
  switching.value = user.email;
  try {
    const res = await $fetch<{
      success: boolean;
      data: {
        user: {
          id: string;
          email: string;
          phone: string | null;
          emailVerified: boolean;
          phoneVerified: boolean;
          phoneVerifiedAt: string | null;
          roles: string[];
          hasProfile?: boolean;
          fullName?: string;
          verificationStatus?: string;
        };
        tokens: { accessToken: string; refreshToken: string };
      };
    }>("/api/dev/switch-user", {
      method: "POST",
      body: { email: user.email },
    });

    if (res.success) {
      authStore.user = res.data.user;
      authStore.setTokens(res.data.tokens);
      const primaryRole = res.data.user.roles[0] ?? "applicant";
      const dashboard = ROLE_DASHBOARDS[primaryRole as keyof typeof ROLE_DASHBOARDS] || "/";
      await router.push(dashboard);
    }
  } catch (e) {
    console.error("[DevSwitcher] Failed to switch user:", e);
  } finally {
    switching.value = null;
  }
}

onMounted(() => {
  fetchDevUsers();
});
</script>

<template>
  <div
    v-if="config.public.devMode"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999]"
  >
    <!-- Collapsed state -->
    <button
      v-if="collapsed"
      class="flex items-center gap-1.5 rounded-full bg-gray-900/90 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur-sm border border-gray-700 hover:bg-gray-800/90 transition-colors"
      @click="collapsed = false"
    >
      <span class="inline-block h-2 w-2 rounded-full" :class="currentRole ? roleColors[currentRole] : 'bg-gray-500'" />
      <span class="font-mono">DEV</span>
      <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clip-rule="evenodd" /></svg>
    </button>

    <!-- Expanded state -->
    <div
      v-else
      class="flex items-center gap-3 rounded-full bg-gray-900/90 px-4 py-2 text-xs text-white shadow-lg backdrop-blur-sm border border-gray-700"
    >
      <div class="flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-full" :class="currentRole ? roleColors[currentRole] : 'bg-gray-500'" />
        <span class="font-mono font-semibold">DEV</span>
        <span class="text-gray-400 max-w-[140px] truncate">{{ currentEmail }}</span>
      </div>

      <div class="h-4 w-px bg-gray-600" />

      <div class="flex items-center gap-1.5">
        <button
          v-for="devUser in users"
          :key="devUser.id"
          :disabled="switching !== null"
          class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-50"
          :class="[
            devUser.email === authStore.user?.email
              ? `${roleColors[devUser.roles[0]!] ?? ''} text-white`
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
          ]"
          @click="switchToUser(devUser)"
        >
          <span v-if="switching === devUser.email" class="inline-block animate-spin">&#8635;</span>
          <span v-else>{{ roleLabels[devUser.roles[0]!] || devUser.roles[0] }}</span>
        </button>
      </div>

      <button
        class="ml-1 text-gray-400 hover:text-white transition-colors"
        @click="collapsed = true"
      >
        <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
      </button>
    </div>
  </div>
</template>
