<script setup lang="ts">
import type { HelpRole } from "~/help";
import { HELP_ROLES, ROLE_META } from "~/help";

const role = defineModel<HelpRole>({ required: true });
</script>

<template>
  <Select v-model="role">
    <SelectTrigger class="w-full sm:w-56">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="r in HELP_ROLES" :key="r" :value="r">
        {{ ROLE_META[r].label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
