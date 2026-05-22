<script setup lang="ts">
import type { DataTableColumn } from "~/components/app/DataTable.vue";
import { TONE_BADGE } from "~/utils/statusStyles";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface AdminStats {
  totalUsers: number;
  totalApplicants: number;
  totalOfficers: number;
  totalDeclarations: number;
  pendingDeclarations: number;
  approvedDeclarations: number;
  rejectedDeclarations: number;
  todayDeclarations: number;
}

interface RecentUser {
  id: string;
  email: string;
  roles: string[];
  isActive: boolean;
  createdAt: string;
}

interface RecentDeclaration {
  id: string;
  uniqueCode: string;
  status: string;
  applicant: { fullName: string | null };
  createdAt: string;
}

interface RecentCode {
  id: string;
  uniqueCode: string;
  status: string;
  applicant: { fullName: string | null };
  createdAt: string;
  isRegenerated: boolean;
  verificationCount: number;
}

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface AdminDashboardData {
  stats: AdminStats;
  codeLifecycle: { total: number; active: number; sealed: number; regenerated: number };
  funnelByMonth: { month: string; statuses: Record<string, number> }[];
  throughput: { date: string; codes: number; receipts: number }[];
  recentUsers: RecentUser[];
  recentDeclarations: RecentDeclaration[];
  recentCodes: RecentCode[];
  recentAuditLogs: AuditLogEntry[];
}

const { data: dashboard, loading } = useDashboardStats<AdminDashboardData>("/api/admin/stats");

const { data: complianceSummary, loading: complianceLoading } = useDashboardStats<{
  totalApplicantsWithOffices: number;
  compliant: number;
  upcoming: number;
  dueNow: number;
  overdue: number;
  complianceRate: number;
}>("/api/analytics/compliance/summary");

const stats = computed<AdminStats>(() =>
  dashboard.value?.stats ?? {
    totalUsers: 0,
    totalApplicants: 0,
    totalOfficers: 0,
    totalDeclarations: 0,
    pendingDeclarations: 0,
    approvedDeclarations: 0,
    rejectedDeclarations: 0,
    todayDeclarations: 0,
  },
);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const statusOrder = ["CODE_GENERATED", "FORM_COLLECTED", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "SEALED", "REJECTED"];

const funnelSeries = computed(() =>
  statusOrder.map((status) => ({
    name: status.replace("_", " "),
    data: dashboard.value?.funnelByMonth.map((m) => m.statuses[status] ?? 0) ?? [],
  })),
);
const funnelOptions = computed(() => ({
  chart: { stacked: true, toolbar: { show: false } },
  plotOptions: { bar: { borderRadius: 4, columnWidth: "55%" } },
  colors: ["#94A3B8", "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444"],
  legend: { position: "bottom" as const, fontSize: "12px" },
  xaxis: {
    categories:
      dashboard.value?.funnelByMonth.map((m) => {
        const [y, mm] = m.month.split("-");
        return `${monthLabels[Number(mm) - 1]} ${y!.slice(2)}`;
      }) ?? [],
  },
}));

const throughputSeries = computed(() => [
  { name: "Codes Issued", data: dashboard.value?.throughput.map((t) => t.codes) ?? [] },
  { name: "Receipts Generated", data: dashboard.value?.throughput.map((t) => t.receipts) ?? [] },
]);
const throughputOptions = computed(() => ({
  xaxis: {
    categories:
      dashboard.value?.throughput.map((t) => {
        const d = new Date(t.date);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      }) ?? [],
    tickAmount: 8,
  },
}));

const quickActions = [
  {
    title: "Manage Users",
    description: "View and manage system users",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    href: "/admin/users",
    color: "bg-blue-500",
  },
  {
    title: "Institutions",
    description: "Manage registered institutions",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    href: "/admin/institutions",
    color: "bg-green-500",
  },
  {
    title: "Audit Logs",
    description: "View system activity logs",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    href: "/admin/audit-logs",
    color: "bg-purple-500",
  },
  {
    title: "Reports",
    description: "Generate system reports",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    href: "/admin/reports",
    color: "bg-orange-500",
  },
];

