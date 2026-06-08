<script setup lang="ts">
import type { DataTableColumn } from "~/components/app/DataTable.vue";
import { TONE_BADGE } from "~/utils/statusStyles";

const emit = defineEmits<{ changed: [] }>();

interface DeliveryRow {
  id: string;
  channel: "EMAIL" | "SMS" | "IN_APP";
  status: "PENDING" | "SENT" | "DELIVERED" | "FAILED";
  retryCount: number;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  providerResponse: unknown;
  notification: {
    id: string;
    type: string;
    title: string;
    recipientEmail: string | null;
    recipientPhone: string | null;
    createdAt: string;
  };
}

const table = useDataTable<DeliveryRow>("/api/admin/notifications", {
  perPage: 50,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "items",
});

const columns: DataTableColumn[] = [
  { key: "createdAt", label: "Time", sortable: true },
  { key: "type", label: "Type" },
  { key: "recipient", label: "Recipient" },
  { key: "channel", label: "Channel" },
  { key: "status", label: "Status" },
  { key: "retryCount", label: "Retries" },
  { key: "actions", label: "" },
];

const STATUSES = ["PENDING", "SENT", "DELIVERED", "FAILED"];
const CHANNELS = ["EMAIL", "SMS", "IN_APP"];
const TYPES = [
  "UNIQUE_CODE_GENERATED", "FORM_COLLECTED", "FORM_RETURNED", "FORM_REISSUE_REQUESTED",
  "FORM_REISSUE_APPROVED", "FORM_REISSUE_DECLINED", "SECTION_REVIEW_COMMENTS", "REVIEW_APPROVED",
  "REVIEW_REJECTED", "RECEIPT_READY", "PASSWORD_RESET", "EMAIL_VERIFICATION",
  "VERIFICATION_SUBMITTED", "VERIFICATION_APPROVED", "VERIFICATION_REJECTED",
  "VERIFICATION_ON_HOLD", "VERIFICATION_MORE_INFO_REQUIRED",
];

function statusColor(status: string): string {
  if (status === "DELIVERED") return TONE_BADGE.green!;
  if (status === "FAILED") return TONE_BADGE.red!;
  if (status === "PENDING") return TONE_BADGE.blue!;
  return TONE_BADGE.purple!; // SENT
}

const canRetry = (row: DeliveryRow) => row.status === "FAILED" && row.channel !== "IN_APP";

const showDetail = ref(false);
const selected = ref<DeliveryRow | null>(null);
function openDetail(row: DeliveryRow) {
  selected.value = row;
  showDetail.value = true;
}
function closeDetail() {
  showDetail.value = false;
  selected.value = null;
}

const retryingId = ref<string | null>(null);
const banner = ref<{ ok: boolean; message: string } | null>(null);

async function retry(row: DeliveryRow) {
  retryingId.value = row.id;
  banner.value = null;
  try {
    const res = await authFetch<{
      success: boolean;
      data: { channel: string; status: string; queued: boolean };
    }>(`/api/admin/notifications/${row.id}/retry`, { method: "POST" });
    const d = res.data;
    banner.value = {
      ok: true,
      message: d.queued
        ? `Re-queued the ${d.channel} delivery — the worker will retry it shortly.`
        : `Resent the ${d.channel} delivery — result: ${d.status}.`,
    };
    table.refresh();
    emit("changed");
    if (showDetail.value) closeDetail();
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string } };
    banner.value = { ok: false, message: e.data?.message || e.data?.statusMessage || "Retry failed" };
  } finally {
    retryingId.value = null;
  }
}

const formatDate = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })
    : "—";
</script>

