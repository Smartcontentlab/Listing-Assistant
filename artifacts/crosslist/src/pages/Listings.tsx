import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListListings,
  useDeleteListing,
  useMarkListingSold,
  getListListingsQueryKey,
  getGetListingStatsQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  PlusCircle, Trash2, Eye, Package, Search, CheckCircle2
} from "lucide-react";
import { PlatformIcon } from "@/components/PlatformIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300" },
    published: { label: "Published", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
    sold: { label: "Sold", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300" },
    archived: { label: "Archived", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500" },
  };
  const s = map[status] ?? { label: status, cls: "" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>;
}

function PlatformTag({ name }: { name: string }) {
  return <PlatformIcon name={name} size="sm" />;
}

function conditionLabel(c: string) {
  return { new_with_tags: "NWT", new_without_tags: "NWOT", excellent: "Excellent", good: "Good", fair: "Fair" }[c] ?? c;
}

export default function Listings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [soldId, setSoldId] = useState<number | null>(null);
  const [soldPrice, setSoldPrice] = useState("");

  const { data: listings, isLoading } = useListListings(
    statusFilter !== "all" ? { status: statusFilter as any } : {}
  );
  const deleteListing = useDeleteListing();
  const markSold = useMarkListingSold();

  const filtered = (listings ?? []).filter(
    (l) => !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.brand?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete() {
    if (deleteId == null) return;
    await deleteListing.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetListingStatsQueryKey() });
    toast({ title: "Listing deleted" });
    setDeleteId(null);
  }

  async function handleMarkSold() {
    if (soldId == null || !soldPrice) return;
    await markSold.mutateAsync({ id: soldId, data: { soldPrice: Number(soldPrice) } });
    queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetListingStatsQueryKey() });
    toast({ title: "Marked as sold!", description: `Sold for $${soldPrice}` });
    setSoldId(null);
    setSoldPrice("");
  }

  return (
    <div className="flex-1 p-6 space-y-4 overflow-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listings</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} items</p>
        </div>
        <Link href="/listings/new">
          <Button data-testid="button-new-listing" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New Listing
          </Button>
        </Link>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search"
            placeholder="Search listings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-status-filter" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
              <Skeleton className="h-12 w-12 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No listings found</p>
          <p className="text-sm text-muted-foreground mb-4">
            {search ? "Try a different search term" : "Create your first listing to get started"}
          </p>
          <Link href="/listings/new">
            <Button>Create Listing</Button>
          </Link>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Item</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Condition</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Price</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Platforms</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((listing, i) => (
                <tr
                  key={listing.id}
                  data-testid={`row-listing-${listing.id}`}
                  className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {listing.imageUrls?.[0] ? (
                          <img src={listing.imageUrls[0]} alt={listing.title} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[140px]">{listing.title}</p>
                        {listing.brand && <p className="text-xs text-muted-foreground">{listing.brand}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">{conditionLabel(listing.condition)}</span>
                  </td>
                  <td className="p-3 font-medium">${Number(listing.price).toFixed(2)}</td>
                  <td className="p-3 hidden sm:table-cell">{statusBadge(listing.status)}</td>
                  <td className="p-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1">
                      {listing.platforms?.map((p) => <PlatformTag key={p} name={p} />)}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 justify-end">
                      {listing.status === "published" && (
                        <Button
                          data-testid={`button-mark-sold-${listing.id}`}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setSoldId(listing.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-violet-500" />
                        </Button>
                      )}
                      <Link href={`/listings/${listing.id}`}>
                        <Button data-testid={`button-view-${listing.id}`} variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        data-testid={`button-delete-${listing.id}`}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(listing.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete listing?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={soldId != null} onOpenChange={(o) => !o && setSoldId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as sold</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sold-price">Sale price</Label>
            <Input
              id="sold-price"
              data-testid="input-sold-price"
              type="number"
              placeholder="0.00"
              value={soldPrice}
              onChange={(e) => setSoldPrice(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSoldId(null)}>Cancel</Button>
            <Button onClick={handleMarkSold} disabled={!soldPrice || markSold.isPending}>
              {markSold.isPending ? "Saving..." : "Mark Sold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