// --- Tabbed tables: composable instances ---

const codeTable = useDataTable<RecentCode>("/api/admin/declarations", {
  perPage: 5,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "declarations",
});

const userTable = useDataTable<RecentUser>("/api/admin/users", {
  perPage: 5,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "users",
});

const declarationTable = useDataTable<RecentDeclaration>("/api/admin/declarations", {
  perPage: 5,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "declarations",
});

const auditTable = useDataTable<AuditLogEntry>("/api/admin/audit-logs", {
  perPage: 5,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "logs",
});

// --- Column definitions ---

const codeColumns: DataTableColumn[] = [
  { key: "uniqueCode", label: "Code", sortable: true },
  { key: "applicantName", label: "Applicant", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "verificationCount", label: "Verifications", sortable: true },
  { key: "isRegenerated", label: "Origin" },
  { key: "createdAt", label: "Issued", sortable: true },
];

const userColumns: DataTableColumn[] = [
  { key: "email", label: "Email", sortable: true },
  { key: "roles", label: "Roles" },
  { key: "isActive", label: "Status", sortable: true },
  { key: "createdAt", label: "Created", sortable: true },
];

const declarationColumns: DataTableColumn[] = [
  { key: "uniqueCode", label: "Code", sortable: true },
  { key: "applicantName", label: "Applicant", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "createdAt", label: "Created", sortable: true },
];

const auditColumns: DataTableColumn[] = [
  { key: "action", label: "Action", sortable: true },
  { key: "entityType", label: "Entity", sortable: true },
  { key: "userEmail", label: "User", sortable: true },
  { key: "ipAddress", label: "IP Address" },
  { key: "createdAt", label: "Time", sortable: true },
];

