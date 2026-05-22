<!-- app/components/app/VerificationDots.vue -->
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    count: number;
    max?: number;
  }>(),
  { max: 10 },
);

const filledDots = computed(() => Math.min(props.count, props.max));
const emptyDots = computed(() => Math.max(0, props.max - props.count));
const overflow = computed(() => (props.count > props.max ? props.count - props.max : 0));
</script>

<template>
  <div class="flex items-center gap-[3px]">
    <span
      v-for="i in filledDots"
      :key="'f' + i"
      class="w-2 h-2 rounded-full bg-primary"
    />
    <span
      v-for="i in emptyDots"
      :key="'e' + i"
      class="w-2 h-2 rounded-full bg-muted-foreground/20"
    />
    <span class="ml-1 text-xs text-muted-foreground tabular-nums">
      {{ count }}<template v-if="overflow">+</template>
    </span>
  </div>
</template>
