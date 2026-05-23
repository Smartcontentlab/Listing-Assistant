import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useCreateListing,
  useRemoveBackground,
  useGenerateDescription,
  useGetSoldPrices,
  getListListingsQueryKey,
  getGetListingStatsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Wand2, ImagePlus, X, Loader2, Sparkles, TrendingUp, Check, Zap } from "lucide-react";
import { PlatformIcon } from "@/components/PlatformIcon";

const PLATFORMS = [
  { id: "poshmark", label: "Poshmark" },
  { id: "depop", label: "Depop" },
  { id: "mercari", label: "Mercari" },
];

const CONDITIONS = [
  { value: "new_with_tags", label: "New with Tags" },
  { value: "new_without_tags", label: "New without Tags" },
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

const CATEGORIES = [
  "Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags", "Accessories", "Activewear", "Swimwear", "Other"
];

interface ImageItem {
  originalBase64: string;
  processedBase64: string | null;
  filename: string;
  processing: boolean;
}

export default function NewListing() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("good");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["poshmark", "depop", "mercari"]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [descriptions, setDescriptions] = useState<{ poshmark: string; depop: string; mercari: string }>({
    poshmark: "", depop: "", mercari: "",
  });
  const [showPriceResearch, setShowPriceResearch] = useState(false);
  const [priceQuery, setPriceQuery] = useState("");

  // AI Quick Fill state
  const [quickFillText, setQuickFillText] = useState("");
  const [quickFillLoading, setQuickFillLoading] = useState(false);

  const createListing = useCreateListing();
  const removeBg = useRemoveBackground();
  const generateDesc = useGenerateDescription();
  const { data: soldPrices, isLoading: soldLoading, refetch: fetchSoldPrices } = useGetSoldPrices(
    { query: priceQuery || title },
    { query: { enabled: false, queryKey: ["sold-prices", priceQuery || title] } }
  );

  function togglePlatform(id: string) {
    setSelectedPlatforms((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  async function handleImageFiles(files: FileList) {
    const newItems: ImageItem[] = Array.from(files).map((f) => ({
      originalBase64: "",
      processedBase64: null,
      filename: f.name,
      processing: true,
    }));
    setImages((prev) => [...prev, ...newItems]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        const idx = images.length + i;
        setImages((prev) => {
          const next = [...prev];
          if (next[idx]) next[idx].originalBase64 = base64;
          return next;
        });

        try {
          const result = await removeBg.mutateAsync({ data: { imageBase64: base64, filename: file.name } });
          setImages((prev) => {
            const next = [...prev];
            if (next[idx]) {
              next[idx].processedBase64 = result.imageBase64;
              next[idx].processing = false;
            }
            return next;
          });
        } catch {
          setImages((prev) => {
            const next = [...prev];
            if (next[idx]) {
              next[idx].processedBase64 = base64;
              next[idx].processing = false;
            }
            return next;
          });
        }
      };
      reader.readAsDataURL(file);
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleQuickFill() {
    const hasImages = images.some((im) => im.processedBase64 || im.originalBase64);
    if (!quickFillText.trim() && !hasImages) {
      toast({ title: "Add a description or upload photos first", variant: "destructive" });
      return;
    }
    setQuickFillLoading(true);
    try {
      // Collect processed (or original) base64 images
      const imagePayload = images
        .filter((im) => !im.processing)
        .map((im) => {
          const b64 = im.processedBase64 ?? im.originalBase64;
          return b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`;
        });

      const resp = await fetch("/api/ai/quick-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: quickFillText || " ",
          images: imagePayload,
        }),
      });
      if (!resp.ok) throw new Error("AI request failed");
      const data = await resp.json();

      if (data.title) setTitle(data.title);
      if (data.brand) setBrand(data.brand);
      if (data.size) setSize(data.size);
      if (data.category) setCategory(data.category);
      if (data.condition) setCondition(data.condition);
      if (data.price) setPrice(data.price);
      if (data.originalPrice) setOriginalPrice(data.originalPrice);
      if (data.notes) setNotes(data.notes);
      setDescriptions({
        poshmark: data.poshmarkDescription ?? "",
        depop: data.depopDescription ?? "",
        mercari: data.mercariDescription ?? "",
      });

      const visionMsg = data._usedVision
        ? "Photos analyzed for flaws and details."
        : "Review the details and make any tweaks.";
      toast({ title: "Form filled!", description: visionMsg });
    } catch (err) {
      toast({ title: "Quick Fill failed", description: "Try again or fill in manually.", variant: "destructive" });
    } finally {
      setQuickFillLoading(false);
    }
  }

  async function handleGenerateDescriptions() {
    if (!title) { toast({ title: "Add a title first", variant: "destructive" }); return; }
    const result = await generateDesc.mutateAsync({
      data: { title, brand, size, category, condition, notes, platforms: selectedPlatforms as any },
    });
    setDescriptions({
      poshmark: result.poshmark ?? "",
      depop: result.depop ?? "",
      mercari: result.mercari ?? "",
    });
    toast({ title: "Descriptions generated!" });
  }

  async function handleSubmit(status: "draft" | "published") {
    if (!title || !price || !condition) {
      toast({ title: "Fill in required fields", variant: "destructive" });
      return;
    }

    const imageUrls = images
      .filter((im) => im.processedBase64 ?? im.originalBase64)
      .map((im) => `data:image/png;base64,${im.processedBase64 ?? im.originalBase64}`);

    const created = await createListing.mutateAsync({
      data: {
        title,
        description: notes || undefined,
        price: Number(price),
        originalPrice: originalPrice ? Number(originalPrice) : undefined,
        brand: brand || undefined,
        size: size || undefined,
        category: category || undefined,
        condition: condition as any,
        platforms: selectedPlatforms,
        imageUrls,
        poshmarkDescription: descriptions.poshmark || undefined,
        depopDescription: descriptions.depop || undefined,
        mercariDescription: descriptions.mercari || undefined,
      },
    });

    queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetListingStatsQueryKey() });

    toast({ title: status === "draft" ? "Saved as draft" : "Listing created!", description: title });
    setLocation(`/listings/${created.id}`);
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Listing</h1>
          <p className="text-sm text-muted-foreground">Fill in the details and post to all platforms at once</p>
        </div>

        {/* AI Quick Fill Banner */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-sm font-semibold">AI Quick Fill</p>
                  <p className="text-xs text-muted-foreground">
                    {images.filter((im) => !im.processing).length > 0
                      ? `${images.filter((im) => !im.processing).length} photo${images.filter((im) => !im.processing).length > 1 ? "s" : ""} uploaded — AI will scan them for brand, condition, and any flaws. Add a note below or leave blank.`
                      : "Describe your item in plain text — AI fills the entire form and writes all 3 platform descriptions at once. Or upload photos above first for even better results."}
                  </p>
                </div>
                <Textarea
                  value={quickFillText}
                  onChange={(e) => setQuickFillText(e.target.value)}
                  placeholder={
                    images.filter((im) => !im.processing).length > 0
                      ? `Optional: add any extra notes (e.g. "size M, I paid $8, has a small pen mark on sleeve")`
                      : `e.g. "Levi's 501 jeans size 32x30, excellent condition, some light fading, I paid $15 at a thrift store"`
                  }
                  rows={2}
                  className="text-xs bg-background"
                />
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleQuickFill}
                  disabled={quickFillLoading}
                >
                  {quickFillLoading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {images.filter(im => !im.processing).length > 0 ? "Analyzing photos…" : "Filling form…"}</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /> {images.filter(im => !im.processing).length > 0 ? "Analyze Photos + Fill Form" : "Fill Entire Form with AI"}</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-5">
            {/* Images */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {images.map((img, idx) => (
                    <div key={idx} data-testid={`img-listing-${idx}`} className="relative aspect-square rounded border bg-muted overflow-hidden group">
                      {img.processing ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <img
                          src={`data:image/png;base64,${img.processedBase64 ?? img.originalBase64}`}
                          alt={`Image ${idx}`}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {img.processedBase64 && !img.processing && (
                        <div className="absolute bottom-1 left-1 text-[9px] bg-emerald-500 text-white px-1 rounded">BG removed</div>
                      )}
                    </div>
                  ))}
                  <button
                    data-testid="button-add-images"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-1">Add</span>
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleImageFiles(e.target.files)}
                />
                <p className="text-xs text-muted-foreground">Backgrounds are removed automatically on upload</p>
              </CardContent>
            </Card>

            {/* Item Details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Item Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="title">Title *</Label>
                  <Input id="title" data-testid="input-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Vintage Levi's 501 Jeans" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="brand">Brand</Label>
                    <Input id="brand" data-testid="input-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Levi's" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="size">Size</Label>
                    <Input id="size" data-testid="input-size" value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. M or 32W" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Condition *</Label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger data-testid="select-condition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea id="notes" data-testid="input-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Measurements, flaws, etc." rows={2} />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Pricing</CardTitle>
                  <Button
                    data-testid="button-price-research"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => { setShowPriceResearch(!showPriceResearch); setPriceQuery(title); }}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    Research
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="price">Your Price *</Label>
                    <Input id="price" data-testid="input-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="orig-price">Original Price</Label>
                    <Input id="orig-price" data-testid="input-original-price" type="number" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} placeholder="0.00" />
                  </div>
                </div>

                {showPriceResearch && (
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <div className="flex gap-2">
                      <Input
                        data-testid="input-price-query"
                        value={priceQuery}
                        onChange={(e) => setPriceQuery(e.target.value)}
                        placeholder="Search sold prices..."
                        className="text-xs h-8"
                      />
                      <Button
                        data-testid="button-search-prices"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => fetchSoldPrices()}
                        disabled={soldLoading}
                      >
                        {soldLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
                      </Button>
                    </div>
                    {soldPrices && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            {(soldPrices as any).source === "ebay" ? "eBay sold comps" : "Estimated comps"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{soldPrices.sampleCount} sales</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-background rounded p-1.5">
                            <p className="text-xs font-bold">${soldPrices.minPrice}</p>
                            <p className="text-[10px] text-muted-foreground">Low</p>
                          </div>
                          <div className="bg-primary/10 rounded p-1.5 border border-primary/20">
                            <p className="text-xs font-bold text-primary">${soldPrices.avgPrice}</p>
                            <p className="text-[10px] text-muted-foreground">Average</p>
                          </div>
                          <div className="bg-background rounded p-1.5">
                            <p className="text-xs font-bold">${soldPrices.maxPrice}</p>
                            <p className="text-[10px] text-muted-foreground">High</p>
                          </div>
                        </div>
                        {/* Recent sold items */}
                        <div className="space-y-1">
                          {soldPrices.items.slice(0, 3).map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-border/50 last:border-0">
                              <span className="text-muted-foreground truncate flex-1 mr-2">{item.title}</span>
                              <span className="shrink-0 text-muted-foreground mr-2">{item.platform} · {item.soldDate}</span>
                              <span className="shrink-0 font-semibold">${item.price}</span>
                            </div>
                          ))}
                        </div>
                        <Button
                          data-testid="button-use-suggested-price"
                          variant="outline"
                          size="sm"
                          className="w-full h-7 text-xs"
                          onClick={() => setPrice(String(soldPrices.suggestedPrice))}
                        >
                          Use suggested: ${soldPrices.suggestedPrice}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            {/* Platforms */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Platforms</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      data-testid={`button-platform-${p.id}`}
                      onClick={() => togglePlatform(p.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                        selectedPlatforms.includes(p.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded-sm border flex items-center justify-center ${selectedPlatforms.includes(p.id) ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                        {selectedPlatforms.includes(p.id) && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <PlatformIcon name={p.id} />
                      <span className="text-sm font-medium">{p.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Platform Descriptions */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">Platform Descriptions</CardTitle>
                    <p className="text-[10px] text-muted-foreground mt-0.5">AI Quick Fill writes these automatically, or generate separately below</p>
                  </div>
                  <Button
                    data-testid="button-generate-descriptions"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 shrink-0"
                    onClick={handleGenerateDescriptions}
                    disabled={generateDesc.isPending}
                  >
                    {generateDesc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Generate
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPlatforms.includes("poshmark") && (
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold">
                      <PlatformIcon name="poshmark" />
                      Poshmark
                    </Label>
                    <Textarea
                      data-testid="textarea-poshmark-desc"
                      value={descriptions.poshmark}
                      onChange={(e) => setDescriptions((d) => ({ ...d, poshmark: e.target.value }))}
                      placeholder="Use AI Quick Fill above, or click Generate…"
                      rows={4}
                      className="text-xs"
                    />
                  </div>
                )}
                {selectedPlatforms.includes("depop") && (
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold">
                      <PlatformIcon name="depop" />
                      Depop
                    </Label>
                    <Textarea
                      data-testid="textarea-depop-desc"
                      value={descriptions.depop}
                      onChange={(e) => setDescriptions((d) => ({ ...d, depop: e.target.value }))}
                      placeholder="Use AI Quick Fill above, or click Generate…"
                      rows={4}
                      className="text-xs"
                    />
                  </div>
                )}
                {selectedPlatforms.includes("mercari") && (
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold">
                      <PlatformIcon name="mercari" />
                      Mercari
                    </Label>
                    <Textarea
                      data-testid="textarea-mercari-desc"
                      value={descriptions.mercari}
                      onChange={(e) => setDescriptions((d) => ({ ...d, mercari: e.target.value }))}
                      placeholder="Use AI Quick Fill above, or click Generate…"
                      rows={4}
                      className="text-xs"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                data-testid="button-save-draft"
                variant="outline"
                className="flex-1"
                onClick={() => handleSubmit("draft")}
                disabled={createListing.isPending}
              >
                Save Draft
              </Button>
              <Button
                data-testid="button-create-listing"
                className="flex-1"
                onClick={() => handleSubmit("published")}
                disabled={createListing.isPending}
              >
                {createListing.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
