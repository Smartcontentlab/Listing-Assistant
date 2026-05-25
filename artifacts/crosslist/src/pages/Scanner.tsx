import { useState, useRef } from "react";
import { Camera, Upload, Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Signal = "buy" | "pass" | null;

interface ScanResult {
  signal: Signal;
  item: string;
  avgPrice?: number;
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
      setResult({ signal: data.signal, item: data.item, avgPrice: data.avgPrice });
    } catch {
      setResult({ signal: null, item: "Could not analyze — try again" });
    } finally {
      setLoading(false);
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImage(dataUrl);
      analyzeImage(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  }

  function reset() {
    setImage(null);
    setResult(null);
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background min-h-full">
      <div className="w-full max-w-xs space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Thrift Scanner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Snap an item while shopping — instant buy or pass
          </p>
        </div>

        {/* Image / Camera */}
        {!image && !loading && (
          <div className="space-y-3">
            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full aspect-square rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center gap-3 hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <Camera className="h-14 w-14 text-primary/50" />
              <span className="text-base font-semibold text-primary">Take a Photo</span>
            </button>
            <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Upload from Gallery
            </Button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        )}

        {image && (
          <div className="relative rounded-2xl overflow-hidden aspect-square">
            <img src={image} alt="item" className="w-full h-full object-cover" />
            {loading && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-10 w-10 text-white animate-spin" />
                <p className="text-white text-sm font-medium">Checking resale value…</p>
              </div>
            )}
          </div>
        )}

        {/* BIG Signal */}
        {result && !loading && (
          <div className="space-y-4">
            <div className={`rounded-2xl p-8 flex flex-col items-center gap-3 ${result.signal === "buy" ? "bg-emerald-500" : result.signal === "pass" ? "bg-red-500" : "bg-muted"}`}>
              {result.signal === "buy" ? (
                <CheckCircle className="h-16 w-16 text-white" />
              ) : result.signal === "pass" ? (
                <XCircle className="h-16 w-16 text-white" />
              ) : null}
              <p className="text-4xl font-black text-white tracking-tight">
                {result.signal === "buy" ? "BUY IT" : result.signal === "pass" ? "PASS" : "UNCLEAR"}
              </p>
              {result.item && <p className="text-sm text-white/80 text-center">{result.item}</p>}
              {result.avgPrice && (
                <div className="mt-1 bg-white/20 rounded-xl px-5 py-2 text-center">
                  <p className="text-xs text-white/70 uppercase tracking-wider">Est. listing price</p>
                  <p className="text-2xl font-black text-white">${result.avgPrice}</p>
                </div>
              )}
            </div>

            <Button variant="outline" className="w-full gap-2" onClick={reset}>
              <RefreshCw className="h-4 w-4" /> Scan Another
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
