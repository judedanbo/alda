<script setup lang="ts">
import {
  Landmark,
  Scroll,
  Scale,
  Building2,
  ShieldCheck,
  Users,
  User,
  Briefcase,
  GraduationCap,
  Gavel,
  Swords,
  Globe,
  BookOpen,
  Building,
} from 'lucide-vue-next'
import type { Component } from 'vue'

interface RoleEntry {
  icon: Component
  title: string
}

interface BranchTab {
  id: string
  label: string
  icon: Component
  roles: RoleEntry[]
}

const branches: BranchTab[] = [
  {
    id: 'executive',
    label: 'Executive',
    icon: Landmark,
    roles: [
      { icon: User, title: 'President and Vice President' },
      { icon: Briefcase, title: 'Ministers and Deputy Ministers' },
      { icon: Users, title: 'Secretary to Cabinet' },
      { icon: Building, title: 'Heads of Ministries' },
    ],
  },
  {
    id: 'legislative',
    label: 'Legislative',
    icon: Scroll,
    roles: [
      { icon: User, title: 'Speaker and Deputy Speakers' },
      { icon: Users, title: 'Members of Parliament' },
      { icon: Briefcase, title: 'Parliamentary Staff (senior)' },
    ],
  },
  {
    id: 'judicial',
    label: 'Judicial',
    icon: Scale,
    roles: [
      { icon: Gavel, title: 'Chief Justice' },
      { icon: Scale, title: 'Justices of Superior Courts' },
      { icon: User, title: 'Regional Tribunal Chairmen' },
    ],
  },
  {
    id: 'public-enterprises',
    label: 'Public Enterprises',
    icon: Building2,
    roles: [
      { icon: Users, title: 'Board Chairmen and Members' },
      { icon: Briefcase, title: 'Managing Directors' },
      { icon: User, title: 'Deputy Managing Directors' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    icon: ShieldCheck,
    roles: [
      { icon: Swords, title: 'Police Service Officers' },
      { icon: ShieldCheck, title: 'Armed Forces Officers' },
      { icon: User, title: 'Immigration & Prisons Officers' },
    ],
  },
  {
    id: 'others',
    label: 'Others',
    icon: Globe,
    roles: [
      { icon: Globe, title: 'Ambassadors & High Commissioners' },
      { icon: GraduationCap, title: 'Heads of Educational Institutions' },
      { icon: BookOpen, title: 'Members of Regulatory Bodies' },
    ],
  },
]
</script>

<template>
  <section class="py-20">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-foreground mb-4">
          Who Must Declare?
        </h2>
        <p class="text-muted-foreground max-w-2xl mx-auto">
          Under Article 286(5) of the 1992 Constitution, the following public
          officials are required to declare their assets
        </p>
      </div>

      <Tabs default-value="executive">
        <TabsList variant="line" class="w-full justify-start overflow-x-auto">
          <TabsTrigger
            v-for="branch in branches"
            :key="branch.id"
            :value="branch.id"
            class="gap-1.5"
          >
            <component :is="branch.icon" class="size-4" />
            <span class="hidden sm:inline">{{ branch.label }}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          v-for="branch in branches"
          :key="branch.id"
          :value="branch.id"
          class="mt-6"
        >
          <div class="grid sm:grid-cols-2 gap-3">
            <div
              v-for="role in branch.roles"
              :key="role.title"
              class="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10"
            >
              <div
                class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"
              >
                <component :is="role.icon" class="size-4 text-primary" />
              </div>
              <span class="font-medium text-sm text-foreground">
                {{ role.title }}
              </span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </section>
</template>
