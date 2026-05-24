<script setup lang="ts">
import type { AnalyticsFilterState } from "~/composables/useAnalytics";
import { authFetch } from "~/utils/authFetch";

const filters = defineModel<AnalyticsFilterState>("filters", { required: true });

defineProps<{
  showOfficerFilter?: boolean;
  showExport?: boolean;
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
  export: [format: "csv" | "pdf"];
}>();

interface SelectOption {
  id: string;
  name: string;
}

const institutions = ref<SelectOption[]>([]);

onMounted(async () => {
  try {
    const [instRes] = await Promise.all([
      authFetch<{ success: boolean; data: SelectOption[] }>("/api/institutions"),
      authFetch<{ success: boolean; data: SelectOption[] }>("/api/categories"),
    ]);

    if (Array.isArray(instRes)) {
      institutions.value = instRes as unknown as SelectOption[];
    } else if (instRes.data) {
      institutions.value = instRes.data;
    }
  } catch {
    // Filter dropdowns degrade gracefully
  }
});

type PresetKey = "today" | "week" | "month" | "quarter" | "year" | "all";

const activePreset = ref<PresetKey>("all");

function applyPreset(preset: PresetKey) {
  activePreset.value = preset;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  switch (preset) {
    case "today":
      filters.value.dateFrom = today;
      filters.value.dateTo = today;
      break;
    case "week": {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      filters.value.dateFrom = weekStart.toISOString().slice(0, 10);
      filters.value.dateTo = today;
      break;
    }
    case "month": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filters.value.dateFrom = monthStart.toISOString().slice(0, 10);
      filters.value.dateTo = today;
      break;
    }
    case "quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const quarterStart = new Date(now.getFullYear(), qMonth, 1);
      filters.value.dateFrom = quarterStart.toISOString().slice(0, 10);
      filters.value.dateTo = today;
      break;
    }
    case "year": {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      filters.value.dateFrom = yearStart.toISOString().slice(0, 10);
      filters.value.dateTo = today;
      break;
    }
    case "all":
      filters.value.dateFrom = "";
      filters.value.dateTo = "";
      break;
  }
  emit("apply");
}

const presets: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

function handleSearch() {
  emit("apply");
}

function handleReset() {
  activePreset.value = "all";
  emit("reset");
}

// SelectItem cannot be an empty string, so the "All Institutions" option
// maps to a sentinel and back on the way in/out of the filter state.
const ALL_OFFICES = "__all__";
const officeModel = computed({
  get: () => filters.value.officeId || ALL_OFFICES,
  set: (v: string) => {
    filters.value.officeId = v === ALL_OFFICES ? "" : v;
    emit("apply");
  },
});
</script>

<template>
  <Card>
    <CardContent class="p-4">
      <div class="flex flex-wrap items-center gap-3">
        <!-- Date Presets -->
        <div class="flex gap-1">
          <button
            v-for="preset in presets"
            :key="preset.key"
            class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            :class="activePreset === preset.key
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'"
            @click="applyPreset(preset.key)"
          >
            {{ preset.label }}
          </button>
        </div>

        <!-- Custom Date Range -->
        <DateRangePicker
          :from="filters.dateFrom || null"
          :to="filters.dateTo || null"
          placeholder="Custom range"
          @update:from="(v) => { filters.dateFrom = v ?? ''; emit('apply'); }"
          @update:to="(v) => { filters.dateTo = v ?? ''; emit('apply'); }"
        />

        <!-- Institution Filter -->
        <Select v-model="officeModel">
          <SelectTrigger size="sm" class="text-xs">
            <SelectValue placeholder="All Institutions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_OFFICES">
              All Institutions
            </SelectItem>
            <SelectItem
              v-for="inst in institutions"
              :key="inst.id"
              :value="inst.id"
            >
              {{ inst.name }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Search -->
        <div class="flex-1 min-w-[200px]">
          <Input
            v-model="filters.search"
            placeholder="Search by code, name, or Ghana Card..."
            class="h-8 text-xs"
            @keyup.enter="handleSearch"
          />
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <Button size="sm" variant="outline" class="h-8 text-xs" @click="handleReset">
            Reset
          </Button>
          <template v-if="showExport">
            <Button
              size="sm"
              class="h-8 text-xs bg-primary"
              @click="$emit('export', 'csv')"
            >
              CSV
            </Button>
            <Button
              size="sm"
              class="h-8 text-xs bg-destructive"
              @click="$emit('export', 'pdf')"
            >
              PDF
            </Button>
          </template>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
