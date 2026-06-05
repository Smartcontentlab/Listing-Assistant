import { useState, useEffect } from "react";
import { useListListings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle, Package, Printer, Truck, Calendar, DollarSign, AlertTriangle, X } from "lucide-react";
import { PlatformIcon } from "@/components/PlatformIcon";

const SHIP_TASKS = [
  { id: "label", label: "Print shipping label", icon: Printer },
  { id: "pack", label: "Package item", icon: Package },
  { id: "ship", label: "Drop off / ship", icon: Truck },
];

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function formatMonthDay(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function useLocalStorage<T>(key: string, initial: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });

  const setter = (val: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof val === "function" ? (val as (p: T) => T)(prev) : val;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return [state, setter];
}

export default function SoldTracker() {
  const { data: allListings, isLoading } = useListListings({} as any);
  const [shipTasks, setShipTasks] = useLocalStorage<Record<string, boolean>>("crosslist_ship_tasks", {});
  const [delisted, setDelisted] = useLocalStorage<Record<string, string[]>>("crosslist_delisted", {});

  const soldListings = (allListings ?? []).filter((l: any) => l.status === "sold");

  const sorted = [...soldListings].sort((a: any, b: any) => {
    const aShipped = SHIP_TASKS.every((t) => shipTasks[`${a.id}-${t.id}`]) ? 1 : 0;
    const bShipped = SHIP_TASKS.every((t) => shipTasks[`${b.id}-${t.id}`]) ? 1 : 0;
    if (aShipped !== bShipped) return aShipped - bShipped;
    return new Date(b.soldAt ?? b.updatedAt).getTime() - new Date(a.soldAt ?? a.updatedAt).getTime();
  });

  function toggleTask(listingId: number, taskId: string) {
    setShipTasks((prev) => ({ ...prev, [`${listingId}-${taskId}`]: !prev[`${listingId}-${taskId}`] }));
  }

  function markDelisted(listingId: number, platform: string) {
    setDelisted((prev) => ({ ...prev, [listingId]: [...(prev[listingId] ?? []), platform] }));
  }

  function isDelisted(listingId: number, platform: string) {
    return delisted[listingId]?.includes(platform) ?? false;
  }

  function allShipped(listingId: number) {
    return SHIP_TASKS.every((t) => shipTasks[`${listingId}-${t.id}`]);
  }

  // Group sold items by date for the calendar summary
  const byDate: Record<string, number> = {};
  soldListings.forEach((l: any) => {
    const key = formatMonthDay(l.soldAt ?? l.updatedAt);
    byDate[key] = (byDate[key] ?? 0) + 1;
  });
  const calendarEntries = Object.entries(byDate).slice(0, 7);

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Sold Tracker</h1>
        {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sold Tracker</h1>
          <p className="text-sm text-muted-foreground">Ship items and remove listings from other platforms</p>
        </div>
        <Badge variant="outline" className="text-violet-600 border-violet-200">
          {soldListings.length} sold
        </Badge>
      </div>

      {/* Calendar summary */}
      {calendarEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              Sales Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {calendarEntries.map(([date, count]) => (
                <div key={date} className="flex flex-col items-center shrink-0 min-w-[52px]">
                  <div
                    className="w-10 rounded-lg flex items-end justify-center text-xs font-bold text-primary-foreground"
                    style={{
                      height: `${Math.max(24, count * 20)}px`,
                      background: "hsl(var(--primary))",
                      opacity: 0.6 + count * 0.1,
                    }}
                  >
                    {count}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 text-center">{date}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-base font-bold text-emerald-600">
                  ${soldListings.reduce((sum: number, l: any) => sum + (Number(l.soldPrice) || Number(l.price) || 0), 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Items Shipped</p>
                <p className="text-base font-bold">
                  {soldListings.filter((l: any) => allShipped(l.id)).length}/{soldListings.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending Delist</p>
                <p className="text-base font-bold text-amber-600">
                  {soldListings.filter((l: any) => {
                    const platforms = l.platforms ?? [];
                    return platforms.some((p: string) => !isDelisted(l.id, p));
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium">No sold items yet</p>
          <p className="text-sm text-muted-foreground">Sold items show up here with shipping tasks and delisting reminders.</p>
        </div>
      )}

      <div className="space-y-4">
        {sorted.map((listing: any) => {
          const shipped = allShipped(listing.id);
          const soldDate = listing.soldAt ?? listing.updatedAt;
          const remainingPlatforms = (listing.platforms ?? []).filter((p: string) => !isDelisted(listing.id, p));
          const allDelisted = remainingPlatforms.length === 0;
          const tasksDone = SHIP_TASKS.filter((t) => shipTasks[`${listing.id}-${t.id}`]).length;

          return (
            <Card key={listing.id} className={`transition-all ${shipped && allDelisted ? "opacity-55" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base truncate">{listing.title}</CardTitle>
                      {shipped && allDelisted && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">Done ✓</Badge>}
                      {!shipped && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">{tasksDone}/{SHIP_TASKS.length} tasks</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />{daysAgo(soldDate)} · {formatMonthDay(soldDate)}
                      </span>
                      {listing.soldPrice && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <DollarSign className="h-3 w-3" />${Number(listing.soldPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  {listing.imageUrls?.[0] && (
                    <img src={listing.imageUrls[0]} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                {/* Shipping tasks */}
                <div className="border-t border-border pt-3 space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Shipping Checklist</p>
                  {SHIP_TASKS.map((task) => {
                    const done = shipTasks[`${listing.id}-${task.id}`];
                    return (
                      <button key={task.id} onClick={() => toggleTask(listing.id, task.id)} className="w-full flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors text-left">
                        {done ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />}
                        <task.icon className={`h-4 w-4 shrink-0 ${done ? "text-emerald-500" : "text-muted-foreground"}`} />
                        <span className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{task.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Platform delisting */}
                {(listing.platforms ?? []).length > 0 && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Remove from other platforms</p>
                      {!allDelisted && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                    </div>
                    <div className="space-y-1.5">
                      {(listing.platforms ?? []).map((platform: string) => {
                        const done = isDelisted(listing.id, platform);
                        return (
                          <div key={platform} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${done ? "border-border bg-muted/30 opacity-50" : "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"}`}>
                            <div className="flex items-center gap-2">
                              {done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                              <PlatformIcon name={platform} size="sm" />
                              <span className="text-sm font-medium capitalize">{platform}</span>
                            </div>
                            {done ? (
                              <span className="text-xs text-muted-foreground">Removed</span>
                            ) : (
                              <button
                                onClick={() => markDelisted(listing.id, platform)}
                                className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 transition-colors"
                              >
                                <X className="h-3 w-3" />
                                Mark Removed
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {!allDelisted && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        ⚠️ Go to each platform above and manually delete these listings to avoid double-selling.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
