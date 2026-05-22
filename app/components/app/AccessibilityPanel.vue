<script setup lang="ts">
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { useAccessibilityStore } from "~/stores/accessibility";
import { TEXT_SIZE_LEVELS, type TextSize } from "~/utils/accessibility";

const a11y = useAccessibilityStore();
</script>

<template>
  <div class="space-y-6">
    <!-- Text size -->
    <fieldset>
      <legend class="text-sm font-medium mb-2">Text size</legend>
      <div
        class="grid grid-cols-4 gap-2"
        role="radiogroup"
        aria-label="Text size"
      >
        <button
          v-for="level in TEXT_SIZE_LEVELS"
          :key="level.id"
          type="button"
          role="radio"
          :aria-checked="a11y.prefs.textSize === level.id"
          class="rounded-md border px-3 py-2 text-sm transition-colors"
          :class="a11y.prefs.textSize === level.id
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border hover:bg-muted'"
          @click="a11y.setTextSize(level.id as TextSize)"
        >
          {{ level.label }}
        </button>
      </div>
    </fieldset>

    <Separator />

    <!-- Colour theme / contrast -->
    <div>
      <Label class="text-sm font-medium block mb-2">Colour theme &amp; contrast</Label>
      <AppThemeSwitcherCards />
    </div>

    <Separator />

    <!-- Reduce motion -->
    <div class="flex items-center justify-between">
      <div class="space-y-1 pr-4">
        <Label for="a11y-reduce-motion" class="text-sm font-medium">
          Reduce motion
        </Label>
        <p class="text-xs text-muted-foreground">
          Disable non-essential animations and transitions.
        </p>
      </div>
      <Switch
        id="a11y-reduce-motion"
        :model-value="a11y.prefs.reduceMotion"
        @update:model-value="a11y.setReduceMotion"
      />
    </div>

    <!-- Underline links -->
    <div class="flex items-center justify-between">
      <div class="space-y-1 pr-4">
        <Label for="a11y-underline-links" class="text-sm font-medium">
          Underline links
        </Label>
        <p class="text-xs text-muted-foreground">
          Always underline links in page content.
        </p>
      </div>
      <Switch
        id="a11y-underline-links"
        :model-value="a11y.prefs.underlineLinks"
        @update:model-value="a11y.setUnderlineLinks"
      />
    </div>

    <!-- Readable font -->
    <div class="flex items-center justify-between">
      <div class="space-y-1 pr-4">
        <Label for="a11y-readable-font" class="text-sm font-medium">
          Readable font
        </Label>
        <p class="text-xs text-muted-foreground">
          Use Atkinson Hyperlegible — a font designed for readability.
        </p>
      </div>
      <Switch
        id="a11y-readable-font"
        :model-value="a11y.prefs.readableFont"
        @update:model-value="a11y.setReadableFont"
      />
    </div>

    <Separator />

    <div class="flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        :disabled="!a11y.isCustomized"
        @click="a11y.reset()"
      >
        Reset to defaults
      </Button>
    </div>
  </div>
</template>
