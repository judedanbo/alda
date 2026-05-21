<script setup lang="ts">
import { CheckIcon, XIcon, PlayIcon, ArrowRightIcon } from "lucide-vue-next";

const { checklist, items, progress, dismissed, dismiss, setManual, runAction } =
  useOnboarding();

const visible = computed(
  () => !dismissed.value && !progress.value.allComplete,
);

const percent = computed(() =>
  progress.value.total === 0
    ? 0
    : Math.round((progress.value.done / progress.value.total) * 100),
);
</script>

<template>
  <Card v-if="visible" data-tour="onboarding" class="border-primary/30 mb-6">
    <CardHeader>
      <div class="flex items-start justify-between gap-4">
        <div>
          <CardTitle>{{ checklist.title }}</CardTitle>
          <CardDescription>{{ checklist.description }}</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss checklist"
          @click="dismiss"
        >
          <XIcon class="size-4" />
        </Button>
      </div>
      <div class="mt-2 flex items-center gap-3">
        <div class="bg-muted h-2 flex-1 overflow-hidden rounded-full">
          <div
            class="bg-primary h-full rounded-full transition-all"
            :style="{ width: `${percent}%` }"
          />
        </div>
        <span class="text-muted-foreground shrink-0 text-xs font-medium">
          {{ progress.done }} of {{ progress.total }}
        </span>
      </div>
    </CardHeader>
    <CardContent class="space-y-2">
      <div
        v-for="entry in items"
        :key="entry.item.id"
        class="flex items-center gap-3 rounded-md border p-3"
      >
        <div
          class="flex size-5 shrink-0 items-center justify-center rounded-full border"
          :class="
            entry.done
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-muted-foreground/40'
          "
        >
          <CheckIcon v-if="entry.done" class="size-3" />
        </div>
        <div class="min-w-0 flex-1">
          <p
            class="text-foreground text-sm font-medium"
            :class="{ 'line-through opacity-60': entry.done }"
          >
            {{ entry.item.label }}
          </p>
          <p class="text-muted-foreground text-xs">
            {{ entry.item.description }}
          </p>
        </div>
        <template v-if="!entry.done">
          <Button
            v-if="entry.item.completion === 'manual'"
            variant="outline"
            size="sm"
            @click="setManual(entry.item.id, true)"
          >
            Mark done
          </Button>
          <Button
            v-else-if="entry.item.actionTourId || entry.item.actionTo"
            variant="outline"
            size="sm"
            @click="runAction(entry.item)"
          >
            <PlayIcon v-if="entry.item.actionTourId" class="size-3.5" />
            {{ entry.item.actionLabel ?? "Open" }}
            <ArrowRightIcon v-if="entry.item.actionTo" class="size-3.5" />
          </Button>
        </template>
      </div>
    </CardContent>
  </Card>
</template>
