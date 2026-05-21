<script setup lang="ts">
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
  applicantName: string;
  createdAt: string;
}

interface RecentCode {
  id: string;
  uniqueCode: string;
  status: string;
  applicantName: string;
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
const statusOrder = ["CODE_GENERATED", "FORM_COLLECTED", "SUBMITTED", "APPROVED", "SEALED", "REJECTED"];

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
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Admin Dashboard" description="System overview and management" />

    <!-- System Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Users"
        :value="stats.totalUsers"
        :loading="loading"
        :footnote="`${stats.totalApplicants} applicants · ${stats.totalOfficers} officers`"
        icon-bg="bg-blue-100"
        icon-color="text-blue-600"
        icon-path="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
      <StatCard
        label="Total Declarations"
        :value="stats.totalDeclarations"
        :loading="loading"
        :footnote="`${stats.todayDeclarations} submitted today`"
        icon-bg="bg-green-100"
        icon-color="text-green-600"
        icon-path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
      <StatCard
        label="Pending Review"
        :value="stats.pendingDeclarations"
        :loading="loading"
        footnote="Awaiting officer action"
        icon-bg="bg-yellow-100"
        icon-color="text-yellow-600"
        icon-path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
      <StatCard
        label="Approved"
        :value="stats.approvedDeclarations"
        :loading="loading"
        :footnote="`${stats.rejectedDeclarations} rejected`"
        value-color="text-emerald-600"
        icon-bg="bg-emerald-100"
        icon-color="text-emerald-600"
        icon-path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </div>

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
            <p class="text-2xl font-bold text-blue-600 mt-1">{{ dashboard?.codeLifecycle.active ?? 0 }}</p>
            <p class="text-xs text-muted-foreground">In workflow</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Sealed</p>
            <p class="text-2xl font-bold text-emerald-600 mt-1">{{ dashboard?.codeLifecycle.sealed ?? 0 }}</p>
            <p class="text-xs text-muted-foreground">Completed</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Regenerated</p>
            <p class="text-2xl font-bold text-amber-600 mt-1">{{ dashboard?.codeLifecycle.regenerated ?? 0 }}</p>
            <p class="text-xs text-muted-foreground">After rejection</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Charts -->
    <div class="grid lg:grid-cols-2 gap-4">
      <ChartCard
        title="Pipeline by Month"
        description="Declarations by status, last 6 months"
        type="bar"
        :series="funnelSeries"
        :options="funnelOptions"
        :loading="loading"
        :height="320"
      />
      <ChartCard
        title="Code Issuance vs Receipts"
        description="Daily volume, last 90 days"
        type="area"
        :series="throughputSeries"
        :options="throughputOptions"
        :loading="loading"
        :height="320"
      />
    </div>

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
      <Tabs default-value="codes">
        <CardHeader class="pb-0">
          <TabsList>
            <TabsTrigger value="codes">Recent Codes</TabsTrigger>
            <TabsTrigger value="users">Recent Users</TabsTrigger>
            <TabsTrigger value="declarations">Recent Declarations</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent class="pt-4">
          <!-- Recent Codes -->
          <TabsContent value="codes">
            <div v-if="loading" class="space-y-2">
              <Skeleton v-for="i in 5" :key="i" class="h-10 w-full" />
            </div>
            <div v-else-if="!dashboard?.recentCodes.length" class="text-center py-8 text-muted-foreground">
              No codes issued yet.
            </div>
            <div v-else class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verifications</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="code in dashboard.recentCodes" :key="code.id">
                    <TableCell class="font-mono text-sm">{{ code.uniqueCode }}</TableCell>
                    <TableCell class="text-sm">{{ code.applicantName }}</TableCell>
                    <TableCell><StatusBadge :status="code.status" /></TableCell>
                    <TableCell class="text-sm">{{ code.verificationCount }}</TableCell>
                    <TableCell>
                      <Badge :class="code.isRegenerated ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'">
                        {{ code.isRegenerated ? 'Reissued' : 'Initial' }}
                      </Badge>
                    </TableCell>
                    <TableCell class="text-sm text-muted-foreground">{{ formatDate(code.createdAt) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <!-- Recent Users -->
          <TabsContent value="users">
            <div v-if="loading" class="space-y-2">
              <Skeleton v-for="i in 5" :key="i" class="h-10 w-full" />
            </div>
            <div v-else-if="!dashboard?.recentUsers.length" class="text-center py-8 text-muted-foreground">
              No users found
            </div>
            <div v-else class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="user in dashboard.recentUsers" :key="user.id">
                    <TableCell class="text-sm">{{ user.email }}</TableCell>
                    <TableCell>
                      <div class="flex gap-1">
                        <Badge v-for="role in user.roles" :key="role" variant="secondary">{{ role }}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge :class="user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
                        {{ user.isActive ? 'Active' : 'Inactive' }}
                      </Badge>
                    </TableCell>
                    <TableCell class="text-sm text-muted-foreground">{{ formatDate(user.createdAt) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div class="mt-4 pt-4 border-t">
              <Button variant="link" as-child class="px-0">
                <NuxtLink to="/admin/users">View all users &rarr;</NuxtLink>
              </Button>
            </div>
          </TabsContent>

          <!-- Recent Declarations -->
          <TabsContent value="declarations">
            <div v-if="loading" class="space-y-2">
              <Skeleton v-for="i in 5" :key="i" class="h-10 w-full" />
            </div>
            <div v-else-if="!dashboard?.recentDeclarations.length" class="text-center py-8 text-muted-foreground">
              No declarations found
            </div>
            <div v-else class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="declaration in dashboard.recentDeclarations" :key="declaration.id">
                    <TableCell class="font-mono text-sm">{{ declaration.uniqueCode }}</TableCell>
                    <TableCell class="text-sm">{{ declaration.applicantName }}</TableCell>
                    <TableCell><StatusBadge :status="declaration.status" /></TableCell>
                    <TableCell class="text-sm text-muted-foreground">{{ formatDate(declaration.createdAt) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <!-- Audit Logs -->
          <TabsContent value="audit">
            <div v-if="loading" class="space-y-2">
              <Skeleton v-for="i in 5" :key="i" class="h-10 w-full" />
            </div>
            <div v-else-if="!dashboard?.recentAuditLogs.length" class="text-center py-8 text-muted-foreground">
              No audit logs found
            </div>
            <div v-else class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="log in dashboard.recentAuditLogs" :key="log.id">
                    <TableCell class="text-sm">{{ log.action }}</TableCell>
                    <TableCell class="text-sm text-muted-foreground">{{ log.entityType || '-' }}</TableCell>
                    <TableCell class="text-sm">{{ log.userEmail || 'System' }}</TableCell>
                    <TableCell class="text-sm font-mono text-muted-foreground">{{ log.ipAddress || '-' }}</TableCell>
                    <TableCell class="text-sm text-muted-foreground">{{ formatDate(log.createdAt) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div class="mt-4 pt-4 border-t">
              <Button variant="link" as-child class="px-0">
                <NuxtLink to="/admin/audit-logs">View all audit logs &rarr;</NuxtLink>
              </Button>
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  </div>
</template>
