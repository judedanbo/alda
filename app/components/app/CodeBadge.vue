<script setup lang="ts">
import QRCode from "qrcode";

interface Props {
  code: string;
  showQr?: boolean;
  size?: "sm" | "md" | "lg";
}

const props = withDefaults(defineProps<Props>(), {
  showQr: false,
  size: "md",
});

const copied = ref(false);
const qrDataUrl = ref<string | null>(null);

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.code);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Clipboard might be unavailable in some browsers/contexts; fail silently.
  }
}

watchEffect(async () => {
  if (!props.showQr || !import.meta.client) {
    qrDataUrl.value = null;
    return;
  }
  try {
    qrDataUrl.value = await QRCode.toDataURL(props.code, {
      margin: 1,
      width: 160,
      color: { dark: "#006B3F", light: "#FFFFFF" },
    });
  } catch {
    qrDataUrl.value = null;
  }
});

const codeClass = computed(() => {
  switch (props.size) {
    case "sm": return "text-xs px-2 py-1";
    case "lg": return "text-lg px-4 py-2";
    default: return "text-sm px-3 py-1.5";
  }
});
</script>

<template>
  <div class="flex items-center gap-3 flex-wrap">
    <div class="flex items-center gap-2">
      <code
        class="font-mono font-semibold tracking-wider bg-muted rounded border"
        :class="codeClass"
      >
        {{ code }}
      </code>
      <Button
        size="sm"
        variant="ghost"
        :title="copied ? 'Copied' : 'Copy code'"
        :aria-label="copied ? 'Code copied' : 'Copy code'"
        @click="copyCode"
      >
        <svg
          v-if="!copied"
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <svg
          v-else
          class="w-4 h-4 text-green-600 dark:text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </Button>
    </div>
    <ClientOnly v-if="showQr">
      <img
        v-if="qrDataUrl"
        :src="qrDataUrl"
        alt="QR code for declaration code"
        class="border rounded bg-white p-1"
        width="120"
        height="120"
      >
    </ClientOnly>
  </div>
</template>
