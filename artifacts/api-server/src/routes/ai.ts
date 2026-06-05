import { Router } from "express";
import { GenerateDescriptionBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// POST /ai/generate-description
router.post("/ai/generate-description", async (req, res) => {
  const parsed = GenerateDescriptionBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }

  const { title, category, brand, size, condition, notes, platforms } = parsed.data;
  const requestedPlatforms = platforms ?? ["poshmark", "depop", "mercari"];

  const conditionLabel =
    {
      new_with_tags: "New with tags",
      new_without_tags: "New without tags",
      excellent: "Excellent condition",
      good: "Good condition",
      fair: "Fair condition",
    }[condition ?? ""] ?? condition ?? "Good condition";

  const itemSummary = [
    title,
    brand ? `Brand: ${brand}` : null,
    size ? `Size: ${size}` : null,
    category ? `Category: ${category}` : null,
    `Condition: ${conditionLabel}`,
    notes ? `Notes: ${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const platformInstructions: Record<string, string> = {
    poshmark:
      "Write a Poshmark listing description. Be friendly and enthusiastic. Mention the brand, size, and condition clearly. Add an offer encouragement like 'open to offers'. Use line breaks. Keep it under 200 words.",
    depop:
      "Write a Depop listing description. Be casual, cool, and Gen-Z friendly. Use a few relevant hashtags at the end (brand, category, style). Keep it short and punchy — under 120 words.",
    mercari:
      "Write a Mercari listing description. Be straightforward and informative. Mention measurements if relevant, condition details, and shipping info. Keep it factual and under 150 words.",
  };

  const result: { poshmark: string | null; depop: string | null; mercari: string | null } = {
    poshmark: null,
    depop: null,
    mercari: null,
  };

  await Promise.all(
    requestedPlatforms.map(async (platform) => {
      const instruction = platformInstructions[platform];
      if (!instruction) return;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5-mini",
          max_completion_tokens: 512,
          messages: [
            {
              role: "system",
              content: `You are an expert reseller who writes compelling platform-specific listings. ${instruction}`,
            },
            {
              role: "user",
              content: `Write a listing description for this item:\n\n${itemSummary}`,
            },
          ],
        });

        const text = response.choices[0]?.message?.content ?? "";
        (result as any)[platform] = text;
      } catch (err) {
        // Fallback to template if AI fails
        (result as any)[platform] = buildFallback(platform, { title, brand, size, condition: conditionLabel, notes });
      }
    })
  );

  return res.json(result);
});

function buildFallback(
  platform: string,
  data: { title?: string; brand?: string; size?: string; condition?: string; notes?: string }
) {
  if (platform === "poshmark") {
    return [
      data.title,
      data.brand ? `Brand: ${data.brand}` : null,
      data.size ? `Size: ${data.size}` : null,
      `Condition: ${data.condition}`,
      "",
      "Fast shipping! Bundle 2+ items for a discount.",
      "Open to reasonable offers — use the Offer button!",
      data.notes ?? null,
    ]
      .filter((l) => l !== null)
      .join("\n");
  }
  if (platform === "depop") {
    const tags = [data.brand, "vintage", "secondhand", "sustainable"].filter(Boolean).map((t) => `#${t!.replace(/\s+/g, "")}`);
    return [`${data.title}`, `${data.condition}${data.size ? ` · Size ${data.size}` : ""}`, "Ships same day!", tags.join(" ")].join("\n\n");
  }
  return [
    data.brand ? `Brand: ${data.brand}` : null,
    data.size ? `Size: ${data.size}` : null,
    `Condition: ${data.condition}`,
    "",
    data.notes ?? null,
    "Smoke-free home. Ships within 1-2 business days.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

// POST /ai/scan-item — thrift scanner, returns buy/pass signal
router.post("/ai/scan-item", async (req, res) => {
  const { imageBase64 } = req.body ?? {};
  if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" });

  const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

  const systemPrompt = `You are an expert thrift store reseller. You are shown a photo of an item and must decide if it's worth buying to resell.

Evaluate: brand recognition, condition, demand on Depop/Poshmark/Mercari, typical resale value vs thrift store cost.

Return ONLY valid JSON:
{
  "signal": "buy" or "pass",
  "item": "brief item identification (brand + type)",
  "reason": "1-2 sentence plain English explanation of why to buy or pass",
  "avgPrice": estimated average resale price as a number (e.g. 45),
  "recentSales": estimated number of similar recent sales as a number (e.g. 12)
}

Be decisive. If it's a known brand in good condition with solid demand, say buy. If it's generic or worn out, say pass.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: [{ type: "image_url", image_url: { url: dataUrl, detail: "low" } }] as any },
      ],
    } as any);
    const text = response.choices[0]?.message?.content ?? "{}";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON");
    return res.json(JSON.parse(match[0]));
  } catch (err) {
    return res.status(500).json({ error: "Scan failed", details: String(err) });
  }
});

// POST /ai/quick-fill
router.post("/ai/quick-fill", async (req, res) => {
  const { rawText, images } = req.body ?? {};
  if (!rawText || typeof rawText !== "string") {
    return res.status(400).json({ error: "rawText is required" });
  }

  const hasImages = Array.isArray(images) && images.length > 0;

  const systemPrompt = `You are an expert reseller assistant helping list secondhand fashion items across Poshmark, Depop, and Mercari.
${hasImages ? "The user has provided photos. Carefully examine each for: brand labels/tags, size tags, visible flaws (stains, pilling, holes, fading, discoloration, missing buttons, wear patterns), fabric/material, color, and overall condition." : ""}

Your job: extract structured listing fields AND write deeply platform-optimized descriptions. Each platform has a different culture, algorithm, and buyer — the descriptions MUST feel completely different.

POSHMARK description rules:
- SEO-heavy: stuff keywords naturally (brand, style name, color, size, season, aesthetic keywords like "cottagecore", "Y2K", "old money", "streetwear")
- Friendly, enthusiastic seller voice — like a friend selling to you
- Mention: brand, size, measurements if possible, condition, color, any flaws honestly
- Always end with: "Open to offers! Bundle 2+ items for a discount 💕 Fast shipping from a smoke-free home."
- Format with line breaks for readability
- 150-220 words

DEPOP description rules:
- Casual, Gen-Z / millennial reseller tone — short punchy sentences
- Lead with the vibe/aesthetic first (e.g. "pure 90s energy 🔥" or "perfect vintage find")
- Mention brand, size, condition in a conversational way
- NO corporate language — write like you're texting a friend
- End with 8-12 relevant hashtags: mix brand + aesthetic + category + era (e.g. #vintage #levi501 #y2kdenim #thrifted #denimjeans #90sfashion)
- 80-120 words total including hashtags

MERCARI description rules:
- Factual, buyer-reassurance focused — Mercari buyers want specifics
- Lead with brand and item type
- Include: exact measurements if inferable, color, condition with specific details, any flaws with precise location ("small 1cm mark on left sleeve")
- Mention: "Ships within 1 business day", "Comes from a clean, smoke-free home"
- NO hashtags, NO overly casual language
- Bullet-point style or short paragraphs
- 100-160 words

${hasImages ? "Note any visible flaws in the 'notes' field and reference them honestly (but briefly) in all descriptions." : ""}

Return ONLY a valid JSON object:
{
  "title": "compelling title under 60 chars — lead with brand if known",
  "brand": "brand name or empty string",
  "category": "one of: tops, bottoms, dresses, outerwear, shoes, bags, accessories, activewear, swimwear, beauty, home, electronics, collectibles, books, toys, sports, other",
  "size": "size or empty string",
  "condition": "one of: new_with_tags, new_without_tags, excellent, good, fair",
  "price": "suggested resale price as number string based on brand and condition",
  "originalPrice": "original retail price if known, else empty string",
  "notes": "measurements, specific flaws seen in photos, color, material details",
  "color": "primary color(s) of the item as a short string e.g. 'Black', 'Navy Blue', 'White/Black'",
  "poshmarkStyle": "one of: Casual, Formal, Athletic, Business Casual, Bohemian, Streetwear, Vintage/Retro, Party/Cocktail, Preppy, Beach/Swim",
  "poshmarkCategory": "most specific Poshmark category that applies e.g. 'Jeans', 'Blouses', 'Sneakers', 'Jackets & Coats'",
  "depopTags": "10-12 comma-separated hashtag words WITHOUT the # symbol (e.g. 'vintage,levi501,y2kdenim,thrifted,denimjeans,90sfashion,streetwear,upcycled')",
  "mercariShipping": "one of: seller (seller pays), free (free shipping), buyer (buyer pays) — default to seller",
  "poshmarkDescription": "full SEO-heavy Poshmark description per rules above",
  "depopDescription": "full casual Depop description with hashtags per rules above",
  "mercariDescription": "full factual Mercari description per rules above"
}`;

  try {
    // Build user message content — text + optional images
    type ContentPart =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } };

    const userContent: ContentPart[] = [{ type: "text", text: rawText || "(no description provided, use images only)" }];

    if (hasImages) {
      // Include up to 4 images to avoid token overuse
      for (const imgBase64 of (images as string[]).slice(0, 4)) {
        const dataUrl = imgBase64.startsWith("data:") ? imgBase64 : `data:image/jpeg;base64,${imgBase64}`;
        userContent.push({
          type: "image_url",
          image_url: { url: dataUrl, detail: "low" },
        });
      }
    }

    const model = hasImages ? "gpt-4o" : "gpt-4o-mini";

    const response = await openai.chat.completions.create({
      model,
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    } as any);

    const text = response.choices[0]?.message?.content ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]);
    return res.json({ ...parsed, _usedVision: hasImages });
  } catch (err) {
    return res.status(500).json({ error: "AI quick fill failed", details: String(err) });
  }
});

export default router;
