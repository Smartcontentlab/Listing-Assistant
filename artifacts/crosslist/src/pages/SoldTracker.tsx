import { useState } from "react";
import { useListListings, useMarkListingSold } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle, Package, Printer, Truck, Calendar, DollarSign } from "lucide-react";
import { PlatformIcon } from "@/components/PlatformIcon";

interface ShipTask {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TASKS: ShipTask[] = [
  { id: "label", label: "Print shipping label", icon: Printer },
  { id: "pack", label: "Package item", icon: Package },
  { id: "ship", label: "Drop off / ship", icon: Truck },
];

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

export default function SoldTracker() {
  const { data: allListings, isLoading } = useListListings({ status: "sold" } as any);
  // Local task completion state (keyed by listingId + taskId)
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  function toggle(listingId: number, taskId: string) {
    const key = `${listingId}-${taskId}`;
    setCompleted((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isTaskDone(listingId: number, taskId: string) {
    return !!completed[`${listingId}-${taskId}`];
  }

  function allTasksDone(listingId: number) {
    return TASKS.every((t) => isTaskDone(listingId, t.id));
  }

  const soldListings = (allListings ?? []).filter((l: any) => l.status === "sold");

  // Sort: not fully shipped first, then by soldAt descending
  const sorted = [...soldListings].sort((a: any, b: any) => {
    const aDone = allTasksDone(a.id) ? 1 : 0;
    const bDone = allTasksDone(b.id) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return new Date(b.soldAt ?? b.updatedAt).getTime() - new Date(a.soldAt ?? a.updatedAt).getTime();
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Sold Tracker</h1>
        {[1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sold Tracker</h1>
          <p className="text-sm text-muted-foreground">Track label printing, packing, and shipping for every sale</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-violet-500" />
          <span className="text-muted-foreground">{soldListings.length} sold</span>
        </div>
      </div>

      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium">No sold items yet</p>
          <p className="text-sm text-muted-foreground">When you mark a listing as sold, it will appear here with shipping tasks.</p>
        </div>
      )}

      <div className="space-y-4">
        {sorted.map((listing: any) => {
          const done = allTasksDone(listing.id);
          const soldDate = listing.soldAt ?? listing.updatedAt;
          return (
            <Card key={listing.id} className={`transition-all ${done ? "opacity-60" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base truncate">{listing.title}</CardTitle>
                      {done && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">Shipped</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {daysAgo(soldDate)}
                      </span>
                      {listing.soldPrice && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <DollarSign className="h-3 w-3" />
                          ${Number(listing.soldPrice).toFixed(2)}
                        </span>
                      )}
                      {listing.platforms?.slice(0, 3).map((p: string) => (
                        <PlatformIcon key={p} name={p} size="sm" />
                      ))}
                    </div>
                  </div>
                  {listing.imageUrls?.[0] && (
                    <img src={listing.imageUrls[0]} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1 border-t border-border pt-3">
                  {TASKS.map((task) => {
                    const taskDone = isTaskDone(listing.id, task.id);
                    return (
                      <button
                        key={task.id}
                        onClick={() => toggle(listing.id, task.id)}
                        className="w-full flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        {taskDone ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                        )}
                        <task.icon className={`h-4 w-4 shrink-0 ${taskDone ? "text-emerald-500" : "text-muted-foreground"}`} />
                        <span className={`text-sm ${taskDone ? "line-through text-muted-foreground" : ""}`}>
                          {task.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
