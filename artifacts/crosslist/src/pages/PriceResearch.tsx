import { useState } from "react";
import { useGetSoldPrices, getGetSoldPricesQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TrendingUp, Search, DollarSign } from "lucide-react";

const CONDITIONS = [
  { value: "", label: "Any Condition" },
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

export default function PriceResearch() {
  const [query, setQuery] = useState("");
  const [condition, setCondition] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [activeQuery, setActiveQuery] = useState("");

  const { data, isLoading, refetch } = useGetSoldPrices(
    { query: activeQuery, condition: condition || undefined },
    { query: { enabled: submitted && !!activeQuery, queryKey: getGetSoldPricesQueryKey({ query: activeQuery, condition: condition || undefined }) } }
  );

  function handleSearch() {
    if (!query.trim()) return;
    setActiveQuery(query);
    setSubmitted(true);
    setTimeout(() => refetch(), 50);
  }

  const platformColors: Record<string, string> = {
    Poshmark: "text-pink-500",
    Depop: "text-red-500",
    Mercari: "text-red-600",
    eBay: "text-blue-500",
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Price Research</h1>
        <p className="text-sm text-muted-foreground">Look up recent sold prices across resale platforms</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="input-price-search"
                placeholder='e.g. "Nike Air Force 1" or "Levi 501 jeans"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger data-testid="select-condition-filter" className="sm:w-44">
                <SelectValue placeholder="Condition" />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => <SelectItem key={c.value || "any"} value={c.value || "any"}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button data-testid="button-search" onClick={handleSearch} className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-8 w-20 mb-2" /><Skeleton className="h-4 w-16" /></CardContent></Card>
          ))}
        </div>
      )}

      {data && !isLoading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Average Price", value: `$${data.avgPrice}`, color: "text-primary", sub: `${data.sampleCount} comps` },
              { label: "Suggested", value: `$${data.suggestedPrice}`, color: "text-emerald-500", sub: "price to sell fast" },
              { label: "Lowest", value: `$${data.minPrice}`, color: "text-muted-foreground", sub: "floor" },
              { label: "Highest", value: `$${data.maxPrice}`, color: "text-muted-foreground", sub: "ceiling" },
            ].map((s) => (
              <Card key={s.label} data-testid={`card-price-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardContent className="pt-5">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">{s.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Recent Sold Comps — "{data.query}"</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.items.map((item, i) => (
                  <div
                    key={i}
                    data-testid={`row-sold-${i}`}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-medium ${platformColors[item.platform] ?? "text-muted-foreground"}`}>{item.platform}</span>
                        {item.condition && <span className="text-xs text-muted-foreground">· {item.condition}</span>}
                        <span className="text-xs text-muted-foreground">· {item.soldDate}</span>
                      </div>
                    </div>
                    <span className="font-semibold text-sm ml-4">${item.price}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!submitted && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Search for an item to see sold prices</p>
          <p className="text-sm text-muted-foreground">Type a brand, style, or item name and hit Search</p>
        </div>
      )}
    </div>
  );
}
