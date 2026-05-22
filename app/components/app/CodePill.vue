<script setup lang="ts">
import { DECLARATION_STATUS_BADGE } from "~/utils/statusStyles";

const props = defineProps<{
  code: string;
  status?: string;
}>();

const badgeClass = computed(() => {
  if (!props.status) return "bg-muted text-muted-foreground";
  return DECLARATION_STATUS_BADGE[props.status] ?? "bg-muted text-muted-foreground";
});
</script>

<template>
  <span :class="[badgeClass, 'inline-flex items-center px-2.5 py-0.5 rounded-md font-mono text-xs font-semibold']">
    {{ code }}
  </span>
</template>
