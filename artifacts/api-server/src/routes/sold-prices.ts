import { Router } from "express";
import { GetSoldPricesQueryParams } from "@workspace/api-zod";

const router = Router();

const CATEGORIES: Record<string, string[]> = {
  tops: ["t-shirt", "blouse", "shirt", "sweater", "hoodie", "cardigan", "tank top", "flannel"],
  bottoms: ["jeans", "pants", "shorts", "skirt", "leggings", "trousers"],
  dresses: ["dress", "gown", "romper", "jumpsuit"],
  outerwear: ["jacket", "coat", "blazer", "vest", "parka", "windbreaker"],
  shoes: ["sneakers", "boots", "heels", "sandals", "loafers", "flats"],
  bags: ["bag", "purse", "backpack", "tote", "clutch", "handbag"],
  accessories: ["belt", "scarf", "hat", "sunglasses", "jewelry", "watch"],
};

const PLATFORMS = ["Poshmark", "Depop", "Mercari", "eBay"];
const CONDITIONS = ["Excellent", "Good", "Like New", "Fair"];

function generateFakeSoldData(query: string, category?: string, condition?: string) {
  // Build a deterministic-ish price range based on query hash
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    hash = (hash * 31 + query.charCodeAt(i)) & 0xffffffff;
  }
  const absHash = Math.abs(hash);

  // Price range varies by apparent category
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

  // Spread: +-30-50%
  const spread = basePrice * 0.4;
  const minPrice = Math.max(3, Math.round(basePrice - spread));
  const maxPrice = Math.round(basePrice + spread);
  const avgPrice = Math.round((minPrice + maxPrice) / 2);
  const suggestedPrice = Math.round(avgPrice * 0.9); // slightly below average to sell faster

  const count = 8 + (absHash % 12); // 8-20 comps
  const items = [];

  for (let i = 0; i < count; i++) {
    const price = minPrice + Math.round((absHash * (i + 1) * 7919) % (maxPrice - minPrice));
    const platform = PLATFORMS[((absHash * (i + 3)) % PLATFORMS.length)];
    const itemCondition = condition || CONDITIONS[((absHash * (i + 5)) % CONDITIONS.length)];
    const daysAgo = 1 + ((absHash * (i + 7)) % 60);
    const soldDate = new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0];

    items.push({
      title: `${query} ${itemCondition === "Like New" ? "- Like New" : ""}`.trim(),
      price,
      platform,
      soldDate,
      condition: itemCondition,
    });
  }

  // Sort by date descending
  items.sort((a, b) => b.soldDate.localeCompare(a.soldDate));

  return {
    query,
    avgPrice,
    minPrice,
    maxPrice,
    sampleCount: count,
    suggestedPrice,
    items,
  };
}

// GET /sold-prices
router.get("/sold-prices", async (req, res) => {
  const parsed = GetSoldPricesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Missing required query parameter: query" });
  }

  const { query, category, condition } = parsed.data;
  const data = generateFakeSoldData(query, category, condition);

  return res.json(data);
});

export default router;
