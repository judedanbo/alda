<script setup lang="ts">
import { Palette } from "lucide-vue-next";

const { current, themes, setTheme } = useTheme();
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-9">
        <Palette class="size-4" />
        <span class="sr-only">Change theme</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-44">
      <DropdownMenuLabel>Appearance</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup
        :model-value="current"
        @update:model-value="(value: string) => setTheme(value)"
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
    </DropdownMenuContent>
  </DropdownMenu>
</template>
