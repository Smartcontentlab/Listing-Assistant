import { useState, useRef } from "react";
import { Camera, Upload, Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Signal = "buy" | "pass" | null;

interface ScanResult {
  signal: Signal;
  item: string;
  reason: string;
  avgPrice?: number;
  recentSales?: number;
}

export default function Scanner() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function analyzeImage(base64: string) {
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch("/api/ai/scan-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      if (!resp.ok) throw new Error("Scan failed");
      const data = await resp.json();
      setResult(data);
    } catch {
      setResult({ signal: null, item: "Unknown", reason: "Could not analyze image. Try again." });
    } finally {
      setLoading(false);
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImage(dataUrl);
      const base64 = dataUrl.split(",")[1];
      analyzeImage(base64);
    };
    reader.readAsDataURL(file);
  }

  function reset() {
    setImage(null);
    setResult(null);
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Thrift Scanner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Snap a photo of any item — get an instant buy or pass signal
          </p>
        </div>

        {!image && !loading && (
          <div className="space-y-3">
            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center gap-3 hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <Camera className="h-12 w-12 text-primary/60" />
              <span className="text-sm font-medium text-primary">Take a Photo</span>
            </button>
            <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Upload from Gallery
            </Button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        )}

        {image && (
          <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
            <img src={image} alt="scanned item" className="w-full h-full object-cover" />
            {loading && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-10 w-10 text-white animate-spin" />
                <p className="text-white text-sm font-medium">Analyzing item…</p>
              </div>
            )}
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            {/* Big signal */}
            <Card className={`border-2 ${result.signal === "buy" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : result.signal === "pass" ? "border-red-500 bg-red-50 dark:bg-red-950/30" : "border-border"}`}>
              <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3">
                {result.signal === "buy" ? (
                  <CheckCircle className="h-16 w-16 text-emerald-500" />
                ) : result.signal === "pass" ? (
                  <XCircle className="h-16 w-16 text-red-500" />
                ) : null}
                <div className="text-center">
                  <p className={`text-3xl font-black ${result.signal === "buy" ? "text-emerald-600" : result.signal === "pass" ? "text-red-600" : "text-muted-foreground"}`}>
                    {result.signal === "buy" ? "BUY IT" : result.signal === "pass" ? "PASS" : "UNCLEAR"}
                  </p>
                  <p className="text-sm font-semibold mt-1">{result.item}</p>
                </div>
              </CardContent>
            </Card>

            {/* Reasoning */}
            <Card>
              <CardContent className="pt-4 pb-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Why</p>
                <p className="text-sm">{result.reason}</p>
                {result.avgPrice && (
                  <div className="flex items-center justify-between pt-1 border-t border-border mt-2">
                    <span className="text-xs text-muted-foreground">Avg sold price</span>
                    <span className="text-sm font-bold">${result.avgPrice}</span>
                  </div>
                )}
                {result.recentSales && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Recent sales found</span>
                    <span className="text-sm font-bold">{result.recentSales}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button variant="outline" className="w-full gap-2" onClick={reset}>
              <RefreshCw className="h-4 w-4" />
              Scan Another Item
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
