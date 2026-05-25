<script setup lang="ts">
import { computed, ref, useId } from "vue";
import { ImageIcon } from "lucide-vue-next";
import { Label } from "~/components/ui/label";

const props = withDefaults(
  defineProps<{
    label: string;
    required?: boolean;
    accept?: string;
    uploading?: boolean;
    imageUrl?: string;
    imageAlt?: string;
    error?: string;
    helpText?: string;
    successText?: string;
    placeholderText?: string;
  }>(),
  {
    required: false,
    accept: "image/*",
    uploading: false,
    imageUrl: "",
    imageAlt: "",
    error: "",
    helpText: "",
    successText: "",
    placeholderText: "Click, press Enter, or drop a file to upload.",
  },
);

const emit = defineEmits<{
  fileSelected: [file: File];
}>();

const reactId = useId();
const dropzoneId = computed(() => `dropzone-${reactId}`);
const helpId = computed(() => `${dropzoneId.value}-help`);
const errorId = computed(() => `${dropzoneId.value}-error`);

const inputRef = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);
// dragenter/dragleave fire when crossing into child elements too. Track a
// counter so the visual state only flips when we truly enter/leave the zone.
let dragCounter = 0;

function openPicker() {
  if (props.uploading) return;
  inputRef.value?.click();
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) emit("fileSelected", input.files[0]);
  // Reset so re-selecting the same file still fires change.
  input.value = "";
}

function onDragEnter() {
  if (props.uploading) return;
  dragCounter += 1;
  dragOver.value = true;
}
function onDragLeave() {
  dragCounter -= 1;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dragOver.value = false;
  }
}
function onDrop(event: DragEvent) {
  dragCounter = 0;
  dragOver.value = false;
  if (props.uploading) return;
  const file = event.dataTransfer?.files?.[0];
  if (file) emit("fileSelected", file);
}

const describedBy = computed(() => {
  const ids: string[] = [];
  if (props.helpText) ids.push(helpId.value);
  if (props.error) ids.push(errorId.value);
  return ids.length ? ids.join(" ") : undefined;
});

const ariaLabel = computed(() => {
  if (props.uploading) return `${props.label}, uploading`;
  if (props.imageUrl) return `${props.label}, uploaded. Activate to replace.`;
  return `${props.label}. Activate to upload.`;
});
</script>

<template>
  <div class="space-y-2">
    <Label :for="dropzoneId" class="inline-flex items-center gap-1.5">
      {{ label }}
      <span v-if="required" class="text-destructive" aria-hidden="true">*</span>
      <slot name="label-suffix" />
    </Label>

    <div
      :id="dropzoneId"
      role="button"
      tabindex="0"
      :aria-label="ariaLabel"
      :aria-describedby="describedBy"
      :aria-disabled="uploading || undefined"
      class="border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      :class="[
        dragOver
          ? 'border-primary bg-primary/10'
          : imageUrl
            ? 'border-primary bg-primary/5'
            : error
              ? 'border-destructive'
              : 'border-muted-foreground/30',
        uploading ? 'cursor-wait opacity-70' : '',
      ]"
      @click="openPicker"
      @keydown.enter.prevent="openPicker"
      @keydown.space.prevent="openPicker"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div v-if="uploading" class="text-muted-foreground text-sm">
        Uploading…
      </div>
      <template v-else-if="imageUrl">
        <img
          :src="imageUrl"
          :alt="imageAlt || label"
          class="max-h-40 mx-auto rounded-md mb-2"
        >
        <p class="text-sm text-success">
          {{ successText || "Uploaded successfully" }}
        </p>
        <p class="text-xs text-muted-foreground mt-1">
          Activate to replace
        </p>
      </template>
      <template v-else>
        <ImageIcon
          class="w-12 h-12 mx-auto text-muted-foreground/50 mb-2"
          aria-hidden="true"
        />
        <p class="text-sm text-muted-foreground">
          {{ placeholderText }}
        </p>
      </template>
    </div>

    <input
      ref="inputRef"
      type="file"
      :accept="accept"
      :disabled="uploading"
      tabindex="-1"
      class="sr-only"
      @change="onChange"
    >

    <p v-if="helpText" :id="helpId" class="text-xs text-muted-foreground">
      {{ helpText }}
    </p>
    <!--
      Persistent polite live region so newly-appearing upload errors are
      announced. Empty when no error; visually hidden so it doesn't take
      vertical space.
    -->
    <p
      :id="errorId"
      class="text-xs text-destructive"
      :class="error ? '' : 'sr-only'"
      role="status"
      aria-live="polite"
    >
      {{ error ?? "" }}
    </p>
  </div>
</template>
