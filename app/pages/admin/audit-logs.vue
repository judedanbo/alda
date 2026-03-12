<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();

interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
  } | null;
}

const logs = ref<AuditLog[]>([]);
const loading = ref(true);
const totalLogs = ref(0);
const currentPage = ref(1);
const perPage = 50;

const searchQuery = ref("");
const selectedAction = ref("");
const selectedEntity = ref("");
const dateFrom = ref("");
const dateTo = ref("");

const showDetailModal = ref(false);
const selectedLog = ref<AuditLog | null>(null);

const fetchLogs = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      limit: perPage.toString(),
      offset: ((currentPage.value - 1) * perPage).toString(),
    });

    if (searchQuery.value) params.append("search", searchQuery.value);
    if (selectedAction.value) params.append("action", selectedAction.value);
    if (selectedEntity.value) params.append("entityType", selectedEntity.value);
    if (dateFrom.value) params.append("dateFrom", dateFrom.value);
    if (dateTo.value) params.append("dateTo", dateTo.value);

    const response = await $fetch(`/api/admin/audit-logs?${params}`, {
      headers: authStore.getAuthHeaders(),
    });

    if (response.success) {
      logs.value = response.data.logs;
      totalLogs.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
  } finally {
    loading.value = false;
  }
};

await fetchLogs();

const totalPages = computed(() => Math.ceil(totalLogs.value / perPage));

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const getActionColor = (action: string) => {
  if (action.includes("CREATE") || action.includes("REGISTER")) {
    return "bg-green-100 text-green-800";
  }
  if (action.includes("DELETE") || action.includes("REMOVE")) {
    return "bg-red-100 text-red-800";
  }
  if (action.includes("UPDATE") || action.includes("EDIT")) {
    return "bg-blue-100 text-blue-800";
  }
  if (action.includes("LOGIN") || action.includes("LOGOUT")) {
    return "bg-purple-100 text-purple-800";
  }
  return "bg-gray-100 text-gray-800";
};

const openDetailModal = (log: AuditLog) => {
  selectedLog.value = log;
  showDetailModal.value = true;
};

const closeDetailModal = () => {
  showDetailModal.value = false;
  selectedLog.value = null;
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchLogs();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchLogs();
};

const clearFilters = () => {
  searchQuery.value = "";
  selectedAction.value = "";
  selectedEntity.value = "";
  dateFrom.value = "";
  dateTo.value = "";
  currentPage.value = 1;
  fetchLogs();
};

const actionTypes = [
  "LOGIN",
  "LOGOUT",
  "REGISTER",
  "PASSWORD_RESET",
  "DECLARATION_CREATE",
  "DECLARATION_SUBMIT",
  "DECLARATION_APPROVE",
  "DECLARATION_REJECT",
  "RECEIPT_GENERATE",
  "PICKUP_SCHEDULE",
  "PICKUP_COMPLETE",
  "USER_UPDATE",
  "ROLE_ASSIGN",
];

