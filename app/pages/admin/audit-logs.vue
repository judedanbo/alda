<script setup lang="ts">
import type { DataTableColumn } from "~/components/app/DataTable.vue";
import { TONE_BADGE } from "~/utils/statusStyles";

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

const table = useDataTable<AuditLog>("/api/admin/audit-logs", {
  perPage: 50,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "logs",
});

const showDetailModal = ref(false);
const selectedLog = ref<AuditLog | null>(null);

const columns: DataTableColumn[] = [
  { key: "createdAt", label: "Time", sortable: true },
  { key: "action", label: "Action", sortable: true },
  { key: "entityType", label: "Entity", sortable: true },
  { key: "user", label: "User", sortable: true },
  { key: "ipAddress", label: "IP Address" },
  { key: "details", label: "Details" },
];

function getActionColor(action: string): string {
  if (action.includes("CREATE") || action.includes("REGISTER")) return TONE_BADGE.green!;
  if (action.includes("DELETE") || action.includes("REMOVE")) return TONE_BADGE.red!;
  if (action.includes("UPDATE") || action.includes("EDIT")) return TONE_BADGE.blue!;
  if (action.includes("LOGIN") || action.includes("LOGOUT")) return TONE_BADGE.purple!;
  return TONE_BADGE.neutral!;
}

const openDetailModal = (log: AuditLog) => {
  selectedLog.value = log;
  showDetailModal.value = true;
};

const closeDetailModal = () => {
  showDetailModal.value = false;
  selectedLog.value = null;
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const actionTypes = [
  "LOGIN", "LOGOUT", "REGISTER", "PASSWORD_RESET",
  "DECLARATION_CREATE", "DECLARATION_SUBMIT", "DECLARATION_APPROVE", "DECLARATION_REJECT",
  "SECTION_REVIEW_SUBMITTED", "SECTION_REVIEW_RESOLVED",
  "RECEIPT_GENERATE", "USER_UPDATE", "ROLE_ASSIGN",
];

const entityTypes = [
  "User", "Declaration", "DeclarationSectionReview", "Review", "Receipt", "Institution",
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
            :model-value="table.search.value"
            type="text"
            placeholder="Search by user email or IP..."
            @update:model-value="table.setSearch(String($event))"
          />
          <Select
            :model-value="table.filters.value.action || 'all'"
            @update:model-value="table.setFilter('action', String($event))"
          >
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
          <Select
            :model-value="table.filters.value.entityType || 'all'"
            @update:model-value="table.setFilter('entityType', String($event))"
          >
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
          <DateRangePicker
            :from="(table.filters.value.dateFrom as string) || null"
            :to="(table.filters.value.dateTo as string) || null"
            placeholder="Filter by date"
            block
            @update:from="(v) => table.setFilter('dateFrom', v ?? '')"
            @update:to="(v) => table.setFilter('dateTo', v ?? '')"
          />
        </div>
        <div class="flex justify-end mt-4 gap-2">
          <Button
            v-if="table.hasActiveFilters.value"
            variant="outline"
            @click="table.clearFilters()"
          >
            Clear Filters
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Audit Logs Table -->
    <Card>
      <AppDataTable
        :columns="columns"
        :data="table.data.value"
        :loading="table.loading.value"
        :meta="table.meta.value"
        :sort-column="table.sortColumn.value"
        :sort-direction="table.sortDirection.value"
        status-border-key="action"
        empty-message="No audit logs found"
        @sort="table.setSort"
        @page-change="table.setPage"
        @row-click="(row: any) => { if (row.oldValues || row.newValues) openDetailModal(row as AuditLog) }"
      >
        <template #cell-createdAt="{ value }">
          <AppDateCell :date="(value as string)" relative />
        </template>
        <template #cell-action="{ value }">
          <Badge :class="getActionColor((value as string))">
            {{ value }}
          </Badge>
        </template>
        <template #cell-entityType="{ row }">
          <span class="text-sm text-muted-foreground">
            <template v-if="(row as AuditLog).entityType">
              {{ (row as AuditLog).entityType }}
              <span v-if="(row as AuditLog).entityId" class="text-xs opacity-60">
                ({{ (row as AuditLog).entityId!.substring(0, 8) }}…)
              </span>
            </template>
            <template v-else>-</template>
          </span>
        </template>
        <template #cell-user="{ row }">
          <AppUserCell
            v-if="(row as AuditLog).user"
            :name="(row as AuditLog).user!.email"
          />
          <span v-else class="text-sm text-muted-foreground">System</span>
        </template>
        <template #cell-ipAddress="{ value }">
          <span class="text-sm font-mono text-muted-foreground">{{ (value as string) || '-' }}</span>
        </template>
        <template #cell-details="{ row }">
          <Button
            v-if="(row as AuditLog).oldValues || (row as AuditLog).newValues"
            variant="outline"
            size="sm"
            @click.stop="openDetailModal(row as AuditLog)"
          >
            View
          </Button>
          <span v-else class="text-xs text-muted-foreground">-</span>
        </template>
      </AppDataTable>
    </Card>

    <!-- Detail Modal -->
    <Dialog :open="showDetailModal && !!selectedLog" @update:open="(v: boolean) => { if (!v) closeDetailModal() }">
      <DialogScrollContent v-if="selectedLog" class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Audit Log Details</DialogTitle>
          <DialogDescription>
            {{ selectedLog.action }}{{ selectedLog.entityType ? ` · ${selectedLog.entityType}` : '' }}
          </DialogDescription>
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
            <p class="text-xs font-mono text-foreground bg-muted p-2 rounded">{{ selectedLog.userAgent }}</p>
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
