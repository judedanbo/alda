<script setup lang="ts">
import { Badge } from "~/components/ui/badge";
import { DECLARATION_STATUS_BADGE } from "~/utils/statusStyles";

const props = defineProps<{
  status: string;
}>();

const LABELS: Record<string, string> = {
  CODE_GENERATED: "Code Generated",
  FORM_COLLECTED: "Form Collected",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SEALED: "Sealed",
};

const config = computed(() => ({
  label: LABELS[props.status] || props.status,
  class: DECLARATION_STATUS_BADGE[props.status] || "",
}));
</script>

<template>
  <Badge :class="config.class">
    {{ config.label }}
  </Badge>
</template>
