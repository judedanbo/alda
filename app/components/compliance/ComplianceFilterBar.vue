<script setup lang="ts">
import type { ComplianceFilterState } from "~/composables/useCompliance";
import { authFetch } from "~/utils/authFetch";

const filters = defineModel<ComplianceFilterState>("filters", { required: true });

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();

interface SelectOption {
  id: string;
  name: string;
}

const institutions = ref<SelectOption[]>([]);

onMounted(async () => {
  try {
    const res = await authFetch<{ success: boolean; data: SelectOption[] } | SelectOption[]>(
      "/api/institutions",
    );
    if (Array.isArray(res)) {
      institutions.value = res;
    } else if (res.data) {
      institutions.value = res.data;
    }
  } catch {
    // Filter dropdown degrades gracefully
  }
});

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "overdue", label: "Overdue" },
  { value: "due_now", label: "Due Now" },
  { value: "upcoming", label: "Upcoming" },
];
</script>

<template>
  <Card>
    <CardContent class="p-4">
      <div class="flex flex-wrap items-center gap-3">
        <select
          v-model="filters.status"
          class="h-8 rounded-md border bg-background px-3 text-xs"
          @change="emit('apply')"
        >
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>

        <select
          v-model="filters.institutionId"
          class="h-8 rounded-md border bg-background px-3 text-xs"
          @change="emit('apply')"
        >
          <option value="">All Institutions</option>
          <option v-for="inst in institutions" :key="inst.id" :value="inst.id">
            {{ inst.name }}
          </option>
        </select>

        <div class="flex-1 min-w-[200px]">
          <Input
            v-model="filters.search"
            placeholder="Search by name or Ghana Card..."
            class="h-8 text-xs"
            @keyup.enter="emit('apply')"
          />
        </div>

        <div class="flex gap-2">
          <Button size="sm" variant="outline" class="h-8 text-xs" @click="emit('reset')">
            Reset
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
