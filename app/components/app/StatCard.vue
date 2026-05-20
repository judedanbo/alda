<script setup lang="ts">
interface Props {
  label: string;
  value: string | number;
  footnote?: string;
  href?: string;
  iconBg?: string;
  iconColor?: string;
  iconPath?: string;
  valueColor?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  iconBg: "bg-primary/10",
  iconColor: "text-primary",
  valueColor: "text-foreground",
  loading: false,
});

const Wrapper = computed(() => (props.href ? resolveComponent("NuxtLink") : "div"));
</script>

<template>
  <component :is="Wrapper" :to="href">
    <Card :class="href ? 'hover:border-primary/50 transition-colors h-full' : 'h-full'">
      <CardContent class="p-6">
        <div v-if="loading">
          <Skeleton class="h-4 w-24 mb-3" />
          <Skeleton class="h-8 w-16" />
        </div>
        <template v-else>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-muted-foreground">{{ label }}</p>
              <p class="text-3xl font-bold mt-1" :class="valueColor">
                {{ value }}
              </p>
            </div>
            <div
              v-if="iconPath"
              class="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              :class="iconBg"
            >
              <svg
                class="w-6 h-6"
                :class="iconColor"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  :d="iconPath"
                />
              </svg>
            </div>
          </div>
          <p v-if="footnote" class="text-xs text-muted-foreground mt-2">
            {{ footnote }}
          </p>
        </template>
      </CardContent>
    </Card>
  </component>
</template>
