import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Share2, Users, Heart, RefreshCw, Repeat2, Zap,
  Clock, CheckCircle2, XCircle, Loader2, Play, Info, Shield
} from "lucide-react";

type FeatureKey = "share_closet" | "follow_back" | "share_back" | "community_follow" | "daily_relist";

interface FeatureStatus {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

interface AutomationLog {
  id: number;
  feature: string;
  action: string;
  status: "ok" | "error";
  details: string | null;
  count: number | null;
  createdAt: string;
}

const FEATURES: { key: FeatureKey; label: string; description: string; icon: React.ElementType; schedule: string; platform: string; highlight?: boolean }[] = [
  {
    key: "sales_detection",
    label: "Sales Detection",
    description: "Checks your Poshmark, Depop, and Mercari sold orders every 15–25 minutes. When a sale is found, CrossList automatically marks the item sold in your inventory, queues shipping tasks, and alerts you to delist from other platforms.",
    icon: Zap,
    schedule: "Every 15–25 min · 24/7",
    platform: "All Platforms",
    highlight: true,
  },
  {
    key: "share_closet",
    label: "Share Closet",
    description: "Shares every item in your Poshmark closet to your followers, keeping listings at the top of search results. Runs 3–5× per day with gaps between each share.",
    icon: Share2,
    schedule: "Every 2.5–4.5 hrs · 8am–10pm",
    platform: "Poshmark",
  },
  {
    key: "follow_back",
    label: "Auto Follow-Back",
    description: "Detects new followers and follows them back automatically. Builds community and increases your items' exposure in their feeds.",
    icon: Users,
    schedule: "Every 45–90 min · 9am–9pm",
    platform: "Poshmark",
  },
  {
    key: "share_back",
    label: "Auto Share-Back",
    description: "When someone shares one of your listings, CrossList automatically shares one of theirs back. A key Poshmark community norm that drives reciprocal exposure.",
    icon: Heart,
    schedule: "Every 30–60 min · 9am–9pm",
    platform: "Poshmark",
  },
  {
    key: "community_follow",
    label: "Community Following",
    description: "Discovers and follows new sellers in your category. Grows your audience over time and puts your closet in front of fresh eyes.",
    icon: Repeat2,
    schedule: "2× daily · 10am–8pm",
    platform: "Poshmark",
  },
  {
    key: "daily_relist",
    label: "Daily Relist",
    description: "Once per day, re-shares your entire closet to give all listings a fresh bump in search — the Poshmark equivalent of relisting.",
    icon: RefreshCw,
    schedule: "Once daily · 9am–11am",
    platform: "Poshmark",
  },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "soon";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `in ${m}m`;
  return `in ${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function Automation() {
  const qc = useQueryClient();

  const { data: status = {} as Record<FeatureKey, FeatureStatus> } = useQuery<Record<FeatureKey, FeatureStatus>>({
    queryKey: ["/api/automation/activity/status"],
    queryFn: () => fetch("/api/automation/activity/status").then((r) => r.json()),
    refetchInterval: 15000,
  });

  const { data: logs = [] } = useQuery<AutomationLog[]>({
    queryKey: ["/api/automation/activity/logs"],
    queryFn: () => fetch("/api/automation/activity/logs?limit=30").then((r) => r.json()),
    refetchInterval: 15000,
  });

  const toggle = useMutation({
    mutationFn: async ({ feature, enable }: { feature: FeatureKey; enable: boolean }) => {
      const endpoint = enable ? "enable" : "disable";
      const resp = await fetch(`/api/automation/activity/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });
      return resp.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/automation/activity/status"] }),
  });

  const runNow = useMutation({
    mutationFn: async (feature: FeatureKey) => {
      const resp = await fetch("/api/automation/activity/run-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });
      return resp.json();
    },
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["/api/automation/activity/status"] });
        qc.invalidateQueries({ queryKey: ["/api/automation/activity/logs"] });
      }, 2000);
    },
  });

  const anyEnabled = FEATURES.some((f) => status[f.key]?.enabled);

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Poshmark Automation</h1>
          <p className="text-sm text-muted-foreground">
            Runs activity throughout the day with randomized timing to stay under the radar
          </p>
        </div>
        {anyEnabled && (
          <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1.5 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </Badge>
        )}
      </div>

      {/* Safety note */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <Shield className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Built for stealth</p>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
            Every action uses randomized delays between 5–45 seconds. Sessions are spaced hours apart. Daily follow limits stay well below Poshmark's thresholds (~50/day). The automation only runs between your chosen active hours so your account looks like a real person using the app.
          </p>
        </div>
      </div>

      {/* Feature toggles */}
      <div className="space-y-3">
        {FEATURES.map((feature) => {
          const s = status[feature.key];
          const isEnabled = s?.enabled ?? false;
          const isRunning = s?.running ?? false;

          return (
            <Card key={feature.key} className={isEnabled ? "border-primary/20 bg-primary/2" : feature.highlight ? "border-violet-200 dark:border-violet-800" : ""}>
              <CardContent className="pt-5">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isEnabled ? "bg-primary/10" : "bg-muted"}`}>
                    <feature.icon className={`h-4 w-4 ${isEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{feature.label}</p>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">{feature.platform}</Badge>
                      {isRunning && (
                        <Badge className="text-[9px] px-1.5 bg-blue-100 text-blue-700 border-0 gap-1">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Running
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> {feature.schedule}
                      </span>
                      {s?.lastRunAt && (
                        <span className="text-[10px] text-muted-foreground">
                          Last: {timeAgo(s.lastRunAt)}
                        </span>
                      )}
                      {s?.nextRunAt && isEnabled && (
                        <span className="text-[10px] text-muted-foreground">
                          Next: {timeUntil(s.nextRunAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => runNow.mutate(feature.key)}
                      disabled={isRunning || runNow.isPending}
                      title="Run now"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => toggle.mutate({ feature: feature.key, enable: checked })}
                      disabled={toggle.isPending}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activity log */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Activity Log</h2>
        <Card>
          <CardContent className="pt-4">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">Enable a feature above — it'll run automatically and log results here.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {logs.map((log, i) => (
                  <div key={log.id} className={`flex items-start gap-3 py-2.5 ${i < logs.length - 1 ? "border-b border-border/50" : ""}`}>
                    {log.status === "ok" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{log.action}</span>
                        {log.count != null && log.count > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{log.count}</Badge>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-[11px] text-muted-foreground truncate">{log.details}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
