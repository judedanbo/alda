<!-- app/components/app/DateCell.vue -->
<script setup lang="ts">
const props = defineProps<{
  date: string;
  relative?: boolean;
}>();

const formatted = computed(() =>
  new Date(props.date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
);

const relativeText = computed(() => {
  if (!props.relative) return "";
  const now = Date.now();
  const then = new Date(props.date).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return "";
});
</script>

<template>
  <div>
    <p class="text-sm text-muted-foreground">{{ formatted }}</p>
    <p v-if="relativeText" class="text-[10px] text-muted-foreground/60">{{ relativeText }}</p>
  </div>
</template>
