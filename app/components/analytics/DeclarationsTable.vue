<script setup lang="ts">
import type { ListData } from "~/composables/useAnalytics";

defineProps<{
  data: ListData | null;
  loading: boolean;
  sortBy: string;
  sortOrder: "asc" | "desc";
}>();

const emit = defineEmits<{
  sort: [column: string];
  page: [page: number];
}>();

const columns = [
  { key: "code", label: "Code", sortable: true },
  { key: "applicant", label: "Applicant", sortable: true },
  { key: "institutions", label: "Institution(s)", sortable: false },
  { key: "collectionOffice", label: "Collection Office", sortable: false },
  { key: "sealedAt", label: "Sealed Date", sortable: true },
  { key: "processingDays", label: "Days", sortable: false },
  { key: "processedBy", label: "Processed By", sortable: false },
  { key: "receipt", label: "Receipt", sortable: false },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between">
      <div>
        <CardTitle class="text-base">Sealed Declarations</CardTitle>
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
                @click="col.sortable ? emit('sort', col.key) : undefined"
              >
                {{ col.label }}
                <span v-if="col.sortable && sortBy === col.key" class="ml-1">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="item in data.items"
              :key="item.id"
              class="cursor-pointer hover:bg-muted/50"
            >
              <TableCell>
                <NuxtLink
                  :to="`/applicant/declaration/${item.id}`"
                  class="font-mono text-xs text-primary hover:underline"
                >
                  {{ item.uniqueCode }}
                </NuxtLink>
              </TableCell>
              <TableCell>{{ item.applicantName }}</TableCell>
              <TableCell class="max-w-[200px] truncate" :title="item.institutions.join(', ')">
                {{ item.institutions.join(", ") || "—" }}
              </TableCell>
              <TableCell>{{ item.collectionOfficeName ?? "—" }}</TableCell>
              <TableCell>{{ formatDate(item.sealedAt) }}</TableCell>
              <TableCell>{{ item.processingDays }}</TableCell>
              <TableCell>{{ item.processedBy }}</TableCell>
              <TableCell>
                <span v-if="item.receiptNumber" class="text-primary text-xs">
                  ✓ {{ item.receiptNumber }}
                </span>
                <span v-else class="text-muted-foreground text-xs">—</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <!-- Pagination -->
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
        No sealed declarations found matching the current filters.
      </div>
    </CardContent>
  </Card>
</template>
