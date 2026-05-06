<script setup lang="ts">
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "~/components/ui/table";
import { Skeleton } from "~/components/ui/skeleton";

export interface Column {
  key: string;
  label: string;
  class?: string;
}

defineProps<{
  columns: Column[];
  data: any[];
  loading?: boolean;
  emptyMessage?: string;
}>();
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead v-for="col in columns" :key="col.key" :class="col.class">
          {{ col.label }}
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <template v-if="loading">
        <TableRow v-for="i in 5" :key="'skeleton-' + i">
          <TableCell v-for="col in columns" :key="col.key">
            <Skeleton class="h-4 w-full" />
          </TableCell>
        </TableRow>
      </template>
      <TableRow v-else-if="data.length === 0">
        <TableCell :colspan="columns.length" class="text-center py-12 text-muted-foreground">
          {{ emptyMessage || "No data found" }}
        </TableCell>
      </TableRow>
      <template v-else>
        <TableRow v-for="(row, index) in data" :key="index">
          <TableCell v-for="col in columns" :key="col.key" :class="col.class">
            <slot :name="'cell-' + col.key" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </TableCell>
        </TableRow>
      </template>
    </TableBody>
  </Table>
</template>