const entityTypes = [
  "User",
  "Declaration",
  "Submission",
  "Review",
  "Receipt",
  "PickupAuthorization",
  "Institution",
];
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-foreground">Audit Logs</h1>
      <p class="text-muted-foreground mt-1">
        View system activity and changes
      </p>
    </div>

    <!-- Filters -->
    <div class="bg-card border rounded-lg p-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by user email or IP..."
          class="px-4 py-2 border rounded-md bg-background text-foreground"
          @keyup.enter="handleSearch"
        />
        <select
          v-model="selectedAction"
          class="px-4 py-2 border rounded-md bg-background text-foreground"
          @change="handleSearch"
        >
          <option value="">All Actions</option>
          <option v-for="action in actionTypes" :key="action" :value="action">
            {{ action }}
          </option>
        </select>
        <select
          v-model="selectedEntity"
          class="px-4 py-2 border rounded-md bg-background text-foreground"
          @change="handleSearch"
        >
          <option value="">All Entities</option>
          <option v-for="entity in entityTypes" :key="entity" :value="entity">
            {{ entity }}
          </option>
        </select>
        <div class="flex gap-2">
          <input
            v-model="dateFrom"
            type="date"
            class="flex-1 px-3 py-2 border rounded-md bg-background text-foreground"
            @change="handleSearch"
          />
          <input
            v-model="dateTo"
            type="date"
            class="flex-1 px-3 py-2 border rounded-md bg-background text-foreground"
            @change="handleSearch"
          />
        </div>
      </div>
      <div class="flex justify-end mt-4 gap-2">
        <button
          class="px-4 py-2 text-sm border rounded-md hover:bg-muted"
          @click="clearFilters"
        >
          Clear Filters
        </button>
        <button
          class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          @click="handleSearch"
        >
          Search
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>

    <!-- Logs Table -->
    <div v-else class="bg-card border rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Time</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Action</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Entity</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">User</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">IP Address</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="logs.length === 0">
              <td colspan="6" class="py-8 text-center text-muted-foreground">
                No audit logs found
              </td>
            </tr>
            <tr v-for="log in logs" :key="log.id" class="border-t">
              <td class="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                {{ formatDate(log.createdAt) }}
              </td>
              <td class="py-3 px-4">
                <span
                  class="px-2 py-0.5 text-xs rounded-full"
                  :class="getActionColor(log.action)"
                >
                  {{ log.action }}
                </span>
              </td>
              <td class="py-3 px-4 text-sm text-muted-foreground">
                <span v-if="log.entityType">
                  {{ log.entityType }}
                  <span v-if="log.entityId" class="text-xs opacity-60">
                    ({{ log.entityId.substring(0, 8) }}...)
                  </span>
                </span>
                <span v-else>-</span>
              </td>
              <td class="py-3 px-4 text-sm text-foreground">
                {{ log.user?.email || 'System' }}
              </td>
              <td class="py-3 px-4 text-sm font-mono text-muted-foreground">
                {{ log.ipAddress || '-' }}
              </td>
              <td class="py-3 px-4">
                <button
                  v-if="log.oldValues || log.newValues"
                  class="px-3 py-1 text-xs border rounded hover:bg-muted"
                  @click="openDetailModal(log)"
                >
                  View
                </button>
                <span v-else class="text-xs text-muted-foreground">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t">
        <p class="text-sm text-muted-foreground">
          Showing {{ (currentPage - 1) * perPage + 1 }} to {{ Math.min(currentPage * perPage, totalLogs) }} of {{ totalLogs }} logs
        </p>
        <div class="flex gap-2">
          <button
            class="px-3 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50"
            :disabled="currentPage === 1"
            @click="handlePageChange(currentPage - 1)"
          >
            Previous
          </button>
          <button
            class="px-3 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50"
            :disabled="currentPage === totalPages"
            @click="handlePageChange(currentPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div
      v-if="showDetailModal && selectedLog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="closeDetailModal"
    >
      <div class="bg-card border rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <h2 class="text-lg font-semibold text-foreground mb-4">
          Audit Log Details
        </h2>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-muted-foreground">Action</p>
              <p class="font-medium text-foreground">{{ selectedLog.action }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Time</p>
              <p class="font-medium text-foreground">{{ formatDate(selectedLog.createdAt) }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">User</p>
              <p class="font-medium text-foreground">{{ selectedLog.user?.email || 'System' }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">IP Address</p>
              <p class="font-medium font-mono text-foreground">{{ selectedLog.ipAddress || '-' }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Entity Type</p>
              <p class="font-medium text-foreground">{{ selectedLog.entityType || '-' }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Entity ID</p>
              <p class="font-medium font-mono text-foreground text-xs">{{ selectedLog.entityId || '-' }}</p>
            </div>
          </div>

          <div v-if="selectedLog.userAgent" class="text-sm">
            <p class="text-muted-foreground mb-1">User Agent</p>
            <p class="text-xs font-mono text-foreground bg-muted p-2 rounded">
              {{ selectedLog.userAgent }}
            </p>
          </div>

          <div v-if="selectedLog.oldValues" class="text-sm">
            <p class="text-muted-foreground mb-1">Old Values</p>
            <pre class="text-xs font-mono text-foreground bg-muted p-3 rounded overflow-x-auto">{{ JSON.stringify(selectedLog.oldValues, null, 2) }}</pre>
          </div>

          <div v-if="selectedLog.newValues" class="text-sm">
            <p class="text-muted-foreground mb-1">New Values</p>
            <pre class="text-xs font-mono text-foreground bg-muted p-3 rounded overflow-x-auto">{{ JSON.stringify(selectedLog.newValues, null, 2) }}</pre>
          </div>
        </div>

        <div class="flex justify-end mt-6">
          <button
            class="px-4 py-2 text-sm border rounded-md hover:bg-muted"
            @click="closeDetailModal"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
