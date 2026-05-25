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
      { icon: User, title: 'President and Vice-President' },
      { icon: Briefcase, title: 'Ministers and Deputy Ministers' },
      { icon: Users, title: 'Secretary to the Cabinet' },
      { icon: Building, title: 'Heads of Ministries and government departments' },
      { icon: User, title: 'Presidential Staffers and Aides' },
    ],
  },
  {
    id: 'legislative',
    label: 'Legislative',
    icon: Scroll,
    roles: [
      { icon: User, title: 'Speaker and Deputy Speakers' },
      { icon: Users, title: 'Members of Parliament' },
    ],
  },
  {
    id: 'judicial',
    label: 'Judicial',
    icon: Scale,
    roles: [
      { icon: Gavel, title: 'Chief Justice' },
      { icon: Scale, title: 'Justices of the Superior Court of Judicature' },
      { icon: User, title: 'Chairmen of Regional Tribunals and judicial officers' },
      { icon: Users, title: 'CHRAJ Commissioner and Deputies' },
    ],
  },
  {
    id: 'public-enterprises',
    label: 'Public Enterprises',
    icon: Building2,
    roles: [
      { icon: Users, title: 'Chairmen, MDs, Secretaries and GMs of state-controlled corporations' },
      { icon: Briefcase, title: 'Governor, Bank of Ghana and Deputies' },
      { icon: User, title: 'Chairmen of Electoral Commission, NCCE and Public Services Commission' },
      { icon: Building, title: 'Members of Central, Regional and District Tender Boards' },
    ],
  },
  {
    id: 'security',
    label: 'Security & Revenue',
    icon: ShieldCheck,
    roles: [
      { icon: Swords, title: 'Officers of the Police and Prison Services' },
      { icon: ShieldCheck, title: 'Armed Forces officers seconded to civilian institutions' },
      { icon: User, title: 'Immigration, Fire Service and CEPS officers (senior)' },
      { icon: Briefcase, title: 'IRS Assistant Inspector of Taxes and above' },
    ],
  },
  {
    id: 'others',
    label: 'Local & Others',
    icon: Globe,
    roles: [
      { icon: Globe, title: 'Ambassadors and High Commissioners' },
      { icon: User, title: 'District Chief Executives and MMDA presiding members' },
      { icon: BookOpen, title: 'Heads, accountants, auditors, procurement and budget officers in MDAs and MMDAs' },
      { icon: GraduationCap, title: 'Any public officer at or above the salary of a Director in the Civil Service' },
    ],
  },
]
</script>

<template>
  <section id="who-must-declare" class="py-20">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-foreground mb-4">
          Who Must Declare?
        </h2>
        <p class="text-muted-foreground max-w-2xl mx-auto">
          Schedule I of Act 550 (1998), giving effect to Article 286(5) of the
          1992 Constitution, lists the public offices required to declare
          assets and liabilities. The Armed Forces are excluded.
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