<template>
  <div class="space-y-6">
    <Alert v-if="banner" :variant="banner.ok ? undefined : 'destructive'">
      <AlertDescription>{{ banner.message }}</AlertDescription>
    </Alert>

    <!-- Filters -->
    <Card>
      <CardContent class="pt-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Input
            :model-value="table.search.value"
            type="text"
            placeholder="Search recipient or title..."
            @update:model-value="table.setSearch(String($event))"
          />
          <Select
            :model-value="table.filters.value.status || 'all'"
            @update:model-value="table.setFilter('status', String($event))"
          >
            <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem v-for="s in STATUSES" :key="s" :value="s">{{ s }}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            :model-value="table.filters.value.channel || 'all'"
            @update:model-value="table.setFilter('channel', String($event))"
          >
            <SelectTrigger><SelectValue placeholder="All channels" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem v-for="c in CHANNELS" :key="c" :value="c">{{ c }}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            :model-value="table.filters.value.type || 'all'"
            @update:model-value="table.setFilter('type', String($event))"
          >
            <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem v-for="t in TYPES" :key="t" :value="t">{{ t }}</SelectItem>
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

    <!-- Table -->
    <Card>
      <AppDataTable
        :columns="columns"
        :data="table.data.value"
        :loading="table.loading.value"
        :meta="table.meta.value"
        :sort-column="table.sortColumn.value"
        :sort-direction="table.sortDirection.value"
        status-border-key="status"
        empty-message="No notifications found"
        @sort="table.setSort"
        @page-change="table.setPage"
        @row-click="(row: any) => openDetail(row as DeliveryRow)"
      >
        <template #cell-createdAt="{ value }">
          <AppDateCell :date="(value as string)" relative />
        </template>
        <template #cell-type="{ row }">
          <span class="text-sm text-foreground">{{ (row as DeliveryRow).notification.type }}</span>
        </template>
        <template #cell-recipient="{ row }">
          <span class="text-sm text-muted-foreground">
            {{ (row as DeliveryRow).notification.recipientEmail
              || (row as DeliveryRow).notification.recipientPhone || '—' }}
          </span>
        </template>
        <template #cell-channel="{ row }">
          <Badge :class="TONE_BADGE.neutral">{{ (row as DeliveryRow).channel }}</Badge>
        </template>
        <template #cell-status="{ row }">
          <Badge :class="statusColor((row as DeliveryRow).status)">{{ (row as DeliveryRow).status }}</Badge>
        </template>
        <template #cell-retryCount="{ value }">
          <span class="text-sm text-muted-foreground">{{ value }}</span>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-2">
            <Button
              v-if="canRetry(row as DeliveryRow)"
              variant="outline"
              size="sm"
              :disabled="retryingId === (row as DeliveryRow).id"
              @click.stop="retry(row as DeliveryRow)"
            >
              {{ retryingId === (row as DeliveryRow).id ? 'Retrying…' : 'Retry' }}
            </Button>
            <Button variant="ghost" size="sm" @click.stop="openDetail(row as DeliveryRow)">View</Button>
          </div>
        </template>
      </AppDataTable>
    </Card>

    <!-- Detail -->
    <Dialog :open="showDetail && !!selected" @update:open="(v: boolean) => { if (!v) closeDetail() }">
      <DialogScrollContent v-if="selected" class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Delivery detail</DialogTitle>
          <DialogDescription>{{ selected.notification.title }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-muted-foreground">Type</p>
              <p class="font-medium text-foreground">{{ selected.notification.type }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Channel</p>
              <p class="font-medium text-foreground">{{ selected.channel }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Status</p>
              <Badge :class="statusColor(selected.status)">{{ selected.status }}</Badge>
            </div>
            <div>
              <p class="text-muted-foreground">Retries</p>
              <p class="font-medium text-foreground">{{ selected.retryCount }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Recipient</p>
              <p class="font-medium text-foreground">
                {{ selected.notification.recipientEmail || selected.notification.recipientPhone || '—' }}
              </p>
            </div>
            <div>
              <p class="text-muted-foreground">Created</p>
              <p class="font-medium text-foreground">{{ formatDate(selected.createdAt) }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Sent</p>
              <p class="font-medium text-foreground">{{ formatDate(selected.sentAt) }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Delivered</p>
              <p class="font-medium text-foreground">{{ formatDate(selected.deliveredAt) }}</p>
            </div>
          </div>
          <div v-if="selected.providerResponse" class="text-sm">
            <p class="text-muted-foreground mb-1">Provider response</p>
            <pre class="text-xs font-mono text-foreground bg-muted p-3 rounded overflow-x-auto">{{ JSON.stringify(selected.providerResponse, null, 2) }}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button
            v-if="canRetry(selected)"
            :disabled="retryingId === selected.id"
            @click="retry(selected)"
          >
            {{ retryingId === selected.id ? 'Retrying…' : 'Retry delivery' }}
          </Button>
          <Button variant="outline" @click="closeDetail">Close</Button>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
