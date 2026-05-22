<script setup lang="ts">
import { Palette } from "lucide-vue-next";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "~/components/ui/dropdown-menu";

const { current, themes, setTheme } = useTheme();
</script>

<template>
  <DropdownMenuSub>
    <DropdownMenuSubTrigger>
      <Palette class="size-4" />
      <span>Appearance</span>
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent class="w-44">
      <DropdownMenuRadioGroup
        :model-value="current"
        @update:model-value="(value) => setTheme(String(value))"
      >
        <DropdownMenuRadioItem
          v-for="theme in themes"
          :key="theme.id"
          :value="theme.id"
        >
          <span
            class="size-3 rounded-full border border-border"
            :style="{ backgroundColor: theme.swatch.primary }"
          />
          <span>{{ theme.label }}</span>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuSubContent>
  </DropdownMenuSub>
</template>
