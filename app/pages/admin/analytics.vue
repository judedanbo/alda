<script setup lang="ts">
import type { ApexOptions } from "apexcharts";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

// --- types ---------------------------------------------------------------
interface LabelCount { label: string; requests?: number; count?: number }

interface OverviewData {
  range: string;
  grain: string;
  summary: {
    totalRequests: number; errors: number; errorRate: number;
    uniqueVisitors: number; uniqueSessions: number; newVisitors: number;
    avgResponseMs: number; p95ResponseMs: number; totalBytes: number;
  };
  timeseries: { buckets: string[]; requestsByClass: Record<string, number[]>; errors: number[] };
  topPages: LabelCount[]; topReferrers: LabelCount[]; byCountry: LabelCount[];
  byDevice: LabelCount[]; byBrowser: LabelCount[]; visitorClassSplit: LabelCount[];
}
interface RealtimeData {
  windowMinutes: number; activeSessions: number; activeVisitors: number;
  totalRequests: number; bufferDepth: number;
  requestsByMinute: { buckets: string[]; counts: number[] };
  visitorClassSplit: LabelCount[];
  recentRequests: Array<{
    occurredAt: string; method: string; path: string; statusCode: number;
    durationMs: number; visitorClass: string; aiProvider: string | null;
    ipTruncated: string | null; country: string | null;
  }>;
}
interface AbuseData {
  range: string;
  summary: { totalEvents: number; activeEnforcement: number; bySeverity: LabelCount[] };
  byCategory: LabelCount[];
  timeline: { buckets: string[]; counts: number[] };
  topOffenders: Array<{ ipTruncated: string; actorKey: string; events: number; maxScore: number; lastSeen: string | null }>;
  recentEvents: Array<{ id: string; detectedAt: string; category: string; severity: string; score: number; ipTruncated: string | null; path: string | null }>;
  enforcementActions: Array<{ id: string; type: string; actorKey: string; reason: string; source: string; expiresAt: string | null; active: boolean; createdAt: string }>;
  accessRules: Array<{ id: string; actorType: string; actorValue: string; ruleType: string; reason: string | null; expiresAt: string | null; createdAt: string }>;
}
interface AiData {
  range: string;
  summary: { aiRequests: number; totalRequests: number; aiShare: number; spoofedCount: number; cloakedCount: number; robotsViolations: number };
  visitorClassSplit: LabelCount[]; byProvider: LabelCount[]; byCategory: LabelCount[];
  topPages: LabelCount[]; verification: LabelCount[];
  trend: { buckets: string[]; ai: number[]; total: number[] };
}
interface RateLimitData {
  range: string;
  summary: { total429: number; activeThrottles: number; activeBlocks: number };
  config: Record<string, number | string | boolean>;
  topThrottledRoutes: LabelCount[]; topThrottledActors: LabelCount[];
  timeline: { buckets: string[]; counts: number[] };
  throttleActions: Array<{ id: string; actorKey: string; reason: string; source: string; expiresAt: string | null; active: boolean; createdAt: string }>;
}

// --- state ---------------------------------------------------------------
const ranges = [
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];
const range = ref("24h");
const activeTab = ref("overview");

const overview = ref<OverviewData | null>(null);
const realtime = ref<RealtimeData | null>(null);
const abuse = ref<AbuseData | null>(null);
const ai = ref<AiData | null>(null);
const ratelimit = ref<RateLimitData | null>(null);

const loading = reactive<Record<string, boolean>>({
  overview: false, realtime: false, abuse: false, ai: false, ratelimit: false,
});
const loaded = reactive<Record<string, boolean>>({
  overview: false, realtime: false, abuse: false, ai: false, ratelimit: false,
});

// --- helpers -------------------------------------------------------------
function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function shortTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function classLabel(c: string): string {
  return ({ HUMAN: "Human", SEARCH_BOT: "Search bot", AI_AGENT: "AI agent", OTHER_BOT: "Other bot" } as Record<string, string>)[c] || c;
}
function statusColor(code: number): string {
  if (code >= 500) return "bg-red-100 text-red-800";
  if (code === 429) return "bg-orange-100 text-orange-800";
  if (code >= 400) return "bg-amber-100 text-amber-800";
  return "bg-green-100 text-green-800";
}
function severityColor(s: string): string {
  return ({
    LOW: "bg-slate-100 text-slate-700", MEDIUM: "bg-amber-100 text-amber-800",
    HIGH: "bg-orange-100 text-orange-800", CRITICAL: "bg-red-100 text-red-800",
  } as Record<string, string>)[s] || "bg-slate-100 text-slate-700";
}