function getActionColor(action: string): string {
  if (action.includes("CREATE") || action.includes("REGISTER")) return TONE_BADGE.green!;
  if (action.includes("DELETE") || action.includes("REMOVE")) return TONE_BADGE.red!;
  if (action.includes("UPDATE") || action.includes("EDIT")) return TONE_BADGE.blue!;
  if (action.includes("LOGIN") || action.includes("LOGOUT")) return TONE_BADGE.purple!;
  return TONE_BADGE.neutral!;
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Admin Dashboard" description="System overview and management" />

    <!-- System Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <AppStatCard
        label="Total Users"
        :value="stats.totalUsers"
        :loading="loading"
        :footnote="`${stats.totalApplicants} applicants · ${stats.totalOfficers} officers`"
        icon-bg="bg-blue-100 dark:bg-blue-950/50"
        icon-color="text-blue-600 dark:text-blue-400"
        icon-path="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
      <AppStatCard
        label="Total Declarations"
        :value="stats.totalDeclarations"
        :loading="loading"
        :footnote="`${stats.todayDeclarations} submitted today`"
        icon-bg="bg-green-100 dark:bg-green-950/50"
        icon-color="text-green-600 dark:text-green-400"
        icon-path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
      <AppStatCard
        label="Pending Review"
        :value="stats.pendingDeclarations"
        :loading="loading"
        footnote="Awaiting officer action"
        icon-bg="bg-yellow-100 dark:bg-yellow-950/50"
        icon-color="text-yellow-600 dark:text-yellow-400"
        icon-path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
      <AppStatCard
        label="Approved"
        :value="stats.approvedDeclarations"
        :loading="loading"
        :footnote="`${stats.rejectedDeclarations} rejected`"
        value-color="text-emerald-600 dark:text-emerald-400"
        icon-bg="bg-emerald-100 dark:bg-emerald-950/50"
        icon-color="text-emerald-600 dark:text-emerald-400"
        icon-path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </div>

    <!-- Declaration Compliance -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-foreground">Declaration Compliance</h2>
      <NuxtLink to="/admin/compliance" class="text-sm text-primary hover:underline">
        View Details &rarr;
      </NuxtLink>
    </div>
    <ComplianceKpiCards
      :data="complianceSummary"
      :loading="complianceLoading"
      compliance-href="/admin/compliance"
    />

    <!-- Code Lifecycle -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Unique Code Lifecycle</CardTitle>
        <CardDescription>System-wide code generation and verification metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Total Issued</p>
            <p class="text-2xl font-bold text-foreground mt-1">{{ dashboard?.codeLifecycle.total ?? 0 }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Active</p>
            <p class="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{{ dashboard?.codeLifecycle.active ?? 0 }}</p>
            <p class="text-xs text-muted-foreground">In workflow</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Sealed</p>
            <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ dashboard?.codeLifecycle.sealed ?? 0 }}</p>
            <p class="text-xs text-muted-foreground">Completed</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Regenerated</p>
            <p class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ dashboard?.codeLifecycle.regenerated ?? 0 }}</p>
            <p class="text-xs text-muted-foreground">After rejection</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Charts -->
    <div class="grid lg:grid-cols-2 gap-4">
      <AppChartCard
        title="Pipeline by Month"
        description="Declarations by status, last 6 months"
        type="bar"
        :series="funnelSeries"
        :options="funnelOptions"
        :loading="loading"
        :height="320"
      />
      <AppChartCard
        title="Code Issuance vs Receipts"
        description="Daily volume, last 90 days"
        type="area"
        :series="throughputSeries"
        :options="throughputOptions"
        :loading="loading"
        :height="320"
      />
    </div>

    <AnalyticsSealedSummaryWidget role="admin" />

    <!-- Quick Actions -->
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <NuxtLink
            v-for="action in quickActions"
            :key="action.title"
            :to="action.href"
            class="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div :class="[action.color, 'w-10 h-10 rounded-lg flex items-center justify-center shrink-0']">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="action.icon" />
              </svg>
            </div>
            <div>
              <h3 class="font-medium text-foreground">{{ action.title }}</h3>
              <p class="text-sm text-muted-foreground">{{ action.description }}</p>
            </div>
          </NuxtLink>
        </div>
      </CardContent>
    </Card>

    <!-- Tabbed Recent Activity -->
    <Card>
      <Tabs default-value="codes" class="flex-col">
        <CardHeader class="relative z-10 pb-0">
          <TabsList>
            <TabsTrigger value="codes">Recent Codes</TabsTrigger>
            <TabsTrigger value="users">Recent Users</TabsTrigger>
            <TabsTrigger value="declarations">Recent Declarations</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent class="px-0 pt-6">
          <!-- Recent Codes -->
          <TabsContent value="codes">
            <AppDataTable
              :columns="codeColumns"
              :data="codeTable.data.value"
              :loading="codeTable.loading.value"
              :meta="codeTable.meta.value"
              :sort-column="codeTable.sortColumn.value"
              :sort-direction="codeTable.sortDirection.value"
              status-border-key="status"
              empty-message="No codes issued yet."
              @sort="codeTable.setSort"
              @page-change="codeTable.setPage"
            >
              <template #cell-uniqueCode="{ row }">
                <AppCodePill :code="(row as RecentCode).uniqueCode" :status="(row as RecentCode).status" />
              </template>
              <template #cell-applicantName="{ row }">
                <AppUserCell :name="(row as RecentCode).applicant?.fullName ?? undefined" />
              </template>
              <template #cell-status="{ value }">
                <StatusBadge :status="(value as string)" />
              </template>
              <template #cell-verificationCount="{ value }">
                <AppVerificationDots :count="(value as number) ?? 0" />
              </template>
              <template #cell-isRegenerated="{ value }">
                <Badge :class="(value as boolean)
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'">
                  {{ (value as boolean) ? 'Reissued' : 'Initial' }}
                </Badge>
              </template>
              <template #cell-createdAt="{ value }">
                <AppDateCell :date="(value as string)" relative />
              </template>
            </AppDataTable>
          </TabsContent>

          <!-- Recent Users -->
          <TabsContent value="users">
            <AppDataTable
              :columns="userColumns"
              :data="userTable.data.value"
              :loading="userTable.loading.value"
              :meta="userTable.meta.value"
              :sort-column="userTable.sortColumn.value"
              :sort-direction="userTable.sortDirection.value"
              status-border-key="isActive"
              empty-message="No users found."
              @sort="userTable.setSort"
              @page-change="userTable.setPage"
            >
              <template #cell-email="{ row }">
                <AppUserCell :name="(row as RecentUser).email" />
              </template>
              <template #cell-roles="{ value }">
                <div class="flex gap-1">
                  <Badge v-for="role in (value as string[])" :key="role" variant="secondary">
                    {{ role }}
                  </Badge>
                </div>
              </template>
              <template #cell-isActive="{ value }">
                <Badge :class="(value as boolean)
                  ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'">
                  {{ (value as boolean) ? 'Active' : 'Inactive' }}
                </Badge>
              </template>
              <template #cell-createdAt="{ value }">
                <AppDateCell :date="(value as string)" relative />
              </template>
              <template #footer>
                <div class="px-4 py-3 border-t">
                  <NuxtLink to="/admin/users" class="text-sm text-primary hover:underline">
                    View all users &rarr;
                  </NuxtLink>
                </div>
              </template>
            </AppDataTable>
          </TabsContent>

          <!-- Recent Declarations -->
          <TabsContent value="declarations">
            <AppDataTable
              :columns="declarationColumns"
              :data="declarationTable.data.value"
              :loading="declarationTable.loading.value"
              :meta="declarationTable.meta.value"
              :sort-column="declarationTable.sortColumn.value"
              :sort-direction="declarationTable.sortDirection.value"
              status-border-key="status"
              empty-message="No declarations found."
              @sort="declarationTable.setSort"
              @page-change="declarationTable.setPage"
            >
              <template #cell-uniqueCode="{ row }">
                <AppCodePill :code="(row as RecentDeclaration).uniqueCode" :status="(row as RecentDeclaration).status" />
              </template>
              <template #cell-applicantName="{ row }">
                <AppUserCell :name="(row as RecentDeclaration).applicant?.fullName ?? undefined" />
              </template>
              <template #cell-status="{ value }">
                <StatusBadge :status="(value as string)" />
              </template>
              <template #cell-createdAt="{ value }">
                <AppDateCell :date="(value as string)" relative />
              </template>
            </AppDataTable>
          </TabsContent>

          <!-- Audit Logs -->
          <TabsContent value="audit">
            <AppDataTable
              :columns="auditColumns"
              :data="auditTable.data.value"
              :loading="auditTable.loading.value"
              :meta="auditTable.meta.value"
              :sort-column="auditTable.sortColumn.value"
              :sort-direction="auditTable.sortDirection.value"
              status-border-key="action"
              empty-message="No audit logs found."
              @sort="auditTable.setSort"
              @page-change="auditTable.setPage"
            >
              <template #cell-action="{ value }">
                <Badge :class="getActionColor((value as string))">
                  {{ value }}
                </Badge>
              </template>
              <template #cell-entityType="{ value }">
                <span class="text-sm text-muted-foreground">{{ (value as string) || '-' }}</span>
              </template>
              <template #cell-userEmail="{ value }">
                <span class="text-sm">{{ (value as string) || 'System' }}</span>
              </template>
              <template #cell-ipAddress="{ value }">
                <span class="text-sm font-mono text-muted-foreground">{{ (value as string) || '-' }}</span>
              </template>
              <template #cell-createdAt="{ value }">
                <AppDateCell :date="(value as string)" relative />
              </template>
              <template #footer>
                <div class="px-4 py-3 border-t">
                  <NuxtLink to="/admin/audit-logs" class="text-sm text-primary hover:underline">
                    View all audit logs &rarr;
                  </NuxtLink>
                </div>
              </template>
            </AppDataTable>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  </div>
</template>
