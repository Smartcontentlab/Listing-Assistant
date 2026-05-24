import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useCreateListing, useRemoveBackground, getListListingsQueryKey, getGetListingStatsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus, X, Loader2, Sparkles, Check, ArrowRight, ChevronRight, TrendingUp, Edit3 } from "lucide-react";
import { PlatformIcon } from "@/components/PlatformIcon";

const CONDITIONS = [
  { value: "new_with_tags", label: "New with Tags" },
  { value: "new_without_tags", label: "New without Tags" },
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

const CATEGORIES = ["tops","bottoms","dresses","outerwear","shoes","bags","accessories","activewear","swimwear","other"];

const PLATFORMS = [
  { id: "poshmark", label: "Poshmark" },
  { id: "depop", label: "Depop" },
  { id: "mercari", label: "Mercari" },
];

type WizardStep = "photos" | "identify" | "price" | "descriptions" | "review";

interface ImageItem {
  originalBase64: string;
  processedBase64: string | null;
  filename: string;
  processing: boolean;
}

interface ListingData {
  title: string;
  brand: string;
  size: string;
  category: string;
  condition: string;
  price: string;
  originalPrice: string;
  notes: string;
  selectedPlatforms: string[];
  poshmarkDescription: string;
  depopDescription: string;
  mercariDescription: string;
  // Platform-specific fields
  poshmarkCategory: string;
  poshmarkStyle: string;
  poshmarkColor: string;
  depopCategory: string;
  depopColor: string;
  deparTags: string;
  mercariShipping: string;
  mercariColor: string;
}

export default function ListingWizard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>("photos");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [quickNote, setQuickNote] = useState("");

  // Identify confirm dialog
  const [identifyData, setIdentifyData] = useState<Partial<ListingData> | null>(null);
  const [showIdentifyDialog, setShowIdentifyDialog] = useState(false);

  // Price confirm dialog
  const [priceData, setPriceData] = useState<{ min: number; avg: number; max: number; suggested: number; items: any[] } | null>(null);
  const [showPriceDialog, setShowPriceDialog] = useState(false);

  const [listing, setListing] = useState<ListingData>({
    title: "", brand: "", size: "", category: "", condition: "good",
    price: "", originalPrice: "", notes: "",
    selectedPlatforms: ["poshmark", "depop", "mercari"],
    poshmarkDescription: "", depopDescription: "", mercariDescription: "",
    poshmarkCategory: "", poshmarkStyle: "", poshmarkColor: "",
    depopCategory: "", depopColor: "", depopTags: "",
    mercariShipping: "seller", mercariColor: "",
  } as any);

  const removeBg = useRemoveBackground();
  const createListing = useCreateListing();

  function update(field: keyof ListingData, value: string | string[]) {
    setListing((prev) => ({ ...prev, [field]: value }));
  }

  function togglePlatform(id: string) {
    setListing((prev) => ({
      ...prev,
      selectedPlatforms: prev.selectedPlatforms.includes(id)
        ? prev.selectedPlatforms.filter((p) => p !== id)
        : [...prev.selectedPlatforms, id],
    }));
  }

  async function handleImageFiles(files: FileList) {
    const newItems: ImageItem[] = Array.from(files).map((f) => ({
      originalBase64: "", processedBase64: null, filename: f.name, processing: true,
    }));
    const startIdx = images.length;
    setImages((prev) => [...prev, ...newItems]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        const idx = startIdx + i;
        setImages((prev) => { const n = [...prev]; if (n[idx]) n[idx].originalBase64 = base64; return n; });
        try {
          const result = await removeBg.mutateAsync({ data: { imageBase64: base64, filename: file.name } });
          setImages((prev) => { const n = [...prev]; if (n[idx]) { n[idx].processedBase64 = result.imageBase64; n[idx].processing = false; } return n; });
        } catch {
          setImages((prev) => { const n = [...prev]; if (n[idx]) { n[idx].processedBase64 = base64; n[idx].processing = false; } return n; });
        }
      };
      reader.readAsDataURL(file);
    }
  }

  async function runAiIdentify() {
    setAiLoading(true);
    try {
      const imagePayload = images.filter((im) => !im.processing).map((im) => {
        const b64 = im.processedBase64 ?? im.originalBase64;
        return b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`;
      });

      const resp = await fetch("/api/ai/quick-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: quickNote || " ", images: imagePayload }),
      });
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      setIdentifyData(data);
      setShowIdentifyDialog(true);
    } catch {
      toast({ title: "AI identification failed", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  function acceptIdentify() {
    if (!identifyData) return;
    setListing((prev) => ({
      ...prev,
      title: identifyData.title ?? prev.title,
      brand: identifyData.brand ?? prev.brand,
      size: identifyData.size ?? prev.size,
      category: identifyData.category ?? prev.category,
      condition: identifyData.condition ?? prev.condition,
      price: identifyData.price ?? prev.price,
      originalPrice: identifyData.originalPrice ?? prev.originalPrice,
      notes: identifyData.notes ?? prev.notes,
      poshmarkDescription: (identifyData as any).poshmarkDescription ?? prev.poshmarkDescription,
      depopDescription: (identifyData as any).depopDescription ?? prev.depopDescription,
      mercariDescription: (identifyData as any).mercariDescription ?? prev.mercariDescription,
    }));
    setShowIdentifyDialog(false);
    fetchPriceComps(identifyData.title ?? "");
  }

  async function fetchPriceComps(query: string) {
    setAiLoading(true);
    try {
      const resp = await fetch(`/api/sold-prices?query=${encodeURIComponent(query)}`);
      const data = await resp.json();
      setPriceData({ min: data.minPrice, avg: data.avgPrice, max: data.maxPrice, suggested: data.suggestedPrice, items: data.items?.slice(0, 3) ?? [] });
      setShowPriceDialog(true);
    } catch {
      setStep("descriptions");
    } finally {
      setAiLoading(false);
    }
  }

  function acceptPrice() {
    if (priceData) update("price", String(priceData.suggested));
    setShowPriceDialog(false);
    setStep("descriptions");
  }

  function enterPriceManually() {
    setShowPriceDialog(false);
    setStep("descriptions");
  }

  async function handleSubmit(status: "draft" | "published") {
    if (!listing.title || !listing.price) {
      toast({ title: "Title and price are required", variant: "destructive" });
      return;
    }
    const imageUrls = images.filter((im) => !im.processing)
      .map((im) => { const b = im.processedBase64 ?? im.originalBase64; return b.startsWith("data:") ? b : `data:image/png;base64,${b}`; });

    const created = await createListing.mutateAsync({
      data: {
        title: listing.title,
        description: listing.notes || undefined,
        price: Number(listing.price),
        originalPrice: listing.originalPrice ? Number(listing.originalPrice) : undefined,
        brand: listing.brand || undefined,
        size: listing.size || undefined,
        category: listing.category || undefined,
        condition: listing.condition as any,
        platforms: listing.selectedPlatforms,
        imageUrls,
        poshmarkDescription: listing.poshmarkDescription || undefined,
        depopDescription: listing.depopDescription || undefined,
        mercariDescription: listing.mercariDescription || undefined,
      },
    });
    queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetListingStatsQueryKey() });
    toast({ title: status === "draft" ? "Saved as draft" : "Listing published!", description: listing.title });
    setLocation(`/listings/${created.id}`);
  }

  const readyImages = images.filter((im) => !im.processing);

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header + Step Indicator */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Listing</h1>
          <div className="flex items-center gap-1.5 mt-3">
            {(["photos","identify","price","descriptions","review"] as WizardStep[]).map((s, i, arr) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${step === s ? "bg-primary" : i < arr.indexOf(step) ? "bg-primary/40" : "bg-muted-foreground/20"}`} />
                {i < arr.length - 1 && <div className="h-px w-4 bg-border" />}
              </div>
            ))}
            <span className="ml-2 text-xs text-muted-foreground capitalize">{step}</span>
          </div>
        </div>

        {/* STEP: PHOTOS */}
        {step === "photos" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Upload Photos</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg border bg-muted overflow-hidden group">
                      {img.processing ? (
                        <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                      ) : (
                        <img src={`data:image/png;base64,${img.processedBase64 ?? img.originalBase64}`} alt="" className="h-full w-full object-cover" />
                      )}
                      <button onClick={() => setImages((p) => p.filter((_, i) => i !== idx))} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <X className="h-3 w-3" />
                      </button>
                      {img.processedBase64 && !img.processing && (
                        <div className="absolute bottom-1 left-1 text-[9px] bg-emerald-500 text-white px-1 rounded">BG removed</div>
                      )}
                    </div>
                  ))}
                  <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center hover:border-primary/50 hover:bg-muted/50 transition-colors">
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-1">Add</span>
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleImageFiles(e.target.files)} />
                <p className="text-xs text-muted-foreground">Backgrounds removed automatically. Add multiple angles for best AI results.</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-4 space-y-2">
                <Label className="text-sm">Optional: any quick notes?</Label>
                <Textarea value={quickNote} onChange={(e) => setQuickNote(e.target.value)} placeholder={`e.g. "size M, I paid $8, has a small scuff on the left toe"`} rows={2} className="text-xs" />
                <p className="text-xs text-muted-foreground">The AI will combine your photos + notes for best accuracy.</p>
              </CardContent>
            </Card>

            <Button className="w-full gap-2" onClick={() => { setStep("identify"); runAiIdentify(); }} disabled={readyImages.length === 0 || aiLoading}>
              {aiLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing…</> : <><Sparkles className="h-4 w-4" />Identify Item with AI<ArrowRight className="h-4 w-4 ml-auto" /></>}
            </Button>
            <Button variant="ghost" className="w-full text-xs" onClick={() => setStep("descriptions")}>Skip AI — fill in manually</Button>
          </div>
        )}

        {/* STEP: IDENTIFY (manual editing while dialog is shown / after) */}
        {(step === "identify" || step === "price" || step === "descriptions" || step === "review") && (
          <div className="space-y-4">
            {step === "descriptions" && (
              <>
                {/* Item details edit */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Item Details</CardTitle>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setStep("photos")}>
                        <Edit3 className="h-3 w-3" />Edit Photos
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Title *</Label>
                      <Input value={listing.title} onChange={(e) => update("title", e.target.value)} placeholder="Listing title" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Brand</Label><Input value={listing.brand} onChange={(e) => update("brand", e.target.value)} placeholder="Brand" /></div>
                      <div className="space-y-1"><Label className="text-xs">Size</Label><Input value={listing.size} onChange={(e) => update("size", e.target.value)} placeholder="Size" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Category</Label>
                        <Select value={listing.category} onValueChange={(v) => update("category", v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Category" /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Condition</Label>
                        <Select value={listing.condition} onValueChange={(v) => update("condition", v)}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Your Price *</Label><Input type="number" value={listing.price} onChange={(e) => update("price", e.target.value)} placeholder="0.00" /></div>
                      <div className="space-y-1"><Label className="text-xs">Original Price</Label><Input type="number" value={listing.originalPrice} onChange={(e) => update("originalPrice", e.target.value)} placeholder="0.00" /></div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes / Flaws</Label>
                      <Textarea value={listing.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className="text-xs" />
                    </div>
                  </CardContent>
                </Card>

                {/* Platforms */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Post To</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      {PLATFORMS.map((p) => (
                        <button key={p.id} onClick={() => togglePlatform(p.id)} className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-lg border transition-all ${listing.selectedPlatforms.includes(p.id) ? "border-primary bg-primary/5" : "border-border opacity-50"}`}>
                          <PlatformIcon name={p.id} size="md" />
                          <span className="text-xs font-medium">{p.label}</span>
                          {listing.selectedPlatforms.includes(p.id) && <Check className="h-3 w-3 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Platform descriptions */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Platform Descriptions</CardTitle>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={runAiIdentify} disabled={aiLoading}>
                        {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Regenerate
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {listing.selectedPlatforms.includes("poshmark") && (
                      <div className="space-y-1">
                        <Label className="flex items-center gap-1.5 text-xs font-semibold"><PlatformIcon name="poshmark" />Poshmark</Label>
                        <Textarea value={listing.poshmarkDescription} onChange={(e) => update("poshmarkDescription", e.target.value)} rows={4} className="text-xs" placeholder="AI will fill this…" />
                      </div>
                    )}
                    {listing.selectedPlatforms.includes("depop") && (
                      <div className="space-y-1">
                        <Label className="flex items-center gap-1.5 text-xs font-semibold"><PlatformIcon name="depop" />Depop</Label>
                        <Textarea value={listing.depopDescription} onChange={(e) => update("depopDescription", e.target.value)} rows={4} className="text-xs" placeholder="AI will fill this…" />
                      </div>
                    )}
                    {listing.selectedPlatforms.includes("mercari") && (
                      <div className="space-y-1">
                        <Label className="flex items-center gap-1.5 text-xs font-semibold"><PlatformIcon name="mercari" />Mercari</Label>
                        <Textarea value={listing.mercariDescription} onChange={(e) => update("mercariDescription", e.target.value)} rows={4} className="text-xs" placeholder="AI will fill this…" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleSubmit("draft")} disabled={createListing.isPending}>Save Draft</Button>
                  <Button className="flex-1 gap-2" onClick={() => handleSubmit("published")} disabled={createListing.isPending}>
                    {createListing.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Publish to {listing.selectedPlatforms.length} Platform{listing.selectedPlatforms.length !== 1 ? "s" : ""}<ChevronRight className="h-4 w-4" /></>}
                  </Button>
                </div>
              </>
            )}

            {(step === "identify" || step === "price") && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center space-y-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                  <p className="text-sm font-medium">{step === "identify" ? "AI is analyzing your photos…" : "Looking up recent sold prices…"}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DIALOG: AI Item Identification */}
      <Dialog open={showIdentifyDialog} onOpenChange={setShowIdentifyDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Identified Your Item
            </DialogTitle>
          </DialogHeader>
          {identifyData && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="font-semibold text-base">{identifyData.title}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {identifyData.brand && <><span className="text-muted-foreground">Brand</span><span className="font-medium">{identifyData.brand}</span></>}
                  {identifyData.size && <><span className="text-muted-foreground">Size</span><span className="font-medium">{identifyData.size}</span></>}
                  {identifyData.category && <><span className="text-muted-foreground">Category</span><span className="font-medium capitalize">{identifyData.category}</span></>}
                  {identifyData.condition && <><span className="text-muted-foreground">Condition</span><span className="font-medium capitalize">{identifyData.condition?.replace(/_/g, " ")}</span></>}
                </div>
                {(identifyData as any).notes && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-1">{(identifyData as any).notes}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Does this look right? Accept to continue, or edit manually on the next screen.</p>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:space-x-0">
            <Button variant="outline" className="flex-1" onClick={() => { setShowIdentifyDialog(false); setStep("descriptions"); }}>
              No — Edit Manually
            </Button>
            <Button className="flex-1 gap-1.5" onClick={acceptIdentify}>
              <Check className="h-3.5 w-3.5" />Yes, Looks Right
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Price Comps */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Recent Sold Comps
            </DialogTitle>
          </DialogHeader>
          {priceData && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-lg font-bold">${priceData.min}</p>
                  <p className="text-[10px] text-muted-foreground">Low</p>
                </div>
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                  <p className="text-lg font-bold text-primary">${priceData.avg}</p>
                  <p className="text-[10px] text-muted-foreground">Average</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-lg font-bold">${priceData.max}</p>
                  <p className="text-[10px] text-muted-foreground">High</p>
                </div>
              </div>

              {priceData.items.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">3 Most Recent Sales</p>
                  {priceData.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground truncate flex-1 mr-2">{item.title?.slice(0, 35)}</span>
                      <span className="text-muted-foreground mr-2 shrink-0">{item.platform}</span>
                      <span className="font-semibold shrink-0">${item.price}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                <p className="text-xs text-muted-foreground">Suggested price (10% below avg)</p>
                <p className="text-2xl font-black text-primary">${priceData.suggested}</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:space-x-0">
            <Button variant="outline" className="flex-1" onClick={enterPriceManually}>
              No — I'll Enter Price
            </Button>
            <Button className="flex-1 gap-1.5" onClick={acceptPrice}>
              <Check className="h-3.5 w-3.5" />Yes, Use ${priceData?.suggested}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