// --- data fetching -------------------------------------------------------
async function fetchTab(tab: string) {
  loading[tab] = true;
  try {
    const res = await authFetch<{ success: boolean; data: unknown }>(
      `/api/admin/analytics/${tab === "ratelimit" ? "rate-limit" : tab}?range=${range.value}`,
    );
    if (res.success) {
      if (tab === "overview") overview.value = res.data as OverviewData;
      else if (tab === "realtime") realtime.value = res.data as RealtimeData;
      else if (tab === "abuse") abuse.value = res.data as AbuseData;
      else if (tab === "ai") ai.value = res.data as AiData;
      else if (tab === "ratelimit") ratelimit.value = res.data as RateLimitData;
      loaded[tab] = true;
    }
  } catch (error) {
    console.error(`Failed to load analytics tab "${tab}":`, error);
  } finally {
    loading[tab] = false;
  }
}

function ensureTab(tab: string) {
  if (!loaded[tab] && !loading[tab]) fetchTab(tab);
}

watch(range, () => {
  // Refetch every tab that has already been viewed.
  for (const tab of Object.keys(loaded)) {
    if (loaded[tab]) fetchTab(tab);
  }
});
watch(activeTab, (tab) => ensureTab(tab));

// Realtime auto-refresh while its tab is active.
let realtimeTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  fetchTab("overview");
  realtimeTimer = setInterval(() => {
    if (activeTab.value === "realtime") fetchTab("realtime");
  }, 15_000);
});
onUnmounted(() => {
  if (realtimeTimer) clearInterval(realtimeTimer);
});

// --- manual enforcement --------------------------------------------------
const ruleForm = reactive({ ip: "", reason: "", submitting: false, message: "" });
async function submitRule(action: "block" | "allow" | "unblock") {
  if (!ruleForm.ip.trim()) {
    ruleForm.message = "Enter an IP address.";
    return;
  }
  ruleForm.submitting = true;
  ruleForm.message = "";
  try {
    const res = await authFetch<{ success: boolean; message: string }>(
      "/api/admin/analytics/actor-rule",
      { method: "POST", body: { action, ip: ruleForm.ip.trim(), reason: ruleForm.reason || undefined } },
    );
    ruleForm.message = res.message;
    ruleForm.ip = "";
    ruleForm.reason = "";
    await fetchTab("abuse");
  } catch (error) {
    ruleForm.message = "Action failed. Check the IP and try again.";
    console.error("actor-rule failed:", error);
  } finally {
    ruleForm.submitting = false;
  }
}

// --- chart builders ------------------------------------------------------
const requestsChart = computed(() => {
  const ts = overview.value?.timeseries;
  if (!ts) return { series: [] as ApexOptions["series"], options: {} as ApexOptions };
  const series = Object.entries(ts.requestsByClass)
    .filter(([, data]) => data.some((v) => v > 0))
    .map(([cls, data]) => ({ name: classLabel(cls), data }));
  return {
    series: series.length ? series : [{ name: "Requests", data: ts.buckets.map(() => 0) }],
    options: { xaxis: { categories: ts.buckets.map(shortTime) }, chart: { stacked: true } } as ApexOptions,
  };
});

function donut(items: LabelCount[], labelMap?: (s: string) => string) {
  return {
    series: items.map((i) => i.requests ?? i.count ?? 0),
    options: { labels: items.map((i) => (labelMap ? labelMap(i.label) : i.label)) } as ApexOptions,
  };
}
function hbar(items: LabelCount[]) {
  return {
    series: [{ name: "Requests", data: items.map((i) => i.requests ?? i.count ?? 0) }] as ApexOptions["series"],
    options: {
      xaxis: { categories: items.map((i) => i.label) },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
    } as ApexOptions,
  };
}

const realtimeChart = computed(() => {
  const m = realtime.value?.requestsByMinute;
  return {
    series: [{ name: "Requests", data: m?.counts ?? [] }] as ApexOptions["series"],
    options: { xaxis: { categories: (m?.buckets ?? []).map((b) => new Date(b).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })) } } as ApexOptions,
  };
});

