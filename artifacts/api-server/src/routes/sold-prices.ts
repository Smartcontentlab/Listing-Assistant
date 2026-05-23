import { Router } from "express";
import { GetSoldPricesQueryParams } from "@workspace/api-zod";

const router = Router();

async function fetchEbaySoldPrices(query: string, condition?: string) {
  const appId = process.env.EBAY_APP_ID;
  if (!appId) return null;

  const conditionIds: Record<string, string> = {
    new_with_tags: "1000",
    new_without_tags: "1500",
    excellent: "2500",
    good: "3000",
    fair: "5000",
  };

  const params = new URLSearchParams({
    "OPERATION-NAME": "findCompletedItems",
    "SERVICE-VERSION": "1.0.0",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "keywords": query,
    "itemFilter(0).name": "SoldItemsOnly",
    "itemFilter(0).value": "true",
    "paginationInput.entriesPerPage": "10",
    "sortOrder": "EndTimeSoonest",
  });

  if (condition && conditionIds[condition]) {
    params.append("itemFilter(1).name", "Condition");
    params.append("itemFilter(1).value", conditionIds[condition]);
  }

  const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params.toString()}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;

  const data = await resp.json();
  const searchResult = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0];
  const rawItems: any[] = searchResult?.item ?? [];

  if (!rawItems.length) return null;

  const items = rawItems.slice(0, 3).map((item: any) => {
    const price = parseFloat(item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.["__value__"] ?? "0");
    const endTime = item.listingInfo?.[0]?.endTime?.[0] ?? "";
    const soldDate = endTime ? endTime.split("T")[0] : new Date().toISOString().split("T")[0];
    const condLabel = item.condition?.[0]?.conditionDisplayName?.[0] ?? "Good";
    return {
      title: (item.title?.[0] ?? query).slice(0, 80),
      price: Math.round(price),
      platform: "eBay",
      soldDate,
      condition: condLabel,
      url: item.viewItemURL?.[0] ?? undefined,
    };
  });

  const prices = rawItems.map((i: any) =>
    parseFloat(i.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.["__value__"] ?? "0")
  ).filter(Boolean);

  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const minPrice = Math.round(Math.min(...prices));
  const maxPrice = Math.round(Math.max(...prices));
  const suggestedPrice = Math.round(avgPrice * 0.9);

  return {
    query,
    avgPrice,
    minPrice,
    maxPrice,
    sampleCount: prices.length,
    suggestedPrice,
    items,
    source: "ebay",
  };
}

const PLATFORMS = ["Poshmark", "Depop", "Mercari", "eBay"];
const CONDITIONS = ["Excellent", "Good", "Like New", "Fair"];

function generateEstimatedData(query: string, category?: string, condition?: string) {
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    hash = (hash * 31 + query.charCodeAt(i)) & 0xffffffff;
  }
  const absHash = Math.abs(hash);

  let basePrice = 20;
  const lq = query.toLowerCase();
  if (lq.match(/gucci|prada|louis|chanel|hermes|balenciaga/)) basePrice = 400;
  else if (lq.match(/nike|adidas|jordan|supreme|off.white/)) basePrice = 80;
  else if (lq.match(/zara|h&m|shein|forever|target/)) basePrice = 15;
  else if (lq.match(/levi|ralph|polo|tommy|calvin/)) basePrice = 40;
  else if (lq.match(/vintage|y2k|90s|80s/)) basePrice = 35;
  else if (lq.match(/shoes|boots|sneakers/)) basePrice = 55;
  else if (lq.match(/bag|purse|handbag/)) basePrice = 70;
  else basePrice = 25 + (absHash % 40);

  const spread = basePrice * 0.4;
  const minPrice = Math.max(3, Math.round(basePrice - spread));
  const maxPrice = Math.round(basePrice + spread);
  const avgPrice = Math.round((minPrice + maxPrice) / 2);
  const suggestedPrice = Math.round(avgPrice * 0.9);
  const count = 3;

  const items = [];
  for (let i = 0; i < count; i++) {
    const price = minPrice + Math.round((absHash * (i + 1) * 7919) % (maxPrice - minPrice));
    const platform = PLATFORMS[((absHash * (i + 3)) % PLATFORMS.length)];
    const itemCondition = condition || CONDITIONS[((absHash * (i + 5)) % CONDITIONS.length)];
    const daysAgo = 1 + ((absHash * (i + 7)) % 30);
    const soldDate = new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0];
    items.push({ title: query, price, platform, soldDate, condition: itemCondition });
  }
  items.sort((a, b) => b.soldDate.localeCompare(a.soldDate));

  return { query, avgPrice, minPrice, maxPrice, sampleCount: count, suggestedPrice, items, source: "estimated" };
}

// GET /sold-prices
router.get("/sold-prices", async (req, res) => {
  const parsed = GetSoldPricesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Missing required query parameter: query" });
  }

  const { query, category, condition } = parsed.data;

  try {
    const ebayData = await fetchEbaySoldPrices(query, condition);
    if (ebayData) return res.json(ebayData);
  } catch (err) {
    // fall through to estimated data
  }

  return res.json(generateEstimatedData(query, category, condition));
});

export default router;
