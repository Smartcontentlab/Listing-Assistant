import { useGetListingStats, useListListings } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, TrendingUp, Package, DollarSign, Tag, Clock } from "lucide-react";

function conditionLabel(c: string) {
  return { new_with_tags: "New w/ Tags", new_without_tags: "New", excellent: "Excellent", good: "Good", fair: "Fair" }[c] ?? c;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
    published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    sold: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    archived: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  };
  return map[status] ?? "";
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetListingStats();
  const { data: listings, isLoading: listingsLoading } = useListListings();

  const statCards = stats
    ? [
        { label: "Total Listings", value: stats.total, icon: Package, color: "text-primary" },
        { label: "Published", value: stats.published, icon: TrendingUp, color: "text-emerald-500" },
        { label: "Sold", value: stats.sold, icon: Tag, color: "text-violet-500" },
        { label: "Revenue", value: `$${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-amber-500" },
      ]
    : [];

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your reselling command center</p>
        </div>
        <Link href="/listings/new">
          <Button data-testid="button-new-listing" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New Listing
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))
          : statCards.map((s) => (
              <Card key={s.label} data-testid={`card-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-2xl font-bold">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                    </div>
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentActivity?.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No listings yet. Create your first one!</div>
            ) : (
              <div className="space-y-3">
                {stats?.recentActivity?.map((item) => (
                  <Link key={item.id} href={`/listings/${item.id}`}>
                    <div
                      data-testid={`card-activity-${item.id}`}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {item.imageUrls?.[0] ? (
                          <img src={item.imageUrls[0]} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">${Number(item.price).toFixed(2)}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(item.status)}`}>{item.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Inventory Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Draft", count: stats?.draft ?? 0, color: "bg-zinc-400" },
                  { label: "Published", count: stats?.published ?? 0, color: "bg-emerald-500" },
                  { label: "Sold", count: stats?.sold ?? 0, color: "bg-violet-500" },
                  { label: "Archived", count: stats?.archived ?? 0, color: "bg-zinc-300" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16">{s.label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${s.color} transition-all duration-700`}
                        style={{ width: stats?.total ? `${(s.count / stats.total) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="text-xs font-medium w-6 text-right">{s.count}</span>
                  </div>
                ))}
                {stats?.avgPrice != null && stats.avgPrice > 0 && (
                  <div className="pt-2 border-t mt-2">
                    <p className="text-xs text-muted-foreground">Avg listing price: <span className="font-semibold text-foreground">${stats.avgPrice.toFixed(2)}</span></p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
