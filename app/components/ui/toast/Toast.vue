<script setup lang="ts">
import { computed, ref } from "vue";
import { CircleCheck, CircleX, TriangleAlert, Info, LoaderCircle, X } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { toastVariants } from ".";
import { Button } from "~/components/ui/button";
import type { ToastItem } from "~/stores/toast";

const props = defineProps<{ toast: ToastItem }>();
const emit = defineEmits<{
  dismiss: [id: string];
  pause: [id: string];
  resume: [id: string];
}>();

const icons = {
  success: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  info: Info,
  loading: LoaderCircle,
} as const;

// Errors and warnings interrupt; everything else is announced politely.
const isAssertive = computed(
  () => props.toast.variant === "error" || props.toast.variant === "warning",
);

async function runAction() {
  const action = props.toast.action;
  if (!action) return;
  await action.onClick();
  if (action.dismissOnClick !== false) emit("dismiss", props.toast.id);
}

// --- Swipe-to-dismiss (touch / pointer) ---
const dragX = ref(0);
const swiping = ref(false);
let startX = 0;
let pointerId: number | null = null;

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === "mouse") return; // mouse uses the close button
  startX = e.clientX;
  pointerId = e.pointerId;
  swiping.value = true;
}

function onPointerMove(e: PointerEvent) {
  if (!swiping.value || e.pointerId !== pointerId) return;
  dragX.value = e.clientX - startX;
}

function onPointerUp(e: PointerEvent) {
  if (!swiping.value || e.pointerId !== pointerId) return;
  swiping.value = false;
  pointerId = null;
  if (Math.abs(dragX.value) > 80) {
    emit("dismiss", props.toast.id);
  } else {
    dragX.value = 0;
  }
}

const swipeStyle = computed(() =>
  dragX.value !== 0
    ? {
        transform: `translateX(${dragX.value}px)`,
        opacity: String(Math.max(0, 1 - Math.abs(dragX.value) / 200)),
      }
    : undefined,
);
</script>

<template>
  <div
    :class="cn(toastVariants({ variant: toast.variant }))"
    :data-swiping="swiping ? 'true' : undefined"
    :style="swipeStyle"
    :role="isAssertive ? 'alert' : 'status'"
    :aria-live="isAssertive ? 'assertive' : 'polite'"
    aria-atomic="true"
    @mouseenter="emit('pause', toast.id)"
    @mouseleave="emit('resume', toast.id)"
    @focusin="emit('pause', toast.id)"
    @focusout="emit('resume', toast.id)"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <component
      :is="icons[toast.variant]"
      data-slot="toast-icon"
      :class="[
        'size-5 shrink-0 translate-y-0.5',
        toast.variant === 'loading' ? 'animate-spin' : '',
      ]"
      aria-hidden="true"
    />

    <div class="min-w-0 flex-1">
      <p v-if="toast.title" class="font-medium leading-snug">
        {{ toast.title }}
        <span v-if="toast.count > 1" class="ml-1 text-muted-foreground">× {{ toast.count }}</span>
      </p>
      <p :class="['leading-snug break-words', toast.title ? 'text-muted-foreground' : '']">
        {{ toast.description }}
        <span v-if="!toast.title && toast.count > 1" class="ml-1 text-muted-foreground">
          × {{ toast.count }}
        </span>
      </p>
      <Button
        v-if="toast.action"
        variant="outline"
        size="sm"
        class="mt-2 h-7"
        @click="runAction"
      >
        {{ toast.action.label }}
      </Button>
    </div>

    <button
      v-if="toast.dismissible"
      type="button"
      class="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ring"
      aria-label="Dismiss notification"
      @click="emit('dismiss', toast.id)"
    >
      <X class="size-4" aria-hidden="true" />
    </button>
  </div>
</template>
