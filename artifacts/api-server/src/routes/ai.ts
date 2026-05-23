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

// POST /ai/quick-fill
router.post("/ai/quick-fill", async (req, res) => {
  const { rawText } = req.body ?? {};
  if (!rawText || typeof rawText !== "string") {
    return res.status(400).json({ error: "rawText is required" });
  }

  const systemPrompt = `You are an expert reseller assistant. The user will describe a clothing/fashion item in rough natural language.
Your job is to extract structured listing fields AND write platform-specific descriptions.

Return ONLY a valid JSON object with these exact fields (all strings, no nulls):
{
  "title": "short compelling listing title (max 60 chars)",
  "brand": "brand name or empty string",
  "category": "one of: tops, bottoms, dresses, outerwear, shoes, bags, accessories, activewear, swimwear, other",
  "size": "size or empty string",
  "condition": "one of: new_with_tags, new_without_tags, excellent, good, fair",
  "price": "suggested selling price as a number string (e.g. '45')",
  "originalPrice": "original retail price as number string, or empty string",
  "notes": "any extra details like measurements, flaws, or sourcing notes",
  "poshmarkDescription": "full Poshmark listing description (friendly, enthusiastic, under 200 words, mention brand/size/condition, say open to offers)",
  "depopDescription": "full Depop listing description (casual, Gen-Z, with hashtags at end, under 120 words)",
  "mercariDescription": "full Mercari listing description (factual, straightforward, under 150 words)"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawText },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]);
    return res.json(parsed);
  } catch (err) {
    return res.status(500).json({ error: "AI quick fill failed", details: String(err) });
  }
});

export default router;
