<script setup lang="ts">
import { ref } from "vue";
import { Accessibility } from "lucide-vue-next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

const open = ref(false);
</script>

<template>
  <Sheet v-model:open="open">
    <SheetTrigger as-child>
      <button
        type="button"
        aria-label="Open accessibility settings"
        class="fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Accessibility class="h-6 w-6" aria-hidden="true" />
      </button>
    </SheetTrigger>
    <SheetContent side="left" class="w-full sm:max-w-md overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Accessibility</SheetTitle>
        <SheetDescription>
          Adjust display settings to make the portal easier to use. Your
          choices are saved on this device and synced to your account when
          signed in.
        </SheetDescription>
      </SheetHeader>
      <AppAccessibilityPanel class="mt-6 mx-4" />
      <div class="mt-6 border-t pt-4 text-sm mx-4">
        <NuxtLink to="/accessibility" class="text-primary hover:underline">
          Read our accessibility statement →
        </NuxtLink>
      </div>
    </SheetContent>
  </Sheet>
</template>
