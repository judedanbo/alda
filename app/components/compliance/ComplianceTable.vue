<script setup lang="ts">
import type { ComplianceListData } from "~/composables/useCompliance";
import { TONE_BADGE } from "~/utils/statusStyles";
import { displayId } from "~/utils/displayId";

defineProps<{
  data: ComplianceListData | null;
  loading: boolean;
  sortBy: string;
  sortOrder: "asc" | "desc";
}>();

const emit = defineEmits<{
  sort: [column: string];
  page: [page: number];
}>();

const columns = [
  { key: "fullName", label: "Applicant", sortable: true, sortKey: "applicantName" },
  { key: "idNumber", label: "ID Number", sortable: false },
  { key: "institution", label: "Institution", sortable: true },
  { key: "designation", label: "Designation", sortable: false },
  { key: "obligationType", label: "Obligation", sortable: false },
  { key: "dueDate", label: "Due Date", sortable: true },
  { key: "status", label: "Status", sortable: false },
  { key: "daysPastDue", label: "Days", sortable: true },
  { key: "lastDeclarationDate", label: "Last Declaration", sortable: false },
];

const statusBadge: Record<string, { label: string; class: string }> = {
  overdue: { label: "Overdue", class: TONE_BADGE.red! },
  due_now: { label: "Due Now", class: TONE_BADGE.amber! },
  upcoming: { label: "Upcoming", class: TONE_BADGE.blue! },
  compliant: { label: "Compliant", class: TONE_BADGE.green! },
};

const obligationLabel: Record<string, string> = {
  assumption: "Assumption of Office",
  periodic: "Periodic (4-year)",
  departure: "Departure from Office",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDays(days: number): string {
  if (days < 0) return `in ${Math.abs(days)} days`;
  if (days === 0) return "Today";
  return `${days} days ago`;
}
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between">
      <div>
        <CardTitle class="text-base">Declaration Obligations</CardTitle>
        <CardDescription v-if="data">
          Showing {{ ((data.pagination.page - 1) * data.pagination.pageSize) + 1 }}–{{
            Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)
          }} of {{ data.pagination.total.toLocaleString() }}
        </CardDescription>
      </div>
    </CardHeader>
    <CardContent>
      <Skeleton v-if="loading" class="w-full h-[400px]" />
      <div v-else-if="data && data.items.length > 0" class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                v-for="col in columns"
                :key="col.key"
                :class="col.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''"
                @click="col.sortable ? emit('sort', col.sortKey ?? col.key) : undefined"
              >
                {{ col.label }}
                <span v-if="col.sortable && sortBy === (col.sortKey ?? col.key)" class="ml-1">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(item, idx) in data.items" :key="idx">
              <TableCell>{{ item.fullName ?? "—" }}</TableCell>
              <TableCell class="font-mono text-xs">{{ displayId(item).value || "—" }}</TableCell>
              <TableCell class="max-w-[180px] truncate" :title="item.institution ?? ''">
                {{ item.institution ?? "—" }}
              </TableCell>
              <TableCell>{{ item.designation }}</TableCell>
              <TableCell>
                <span class="text-xs">{{ obligationLabel[item.obligationType] ?? item.obligationType }}</span>
              </TableCell>
              <TableCell>{{ formatDate(item.dueDate) }}</TableCell>
              <TableCell>
                <Badge :class="statusBadge[item.status]?.class ?? ''">
                  {{ statusBadge[item.status]?.label ?? item.status }}
                </Badge>
              </TableCell>
              <TableCell :class="item.daysPastDue > 90 ? 'text-red-600 dark:text-red-400 font-medium' : item.daysPastDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'">
                {{ formatDays(item.daysPastDue) }}
              </TableCell>
              <TableCell>{{ formatDate(item.lastDeclarationDate) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div
          v-if="data.pagination.totalPages > 1"
          class="flex justify-center gap-1 mt-4"
        >
          <Button
            v-for="p in data.pagination.totalPages"
            :key="p"
            size="sm"
            :variant="p === data.pagination.page ? 'default' : 'outline'"
            class="h-8 w-8 text-xs"
            @click="emit('page', p)"
          >
            {{ p }}
          </Button>
        </div>
      </div>
      <div v-else class="text-center text-muted-foreground py-12">
        No non-compliant obligations found matching the current filters.
      </div>
    </CardContent>
  </Card>
</template>
