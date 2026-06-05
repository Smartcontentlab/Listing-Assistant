import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useGetListing,
  useUpdateListing,
  usePublishListing,
  useMarkListingSold,
  useGenerateDescription,
  getGetListingQueryKey,
  getListListingsQueryKey,
  getGetListingStatsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Package, Loader2, Sparkles, Send, CheckCircle2,
  Circle, Printer, Truck, ExternalLink, AlertTriangle
} from "lucide-react";
import { PlatformIcon } from "@/components/PlatformIcon";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const CONDITIONS = [
  { value: "new_with_tags", label: "New with Tags" },
  { value: "new_without_tags", label: "New without Tags" },
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

const PLATFORMS_DEF = [
  { id: "poshmark", label: "Poshmark" },
  { id: "depop", label: "Depop" },
  { id: "mercari", label: "Mercari" },
];

const SHIP_TASKS = [
  { id: "label", label: "Print shipping label", icon: Printer },
  { id: "pack", label: "Package item", icon: Package },
  { id: "ship", label: "Drop off / ship", icon: Truck },
];

const PLATFORM_FALLBACK_URLS: Record<string, string> = {
  poshmark: "https://poshmark.com/closet/my",
  depop: "https://www.depop.com/selling/",
  mercari: "https://www.mercari.com/mypage/listings/",
};

function useLocalStorage<T>(key: string, initial: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch { return initial; }
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

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
    published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    sold: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    archived: "bg-zinc-100 text-zinc-500",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? ""}`}>{status}</span>;
}

interface Props { params: { id: string } }

export default function ListingDetail({ params }: Props) {
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: listing, isLoading } = useGetListing(id, {
    query: { enabled: !!id, queryKey: getGetListingQueryKey(id) },
  });

  const updateListing = useUpdateListing();
  const publishListing = usePublishListing();
  const markSold = useMarkListingSold();
  const generateDesc = useGenerateDescription();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("good");
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [poshmarkDesc, setPoshmarkDesc] = useState("");
  const [depopDesc, setDepopDesc] = useState("");
  const [mercariDesc, setMercariDesc] = useState("");
  const [soldDialog, setSoldDialog] = useState(false);
  const [soldPrice, setSoldPrice] = useState("");
  const [publishDialog, setPublishDialog] = useState(false);
  const [selectedPublishPlatforms, setSelectedPublishPlatforms] = useState<string[]>(["poshmark", "depop", "mercari"]);

  const [shipTasks, setShipTasks] = useLocalStorage<Record<string, boolean>>("crosslist_ship_tasks", {});

  function toggleTask(taskId: string) {
    setShipTasks((prev) => ({ ...prev, [`${id}-${taskId}`]: !prev[`${id}-${taskId}`] }));
  }

  function startEdit() {
    if (!listing) return;
    setTitle(listing.title);
    setPrice(String(listing.price));
    setCondition(listing.condition);
    setBrand(listing.brand ?? "");
    setSize(listing.size ?? "");
    setPoshmarkDesc(listing.poshmarkDescription ?? "");
    setDepopDesc(listing.depopDescription ?? "");
    setMercariDesc(listing.mercariDescription ?? "");
    setEditing(true);
  }

  async function handleSave() {
    await updateListing.mutateAsync({
      id,
      data: {
        title, price: Number(price), condition: condition as any,
        brand: brand || undefined, size: size || undefined,
        poshmarkDescription: poshmarkDesc || undefined,
        depopDescription: depopDesc || undefined,
        mercariDescription: mercariDesc || undefined,
      },
    });
    queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() });
    toast({ title: "Listing updated" });
    setEditing(false);
  }

  async function handlePublish() {
    await publishListing.mutateAsync({ id, data: { platforms: selectedPublishPlatforms as any } });
    queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetListingStatsQueryKey() });
    toast({ title: "Published!", description: `Posted to ${selectedPublishPlatforms.join(", ")}` });
    setPublishDialog(false);
  }

  async function handleMarkSold() {
    await markSold.mutateAsync({ id, data: { soldPrice: Number(soldPrice) } });
    queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetListingStatsQueryKey() });
    toast({ title: "Marked as sold!" });
    setSoldDialog(false);
  }

  async function handleGenerateDescriptions() {
    if (!listing) return;
    const result = await generateDesc.mutateAsync({
      data: {
        title: editing ? title : listing.title,
        brand: editing ? brand : (listing.brand ?? undefined),
        size: editing ? size : (listing.size ?? undefined),
        condition: editing ? condition : listing.condition,
        category: listing.category ?? undefined,
        platforms: ["poshmark", "depop", "mercari"],
      },
    });
    if (editing) {
      setPoshmarkDesc(result.poshmark ?? "");
      setDepopDesc(result.depop ?? "");
      setMercariDesc(result.mercari ?? "");
    } else {
      await updateListing.mutateAsync({
        id,
        data: {
          poshmarkDescription: result.poshmark ?? undefined,
          depopDescription: result.depop ?? undefined,
          mercariDescription: result.mercari ?? undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(id) });
    }
    toast({ title: "Descriptions generated!" });
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-medium">Listing not found</p>
          <Button variant="link" onClick={() => setLocation("/listings")}>Back to Listings</Button>
        </div>
      </div>
    );
  }

  const platformUrls: Record<string, string> = listing.platformUrls
    ? JSON.parse(listing.platformUrls as string)
    : {};

  const tasksDone = SHIP_TASKS.filter((t) => shipTasks[`${id}-${t.id}`]).length;
  const allShipped = tasksDone === SHIP_TASKS.length;

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/listings")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{listing.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {statusBadge(listing.status)}
              <span className="text-sm text-muted-foreground">${Number(listing.price).toFixed(2)}</span>
              {listing.status === "sold" && listing.soldPrice && (
                <span className="text-sm font-semibold text-emerald-600">Sold: ${Number(listing.soldPrice).toFixed(2)}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {listing.status !== "sold" && (
              <Button data-testid="button-mark-sold" variant="outline" size="sm" onClick={() => setSoldDialog(true)}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Mark Sold
              </Button>
            )}
            {listing.status === "draft" && (
              <Button data-testid="button-publish" size="sm" onClick={() => setPublishDialog(true)}>
                <Send className="h-3.5 w-3.5 mr-1" />
                Publish
              </Button>
            )}
            {!editing ? (
              <Button data-testid="button-edit" variant="outline" size="sm" onClick={startEdit}>Edit</Button>
            ) : (
              <Button data-testid="button-save" size="sm" onClick={handleSave} disabled={updateListing.isPending}>
                {updateListing.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
            )}
          </div>
        </div>

        {/* Images */}
        {listing.imageUrls?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {listing.imageUrls.map((url, i) => (
              <div key={i} className="h-24 w-24 rounded border bg-muted overflow-hidden shrink-0">
                <img src={url} alt={`Image ${i}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Sold: shipping checklist + platform links */}
        {listing.status === "sold" && (
          <Card className="border-violet-200 dark:border-violet-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-violet-500" />
                Sold — Ship & Remove
                {allShipped && (
                  <span className="ml-auto text-[10px] font-normal bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Shipped ✓</span>
                )}
                {!allShipped && (
                  <span className="ml-auto text-[10px] font-normal text-amber-600">{tasksDone}/{SHIP_TASKS.length} done</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Shipping checklist */}
              <div className="space-y-1">
                {SHIP_TASKS.map((task) => {
                  const done = shipTasks[`${id}-${task.id}`];
                  return (
                    <button
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      className="w-full flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      {done
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        : <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />}
                      <task.icon className={`h-4 w-4 shrink-0 ${done ? "text-emerald-500" : "text-muted-foreground"}`} />
                      <span className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{task.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Platform links */}
              {(listing.platforms ?? []).length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    Remove from platforms
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(listing.platforms ?? []).map((platform) => {
                      const url = platformUrls[platform] ?? PLATFORM_FALLBACK_URLS[platform] ?? `https://${platform}.com`;
                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 hover:bg-amber-100 transition-colors text-sm font-medium text-amber-800 dark:text-amber-300"
                        >
                          <PlatformIcon name={platform} size="sm" />
                          <span className="capitalize">{platform}</span>
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-amber-600 mt-2">
                    Click to open your listing — delete it there to avoid double-selling.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Platform links for published items */}
        {listing.status === "published" && (listing.platforms ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(listing.platforms ?? []).map((platform) => {
              const url = platformUrls[platform] ?? PLATFORM_FALLBACK_URLS[platform] ?? `https://${platform}.com`;
              return (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <PlatformIcon name={platform} size="sm" />
                  <span className="capitalize">View on {platform}</span>
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </a>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <>
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input data-testid="input-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Brand</Label>
                      <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Size</Label>
                      <Input value={size} onChange={(e) => setSize(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Price</Label>
                      <Input data-testid="input-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Condition</Label>
                      <Select value={condition} onValueChange={setCondition}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2 text-sm">
                  {[
                    { label: "Price", value: `$${Number(listing.price).toFixed(2)}` },
                    { label: "Brand", value: listing.brand },
                    { label: "Size", value: listing.size },
                    { label: "Category", value: listing.category },
                    { label: "Condition", value: CONDITIONS.find((c) => c.value === listing.condition)?.label },
                    { label: "Platforms", value: listing.platforms?.join(", ") || "—" },
                    { label: "Created", value: new Date(listing.createdAt).toLocaleDateString() },
                  ].filter((r) => r.value).map((row) => (
                    <div key={row.label} className="flex gap-3">
                      <span className="text-muted-foreground w-20 shrink-0">{row.label}</span>
                      <span className="font-medium">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Descriptions */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Platform Descriptions</CardTitle>
                <Button
                  data-testid="button-generate-descriptions"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleGenerateDescriptions}
                  disabled={generateDesc.isPending}
                >
                  {generateDesc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Generate
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: "poshmark", label: "Poshmark", icon: <span className="h-4 w-4 rounded bg-pink-600 text-white flex items-center justify-center text-[9px] font-bold">P</span>, value: editing ? poshmarkDesc : listing.poshmarkDescription, set: setPoshmarkDesc },
                { id: "depop", label: "Depop", icon: <PlatformIcon name="depop" />, value: editing ? depopDesc : listing.depopDescription, set: setDepopDesc },
                { id: "mercari", label: "Mercari", icon: <PlatformIcon name="mercari" />, value: editing ? mercariDesc : listing.mercariDescription, set: setMercariDesc },
              ].map((desc) => (
                <div key={desc.id} className="space-y-1">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold">{desc.icon}{desc.label}</Label>
                  <Textarea
                    data-testid={`textarea-${desc.id}-desc`}
                    value={desc.value ?? ""}
                    onChange={(e) => editing && desc.set(e.target.value)}
                    readOnly={!editing}
                    placeholder="No description yet — click Generate"
                    rows={3}
                    className="text-xs"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mark Sold Dialog */}
      <Dialog open={soldDialog} onOpenChange={setSoldDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as sold</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Sale price</Label>
            <Input data-testid="input-sold-price" type="number" placeholder="0.00" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSoldDialog(false)}>Cancel</Button>
            <Button onClick={handleMarkSold} disabled={!soldPrice || markSold.isPending}>
              {markSold.isPending ? "Saving..." : "Mark Sold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={publishDialog} onOpenChange={setPublishDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Publish to platforms</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {PLATFORMS_DEF.map((p) => (
              <button
                key={p.id}
                data-testid={`button-publish-platform-${p.id}`}
                onClick={() => setSelectedPublishPlatforms((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg border text-sm ${selectedPublishPlatforms.includes(p.id) ? "border-primary bg-primary/5" : "border-border"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialog(false)}>Cancel</Button>
            <Button onClick={handlePublish} disabled={publishListing.isPending || selectedPublishPlatforms.length === 0}>
              {publishListing.isPending ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
