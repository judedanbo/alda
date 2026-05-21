<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
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

    const response = await authFetch<any>(`/api/admin/audit-logs?${params}`);

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
    return TONE_BADGE.green;
  }
  if (action.includes("DELETE") || action.includes("REMOVE")) {
    return TONE_BADGE.red;
  }
  if (action.includes("UPDATE") || action.includes("EDIT")) {
    return TONE_BADGE.blue;
  }
  if (action.includes("LOGIN") || action.includes("LOGOUT")) {
    return TONE_BADGE.purple;
  }
  return TONE_BADGE.neutral;
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
  "SECTION_REVIEW_SUBMITTED",
  "SECTION_REVIEW_RESOLVED",
  "RECEIPT_GENERATE",
  "USER_UPDATE",
  "ROLE_ASSIGN",
];

const entityTypes = [
  "User",
  "Declaration",
  "DeclarationSectionReview",
  "Review",
  "Receipt",
  "Institution",
];
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Audit Logs" description="View system activity and changes" />

    <!-- Filters -->
    <Card>
      <CardContent class="pt-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            v-model="searchQuery"
            type="text"
            placeholder="Search by user email or IP..."
            @keyup.enter="handleSearch"
          />
          <Select v-model="selectedAction" @update:model-value="handleSearch">
            <SelectTrigger>
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem v-for="action in actionTypes" :key="action" :value="action">
                {{ action }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="selectedEntity" @update:model-value="handleSearch">
            <SelectTrigger>
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem v-for="entity in entityTypes" :key="entity" :value="entity">
                {{ entity }}
              </SelectItem>
            </SelectContent>
          </Select>
          <div class="flex gap-2">
            <Input
              v-model="dateFrom"
              type="date"
              class="flex-1"
              @change="handleSearch"
            />
            <Input
              v-model="dateTo"
              type="date"
              class="flex-1"
              @change="handleSearch"
            />
          </div>
        </div>
        <div class="flex justify-end mt-4 gap-2">
          <Button variant="outline" @click="clearFilters">Clear Filters</Button>
          <Button @click="handleSearch">Search</Button>
        </div>
      </CardContent>
    </Card>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 8" :key="i" class="h-12 w-full rounded-lg" />
    </div>

    <!-- Logs Table -->
    <Card v-else>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>User</TableHead>
            <TableHead>IP Address</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="logs.length === 0">
            <TableCell colspan="6" class="text-center py-8 text-muted-foreground">
              No audit logs found
            </TableCell>
          </TableRow>
          <TableRow v-for="log in logs" :key="log.id">
            <TableCell class="text-sm text-muted-foreground whitespace-nowrap">
              {{ formatDate(log.createdAt) }}
            </TableCell>
            <TableCell>
              <Badge :class="getActionColor(log.action)">
                {{ log.action }}
              </Badge>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              <span v-if="log.entityType">
                {{ log.entityType }}
                <span v-if="log.entityId" class="text-xs opacity-60">
                  ({{ log.entityId.substring(0, 8) }}...)
                </span>
              </span>
              <span v-else>-</span>
            </TableCell>
            <TableCell class="text-sm text-foreground">
              {{ log.user?.email || 'System' }}
            </TableCell>
            <TableCell class="text-sm font-mono text-muted-foreground">
              {{ log.ipAddress || '-' }}
            </TableCell>
            <TableCell>
              <Button
                v-if="log.oldValues || log.newValues"
                variant="outline"
                size="sm"
                @click="openDetailModal(log)"
              >
                View
              </Button>
              <span v-else class="text-xs text-muted-foreground">-</span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t">
        <p class="text-sm text-muted-foreground">
          Showing {{ (currentPage - 1) * perPage + 1 }} to {{ Math.min(currentPage * perPage, totalLogs) }} of {{ totalLogs }} logs
        </p>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === 1"
            @click="handlePageChange(currentPage - 1)"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === totalPages"
            @click="handlePageChange(currentPage + 1)"
          >
            Next
          </Button>
        </div>
      </div>
    </Card>

    <!-- Detail Modal -->
    <Dialog :open="showDetailModal && !!selectedLog" @update:open="(v: boolean) => { if (!v) closeDetailModal() }">
      <DialogScrollContent v-if="selectedLog" class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Audit Log Details</DialogTitle>
        </DialogHeader>

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

        <DialogFooter>
          <Button variant="outline" @click="closeDetailModal">Close</Button>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
