<script setup lang="ts">
import type { Component } from "vue";
import {
  PlayIcon,
  CompassIcon,
  LayoutDashboardIcon,
  FilePlus2Icon,
  UserCogIcon,
  FilesIcon,
  ChartColumnIcon,
  CircleUserIcon,
  BellIcon,
  SettingsIcon,
  LifeBuoyIcon,
  ClipboardCheckIcon,
  ShieldCheckIcon,
} from "lucide-vue-next";
import type { TourDefinition } from "~/help";

defineProps<{
  tours: TourDefinition[];
}>();

const { start, running } = useTour();

// Per-route icon + a short "where it runs" label, so each tour card signals
// the destination at a glance. Falls back to a compass for unmapped routes.
const ROUTE_META: Record<string, { icon: Component; where: string }> = {
  "/applicant/dashboard": { icon: LayoutDashboardIcon, where: "Dashboard" },
  "/applicant/declaration/new": { icon: FilePlus2Icon, where: "New declaration" },
  "/applicant/profile/setup": { icon: UserCogIcon, where: "Profile" },
  "/applicant/profile/edit": { icon: UserCogIcon, where: "Profile" },
  "/applicant/declarations": { icon: FilesIcon, where: "Declarations" },
  "/applicant/analytics": { icon: ChartColumnIcon, where: "Analytics" },
  "/account": { icon: CircleUserIcon, where: "Account" },
  "/notifications": { icon: BellIcon, where: "Notifications" },
  "/settings/preferences": { icon: SettingsIcon, where: "Settings" },
  "/contact": { icon: LifeBuoyIcon, where: "Support" },
  "/officer/reviews": { icon: ClipboardCheckIcon, where: "Reviews" },
  "/legal/verifications": { icon: ShieldCheckIcon, where: "Legal Unit" },
  "/admin/dashboard": { icon: LayoutDashboardIcon, where: "Admin" },
};

function metaFor(tour: TourDefinition): { icon: Component; where: string } {
  return (tour.route && ROUTE_META[tour.route]) || { icon: CompassIcon, where: "Tour" };
}
</script>

<template>
  <ul class="space-y-3">
    <li
      v-for="tour in tours"
      :key="tour.id"
      class="group flex items-start gap-4 rounded-xl border p-4 transition-all hover:border-primary/50 hover:shadow-sm"
    >
      <div
        class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:bg-primary/15"
      >
        <component :is="metaFor(tour).icon" class="size-5" />
      </div>

      <div class="min-w-0 flex-1">
        <p
          class="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide"
        >
          {{ metaFor(tour).where }}
        </p>
        <p class="text-foreground mt-0.5 font-medium">{{ tour.title }}</p>
        <p class="text-muted-foreground mt-0.5 text-sm">{{ tour.description }}</p>
        <Badge variant="outline" class="mt-2 font-normal">
          {{ tour.steps.length }} steps
        </Badge>
      </div>

      <Button
        size="sm"
        class="shrink-0 self-center"
        :disabled="running"
        @click="start(tour.id)"
      >
        <PlayIcon class="size-3.5" />
        Start
      </Button>
    </li>
  </ul>
</template>
