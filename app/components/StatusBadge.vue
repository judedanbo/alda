<script setup lang="ts">
import { Badge } from "~/components/ui/badge";

const props = defineProps<{
  status: string;
}>();

const config = computed(() => {
  const map: Record<string, { label: string; class: string }> = {
    CODE_GENERATED: { label: "Code Generated", class: "border-amber-300 text-amber-700 bg-amber-50" },
    FORM_COLLECTED: { label: "Form Collected", class: "bg-cyan-100 text-cyan-700" },
    SUBMITTED: { label: "Submitted", class: "bg-blue-100 text-blue-700" },
    UNDER_REVIEW: { label: "Under Review", class: "bg-purple-100 text-purple-700" },
    APPROVED: { label: "Approved", class: "bg-green-100 text-green-700" },
    REJECTED: { label: "Rejected", class: "bg-red-100 text-red-700" },
    SEALED: { label: "Sealed", class: "bg-emerald-100 text-emerald-700" },
    COMPLETED: { label: "Completed", class: "bg-gray-100 text-gray-700" },
  };
  return map[props.status] || { label: props.status, class: "" };
});
</script>

<template>
  <Badge :class="config.class">
    {{ config.label }}
  </Badge>
</template>
