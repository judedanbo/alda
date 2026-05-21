<script setup lang="ts">
import { Check, Monitor } from "lucide-vue-next";

const { current, themes, setTheme } = useTheme();
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    <button
      v-for="theme in themes"
      :key="theme.id"
      type="button"
      class="group relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
      :class="current === theme.id ? 'border-primary ring-2 ring-primary' : 'border-border'"
      :aria-pressed="current === theme.id"
      @click="setTheme(theme.id)"
    >
      <!-- Theme preview -->
      <div
        class="flex h-16 w-full items-center gap-1.5 overflow-hidden rounded-md border border-border p-2"
        :style="{ backgroundColor: theme.swatch.bg }"
      >
        <Monitor
          v-if="theme.id === 'system'"
          class="mx-auto size-7"
          :style="{ color: theme.swatch.primary }"
        />
        <template v-else>
          <div
            class="h-full w-2 shrink-0 rounded-sm"
            :style="{ backgroundColor: theme.swatch.primary }"
          />
          <div class="flex h-full flex-1 flex-col justify-center gap-1">
            <div
              class="h-1.5 w-3/4 rounded-full"
              :style="{ backgroundColor: theme.swatch.foreground }"
            />
            <div
              class="h-1.5 w-1/2 rounded-full"
              :style="{ backgroundColor: theme.swatch.accent }"
            />
            <div
              class="mt-1 h-4 w-full rounded-sm"
              :style="{ backgroundColor: theme.swatch.card }"
            />
          </div>
        </template>
      </div>

      <div>
        <p class="text-sm font-medium text-foreground">{{ theme.label }}</p>
        <p class="text-xs text-muted-foreground">{{ theme.description }}</p>
      </div>

      <span
        v-if="current === theme.id"
        class="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <Check class="size-3" />
      </span>
    </button>
  </div>
</template>
