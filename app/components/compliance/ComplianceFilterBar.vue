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

// SelectItem cannot have an empty-string value, so the "all" options map
// to sentinels and translate back on the way in/out of the filter state.
const ALL_STATUSES = "__all__";
const ALL_INSTITUTIONS = "__all__";

const statusOptions = [
  { value: ALL_STATUSES, label: "All Statuses" },
  { value: "overdue", label: "Overdue" },
  { value: "due_now", label: "Due Now" },
  { value: "upcoming", label: "Upcoming" },
];

const statusModel = computed({
  get: () => filters.value.status || ALL_STATUSES,
  set: (v: string) => {
    filters.value.status = v === ALL_STATUSES ? "" : v;
    emit("apply");
  },
});

const institutionModel = computed({
  get: () => filters.value.institutionId || ALL_INSTITUTIONS,
  set: (v: string) => {
    filters.value.institutionId = v === ALL_INSTITUTIONS ? "" : v;
    emit("apply");
  },
});
</script>

<template>
  <Card>
    <CardContent class="p-4">
      <div class="flex flex-wrap items-center gap-3">
        <Select v-model="statusModel">
          <SelectTrigger size="sm" class="text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="institutionModel">
          <SelectTrigger size="sm" class="text-xs">
            <SelectValue placeholder="All Institutions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_INSTITUTIONS">
              All Institutions
            </SelectItem>
            <SelectItem v-for="inst in institutions" :key="inst.id" :value="inst.id">
              {{ inst.name }}
            </SelectItem>
          </SelectContent>
        </Select>

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