const aiTrendChart = computed(() => {
  const t = ai.value?.trend;
  if (!t) return { series: [] as ApexOptions["series"], options: {} as ApexOptions };
  return {
    series: [
      { name: "AI agents", data: t.ai },
      { name: "All traffic", data: t.total },
    ],
    options: { xaxis: { categories: t.buckets.map(shortTime) } } as ApexOptions,
  };
});

const abuseTimelineChart = computed(() => {
  const t = abuse.value?.timeline;
  return {
    series: [{ name: "Abuse events", data: t?.counts ?? [] }] as ApexOptions["series"],
    options: { xaxis: { categories: (t?.buckets ?? []).map(shortTime) }, colors: ["#CE1126"] } as ApexOptions,
  };
});

const rlTimelineChart = computed(() => {
  const t = ratelimit.value?.timeline;
  return {
    series: [{ name: "429 responses", data: t?.counts ?? [] }] as ApexOptions["series"],
    options: { xaxis: { categories: (t?.buckets ?? []).map(shortTime) }, colors: ["#F97316"] } as ApexOptions,
  };
});
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Web Analytics" description="Traffic, abuse detection, AI crawlers and rate limiting">
      <template #actions>
        <Select v-model="range">
          <SelectTrigger class="w-44">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="r in ranges" :key="r.value" :value="r.value">{{ r.label }}</SelectItem>
          </SelectContent>
        </Select>
      </template>
    </PageHeader>

    <Tabs v-model="activeTab" default-value="overview">
      <TabsList class="flex-wrap h-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="realtime">Realtime</TabsTrigger>
        <TabsTrigger value="abuse">Abuse</TabsTrigger>
        <TabsTrigger value="ai">AI &amp; Bots</TabsTrigger>
        <TabsTrigger value="ratelimit">Rate Limiting</TabsTrigger>
      </TabsList>

      <!-- ============ OVERVIEW ============ -->
      <TabsContent value="overview" class="space-y-4 mt-4">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Requests" :value="fmt(overview?.summary.totalRequests)" :loading="loading.overview" />
          <StatCard label="Unique visitors" :value="fmt(overview?.summary.uniqueVisitors)" :loading="loading.overview" footnote="per-bucket distinct" />
          <StatCard label="Sessions" :value="fmt(overview?.summary.uniqueSessions)" :loading="loading.overview" />
          <StatCard label="Avg response" :value="`${overview?.summary.avgResponseMs ?? 0}ms`" :loading="loading.overview" />
          <StatCard label="p95 response" :value="`${overview?.summary.p95ResponseMs ?? 0}ms`" :loading="loading.overview" />
          <StatCard
            label="Error rate"
            :value="fmtPct(overview?.summary.errorRate ?? 0)"
            :loading="loading.overview"
            :value-color="(overview?.summary.errorRate ?? 0) > 0.1 ? 'text-red-600' : 'text-foreground'"
          />
        </div>

        <ChartCard
          title="Requests over time"
          description="By visitor class"
          type="area"
          :series="requestsChart.series"
          :options="requestsChart.options"
          :loading="loading.overview"
          :height="300"
        />

        <div class="grid lg:grid-cols-3 gap-4">
          <ChartCard
            title="Traffic by class"
            type="donut"
            :series="donut(overview?.visitorClassSplit ?? [], classLabel).series"
            :options="donut(overview?.visitorClassSplit ?? [], classLabel).options"
            :loading="loading.overview"
            :height="280"
          />
          <ChartCard
            title="Device split"
            type="donut"
            :series="donut(overview?.byDevice ?? []).series"
            :options="donut(overview?.byDevice ?? []).options"
            :loading="loading.overview"
            :height="280"
          />
          <ChartCard
            title="Browser split"
            type="donut"
            :series="donut(overview?.byBrowser ?? []).series"
            :options="donut(overview?.byBrowser ?? []).options"
            :loading="loading.overview"
            :height="280"
          />
        </div>

        <div class="grid lg:grid-cols-2 gap-4">
          <ChartCard
            title="Top pages"
            type="bar"
            :series="hbar(overview?.topPages ?? []).series"
            :options="hbar(overview?.topPages ?? []).options"
            :loading="loading.overview"
            :height="320"
          />
          <ChartCard
            title="Traffic by country"
            type="bar"
            :series="hbar(overview?.byCountry ?? []).series"
            :options="hbar(overview?.byCountry ?? []).options"
            :loading="loading.overview"
            :height="320"
          />
        </div>

        <Card>
          <CardHeader><CardTitle class="text-base">Top referrers</CardTitle></CardHeader>
          <CardContent>
            <p v-if="!overview?.topReferrers.length" class="text-sm text-muted-foreground py-4">
              No external referrers in this range.
            </p>
            <div v-else class="space-y-2">
              <div v-for="r in overview.topReferrers" :key="r.label" class="flex justify-between text-sm">
                <span class="text-foreground truncate">{{ r.label }}</span>
                <span class="text-muted-foreground font-mono">{{ fmt(r.requests) }}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- ============ REALTIME ============ -->
      <TabsContent value="realtime" class="space-y-4 mt-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Requests (30m)" :value="fmt(realtime?.totalRequests)" :loading="loading.realtime" />
          <StatCard label="Active sessions" :value="fmt(realtime?.activeSessions)" :loading="loading.realtime" />
          <StatCard label="Active visitors" :value="fmt(realtime?.activeVisitors)" :loading="loading.realtime" />
          <StatCard label="Capture buffer" :value="fmt(realtime?.bufferDepth)" :loading="loading.realtime" footnote="events pending write" />
        </div>

        <ChartCard
          title="Requests per minute"
          description="Last 30 minutes — auto-refreshes every 15s"
          type="area"
          :series="realtimeChart.series"
          :options="realtimeChart.options"
          :loading="loading.realtime"
          :height="260"
        />

        <Card>
          <CardHeader><CardTitle class="text-base">Recent requests</CardTitle></CardHeader>
          <CardContent class="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!realtime?.recentRequests.length">
                  <TableCell colspan="7" class="text-center py-8 text-muted-foreground">No recent requests</TableCell>
                </TableRow>
                <TableRow v-for="(r, i) in realtime?.recentRequests" :key="i">
                  <TableCell class="text-xs text-muted-foreground whitespace-nowrap">{{ shortTime(r.occurredAt) }}</TableCell>
                  <TableCell class="text-xs font-mono">{{ r.method }}</TableCell>
                  <TableCell class="text-xs font-mono max-w-xs truncate">{{ r.path }}</TableCell>
                  <TableCell><Badge :class="statusColor(r.statusCode)">{{ r.statusCode }}</Badge></TableCell>
                  <TableCell class="text-xs">{{ r.durationMs }}ms</TableCell>
                  <TableCell class="text-xs">{{ classLabel(r.visitorClass) }}<span v-if="r.aiProvider" class="text-muted-foreground"> · {{ r.aiProvider }}</span></TableCell>
                  <TableCell class="text-xs font-mono text-muted-foreground">{{ r.ipTruncated || "-" }}<span v-if="r.country"> · {{ r.country }}</span></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- ============ ABUSE ============ -->
      <TabsContent value="abuse" class="space-y-4 mt-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Abuse events" :value="fmt(abuse?.summary.totalEvents)" :loading="loading.abuse" />
          <StatCard label="Active enforcement" :value="fmt(abuse?.summary.activeEnforcement)" :loading="loading.abuse" />
          <StatCard label="Categories" :value="fmt(abuse?.byCategory.length)" :loading="loading.abuse" />
          <StatCard label="Offending IPs" :value="fmt(abuse?.topOffenders.length)" :loading="loading.abuse" />
        </div>

        <ChartCard
          title="Abuse events over time"
          type="bar"
          :series="abuseTimelineChart.series"
          :options="abuseTimelineChart.options"
          :loading="loading.abuse"
          :height="240"
        />

        <Card>
          <CardHeader>
            <CardTitle class="text-base">Manual enforcement</CardTitle>
            <CardDescription>Block, allow-list or unblock a client IP address.</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex flex-wrap gap-2 items-end">
              <div class="flex-1 min-w-48">
                <label class="text-xs text-muted-foreground">IP address</label>
                <Input v-model="ruleForm.ip" placeholder="e.g. 203.0.113.7" />
              </div>
              <div class="flex-1 min-w-48">
                <label class="text-xs text-muted-foreground">Reason (optional)</label>
                <Input v-model="ruleForm.reason" placeholder="Reason" />
              </div>
              <Button :disabled="ruleForm.submitting" variant="destructive" @click="submitRule('block')">Block</Button>
              <Button :disabled="ruleForm.submitting" variant="outline" @click="submitRule('allow')">Allow-list</Button>
              <Button :disabled="ruleForm.submitting" variant="outline" @click="submitRule('unblock')">Unblock</Button>
            </div>
            <p v-if="ruleForm.message" class="text-sm mt-2 text-muted-foreground">{{ ruleForm.message }}</p>
          </CardContent>
        </Card>

        <div class="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle class="text-base">Top offending IPs</CardTitle></CardHeader>
            <CardContent class="p-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>IP</TableHead><TableHead>Events</TableHead><TableHead>Max score</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!abuse?.topOffenders.length">
                    <TableCell colspan="3" class="text-center py-6 text-muted-foreground">No abuse detected</TableCell>
                  </TableRow>
                  <TableRow v-for="o in abuse?.topOffenders" :key="o.actorKey">
                    <TableCell class="text-xs font-mono">{{ o.ipTruncated }}</TableCell>
                    <TableCell class="text-sm">{{ o.events }}</TableCell>
                    <TableCell class="text-sm">{{ o.maxScore }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle class="text-base">Active access rules</CardTitle></CardHeader>
            <CardContent class="p-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>IP</TableHead><TableHead>Rule</TableHead><TableHead>Reason</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!abuse?.accessRules.length">
                    <TableCell colspan="3" class="text-center py-6 text-muted-foreground">No manual rules</TableCell>
                  </TableRow>
                  <TableRow v-for="rule in abuse?.accessRules" :key="rule.id">
                    <TableCell class="text-xs font-mono">{{ rule.actorValue }}</TableCell>
                    <TableCell>
                      <Badge :class="rule.ruleType === 'BLOCK' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'">
                        {{ rule.ruleType }}
                      </Badge>
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground truncate max-w-40">{{ rule.reason || "-" }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle class="text-base">Recent abuse events</CardTitle></CardHeader>
          <CardContent class="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead><TableHead>Category</TableHead><TableHead>Severity</TableHead>
                  <TableHead>Score</TableHead><TableHead>IP</TableHead><TableHead>Path</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!abuse?.recentEvents.length">
                  <TableCell colspan="6" class="text-center py-6 text-muted-foreground">No abuse events</TableCell>
                </TableRow>
                <TableRow v-for="e in abuse?.recentEvents" :key="e.id">
                  <TableCell class="text-xs text-muted-foreground whitespace-nowrap">{{ shortTime(e.detectedAt) }}</TableCell>
                  <TableCell class="text-xs">{{ e.category }}</TableCell>
                  <TableCell><Badge :class="severityColor(e.severity)">{{ e.severity }}</Badge></TableCell>
                  <TableCell class="text-sm">{{ e.score }}</TableCell>
                  <TableCell class="text-xs font-mono">{{ e.ipTruncated || "-" }}</TableCell>
                  <TableCell class="text-xs font-mono max-w-xs truncate">{{ e.path || "-" }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- ============ AI & BOTS ============ -->
      <TabsContent value="ai" class="space-y-4 mt-4">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="AI requests" :value="fmt(ai?.summary.aiRequests)" :loading="loading.ai" />
          <StatCard label="AI share" :value="fmtPct(ai?.summary.aiShare ?? 0)" :loading="loading.ai" />
          <StatCard label="Total requests" :value="fmt(ai?.summary.totalRequests)" :loading="loading.ai" />
          <StatCard label="Spoofed" :value="fmt(ai?.summary.spoofedCount)" :loading="loading.ai" :value-color="(ai?.summary.spoofedCount ?? 0) > 0 ? 'text-red-600' : 'text-foreground'" />
          <StatCard label="Cloaked" :value="fmt(ai?.summary.cloakedCount)" :loading="loading.ai" :value-color="(ai?.summary.cloakedCount ?? 0) > 0 ? 'text-orange-600' : 'text-foreground'" />
          <StatCard label="robots.txt hits" :value="fmt(ai?.summary.robotsViolations)" :loading="loading.ai" />
        </div>

        <ChartCard
          title="AI vs total traffic"
          type="area"
          :series="aiTrendChart.series"
          :options="aiTrendChart.options"
          :loading="loading.ai"
          :height="280"
        />

        <div class="grid lg:grid-cols-3 gap-4">
          <ChartCard
            title="Visitor class share"
            type="donut"
            :series="donut(ai?.visitorClassSplit ?? [], classLabel).series"
            :options="donut(ai?.visitorClassSplit ?? [], classLabel).options"
            :loading="loading.ai"
            :height="260"
          />
          <ChartCard
            title="AI by provider"
            type="donut"
            :series="donut(ai?.byProvider ?? []).series"
            :options="donut(ai?.byProvider ?? []).options"
            :loading="loading.ai"
            :height="260"
          />
          <ChartCard
            title="AI by category"
            type="donut"
            :series="donut(ai?.byCategory ?? []).series"
            :options="donut(ai?.byCategory ?? []).options"
            :loading="loading.ai"
            :height="260"
          />
        </div>

        <div class="grid lg:grid-cols-2 gap-4">
          <ChartCard
            title="Top pages scraped by AI"
            type="bar"
            :series="hbar(ai?.topPages ?? []).series"
            :options="hbar(ai?.topPages ?? []).options"
            :loading="loading.ai"
            :height="300"
          />
          <Card>
            <CardHeader><CardTitle class="text-base">AI identity verification</CardTitle></CardHeader>
            <CardContent>
              <p v-if="!ai?.verification.length" class="text-sm text-muted-foreground py-4">
                No verification data yet.
              </p>
              <div v-else class="space-y-2">
                <div v-for="v in ai.verification" :key="v.label" class="flex justify-between text-sm">
                  <Badge :class="v.label === 'verified' ? 'bg-green-100 text-green-800' : v.label === 'spoofed' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'">
                    {{ v.label }}
                  </Badge>
                  <span class="text-muted-foreground font-mono">{{ fmt(v.requests) }}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <!-- ============ RATE LIMITING ============ -->
      <TabsContent value="ratelimit" class="space-y-4 mt-4">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="429 responses" :value="fmt(ratelimit?.summary.total429)" :loading="loading.ratelimit" />
          <StatCard label="Active throttles" :value="fmt(ratelimit?.summary.activeThrottles)" :loading="loading.ratelimit" />
          <StatCard label="Active blocks" :value="fmt(ratelimit?.summary.activeBlocks)" :loading="loading.ratelimit" />
        </div>

        <ChartCard
          title="429 responses over time"
          type="bar"
          :series="rlTimelineChart.series"
          :options="rlTimelineChart.options"
          :loading="loading.ratelimit"
          :height="240"
        />

        <Card>
          <CardHeader><CardTitle class="text-base">Active rate-limit configuration</CardTitle></CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p class="text-muted-foreground">Per IP / min</p><p class="font-medium">{{ ratelimit?.config.ipPerMin }}</p></div>
              <div><p class="text-muted-foreground">Auth / min</p><p class="font-medium">{{ ratelimit?.config.authPerMin }}</p></div>
              <div><p class="text-muted-foreground">Writes / min</p><p class="font-medium">{{ ratelimit?.config.writePerMin }}</p></div>
              <div><p class="text-muted-foreground">Uploads / 5 min</p><p class="font-medium">{{ ratelimit?.config.uploadPer5Min }}</p></div>
              <div><p class="text-muted-foreground">Per user / min</p><p class="font-medium">{{ ratelimit?.config.userPerMin }}</p></div>
              <div><p class="text-muted-foreground">Abusive factor</p><p class="font-medium">{{ ratelimit?.config.abusiveMultiplier }}x</p></div>
              <div><p class="text-muted-foreground">AI throttle factor</p><p class="font-medium">{{ ratelimit?.config.aiThrottleMultiplier }}x</p></div>
              <div><p class="text-muted-foreground">Counter store</p><p class="font-medium">{{ ratelimit?.config.storageDriver }}</p></div>
            </div>
          </CardContent>
        </Card>

        <div class="grid lg:grid-cols-2 gap-4">
          <ChartCard
            title="Top throttled routes"
            type="bar"
            :series="hbar(ratelimit?.topThrottledRoutes ?? []).series"
            :options="hbar(ratelimit?.topThrottledRoutes ?? []).options"
            :loading="loading.ratelimit"
            :height="300"
          />
          <ChartCard
            title="Top throttled IPs"
            type="bar"
            :series="hbar(ratelimit?.topThrottledActors ?? []).series"
            :options="hbar(ratelimit?.topThrottledActors ?? []).options"
            :loading="loading.ratelimit"
            :height="300"
          />
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
