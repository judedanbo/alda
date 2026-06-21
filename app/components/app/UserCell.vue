<!-- app/components/app/UserCell.vue -->
<script setup lang="ts">
const props = defineProps<{
  name?: string;
  email?: string;
}>();

const COLORS = ["bg-primary", "bg-blue-600", "bg-purple-600", "bg-amber-600", "bg-cyan-600", "bg-rose-600"];

const displayName = computed(() => props.name || props.email || "?");

const initials = computed(() => {
  const n = displayName.value;
  const parts = n.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return n.slice(0, 2).toUpperCase();
});

const avatarColor = computed(() => {
  let hash = 0;
  for (const ch of displayName.value) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
});
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div
      :class="[avatarColor, 'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0']"
    >
      {{ initials }}
    </div>
    <div class="min-w-0">
      <p class="text-sm font-medium text-foreground truncate">{{ displayName }}</p>
      <p v-if="email && email !== displayName" class="text-[11px] text-muted-foreground truncate">{{ email }}</p>
    </div>
  </div>
</template>
