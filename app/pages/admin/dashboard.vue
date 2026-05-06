<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const { getAuthHeaders } = useAuth();

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

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const stats = ref<AdminStats>({
  totalUsers: 0,
  totalApplicants: 0,
  totalOfficers: 0,
  totalDeclarations: 0,
  pendingDeclarations: 0,
  approvedDeclarations: 0,
  rejectedDeclarations: 0,
  todayDeclarations: 0,
});

const recentUsers = ref<RecentUser[]>([]);
const recentDeclarations = ref<RecentDeclaration[]>([]);
const recentAuditLogs = ref<AuditLogEntry[]>([]);

const loading = ref(true);

const fetchDashboardData = async () => {
  try {
    const response = await $fetch("/api/admin/stats", {
      headers: getAuthHeaders(),
    });

    if (response.success) {
      stats.value = response.data.stats;
      recentUsers.value = response.data.recentUsers;
      recentDeclarations.value = response.data.recentDeclarations;
      recentAuditLogs.value = response.data.recentAuditLogs;
    }
  } catch (error) {
    console.error("Failed to fetch admin dashboard data:", error);
  } finally {
    loading.value = false;
  }
};

await fetchDashboardData();

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton v-for="i in 4" :key="i" class="h-32 rounded-lg" />
      </div>
      <Skeleton class="h-48 rounded-lg" />
      <Skeleton class="h-64 rounded-lg" />
    </div>

    <template v-else>
      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent class="pt-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted-foreground">Total Users</p>
                <p class="text-3xl font-bold text-foreground mt-1">
                  {{ stats.totalUsers }}
                </p>
              </div>
              <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div class="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span>{{ stats.totalApplicants }} applicants</span>
              <span>{{ stats.totalOfficers }} officers</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="pt-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted-foreground">Total Declarations</p>
                <p class="text-3xl font-bold text-foreground mt-1">
                  {{ stats.totalDeclarations }}
                </p>
              </div>
              <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              {{ stats.todayDeclarations }} submitted today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="pt-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted-foreground">Pending Review</p>
                <p class="text-3xl font-bold text-foreground mt-1">
                  {{ stats.pendingDeclarations }}
                </p>
              </div>
              <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              Awaiting officer action
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="pt-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted-foreground">Approved</p>
                <p class="text-3xl font-bold text-foreground mt-1">
                  {{ stats.approvedDeclarations }}
                </p>
              </div>
              <div class="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              {{ stats.rejectedDeclarations }} rejected
            </p>
          </CardContent>
        </Card>
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

      <!-- Tabbed Content -->
      <Card>
        <Tabs default-value="users">
          <CardHeader class="pb-0">
            <TabsList>
              <TabsTrigger value="users">Recent Users</TabsTrigger>
              <TabsTrigger value="declarations">Recent Declarations</TabsTrigger>
              <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent class="pt-4">
            <!-- Recent Users -->
            <TabsContent value="users">
              <div v-if="recentUsers.length === 0" class="text-center py-8 text-muted-foreground">
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
                    <TableRow v-for="user in recentUsers" :key="user.id">
                      <TableCell class="text-sm">{{ user.email }}</TableCell>
                      <TableCell>
                        <div class="flex gap-1">
                          <Badge v-for="role in user.roles" :key="role" variant="secondary">
                            {{ role }}
                          </Badge>
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
              <div v-if="recentDeclarations.length === 0" class="text-center py-8 text-muted-foreground">
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
                    <TableRow v-for="declaration in recentDeclarations" :key="declaration.id">
                      <TableCell class="font-mono text-sm">{{ declaration.uniqueCode }}</TableCell>
                      <TableCell class="text-sm">{{ declaration.applicantName }}</TableCell>
                      <TableCell>
                        <StatusBadge :status="declaration.status" />
                      </TableCell>
                      <TableCell class="text-sm text-muted-foreground">{{ formatDate(declaration.createdAt) }}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <!-- Audit Logs -->
            <TabsContent value="audit">
              <div v-if="recentAuditLogs.length === 0" class="text-center py-8 text-muted-foreground">
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
                    <TableRow v-for="log in recentAuditLogs" :key="log.id">
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
    </template>
  </div>
</template>
