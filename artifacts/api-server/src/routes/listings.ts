import { Router } from "express";
import { db, listingsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  ListListingsQueryParams,
  CreateListingBody,
  GetListingParams,
  UpdateListingParams,
  UpdateListingBody,
  DeleteListingParams,
  PublishListingParams,
  PublishListingBody,
  MarkListingSoldParams,
  MarkListingSoldBody,
} from "@workspace/api-zod";

const router = Router();

function formatListing(row: typeof listingsTable.$inferSelect) {
  return {
    ...row,
    price: Number(row.price),
    originalPrice: row.originalPrice != null ? Number(row.originalPrice) : null,
    soldPrice: row.soldPrice != null ? Number(row.soldPrice) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    soldAt: row.soldAt ? row.soldAt.toISOString() : null,
  };
}

// GET /listings
router.get("/listings", async (req, res) => {
  const parsed = ListListingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query params" });
  }
  const { status, platform } = parsed.data;

  let query = db.select().from(listingsTable).orderBy(desc(listingsTable.createdAt));
  const rows = await query;

  let filtered = rows;
  if (status) filtered = filtered.filter((r) => r.status === status);
  if (platform) filtered = filtered.filter((r) => r.platforms.includes(platform));

  return res.json(filtered.map(formatListing));
});

// POST /listings
router.post("/listings", async (req, res) => {
  const parsed = CreateListingBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }
  const { title, description, price, originalPrice, category, brand, size, condition, platforms, imageUrls } = parsed.data;

  const [row] = await db
    .insert(listingsTable)
    .values({
      title,
      description: description ?? null,
      price: String(price),
      originalPrice: originalPrice != null ? String(originalPrice) : null,
      category: category ?? null,
      brand: brand ?? null,
      size: size ?? null,
      condition: condition ?? "good",
      platforms: platforms ?? [],
      imageUrls: imageUrls ?? [],
    })
    .returning();

  return res.status(201).json(formatListing(row));
});

// GET /listings/stats
router.get("/listings/stats", async (req, res) => {
  const all = await db.select().from(listingsTable).orderBy(desc(listingsTable.createdAt));

  const total = all.length;
  const draft = all.filter((r) => r.status === "draft").length;
  const published = all.filter((r) => r.status === "published").length;
  const sold = all.filter((r) => r.status === "sold").length;
  const archived = all.filter((r) => r.status === "archived").length;

  const soldListings = all.filter((r) => r.status === "sold" && r.soldPrice != null);
  const totalRevenue = soldListings.reduce((sum, r) => sum + Number(r.soldPrice), 0);
  const allPrices = all.map((r) => Number(r.price));
  const avgPrice = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0;

  const recentActivity = all.slice(0, 5).map(formatListing);

  return res.json({ total, draft, published, sold, archived, totalRevenue, avgPrice, recentActivity });
});

// GET /listings/:id
router.get("/listings/:id", async (req, res) => {
  const parsed = GetListingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const [row] = await db.select().from(listingsTable).where(eq(listingsTable.id, parsed.data.id));
  if (!row) return res.status(404).json({ error: "Not found" });

  return res.json(formatListing(row));
});

// PATCH /listings/:id
router.patch("/listings/:id", async (req, res) => {
  const idParsed = UpdateListingParams.safeParse({ id: Number(req.params.id) });
  if (!idParsed.success) return res.status(400).json({ error: "Invalid id" });

  const bodyParsed = UpdateListingBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: "Invalid body" });

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const b = bodyParsed.data;

  if (b.title !== undefined) updates.title = b.title;
  if (b.description !== undefined) updates.description = b.description;
  if (b.price !== undefined) updates.price = String(b.price);
  if (b.originalPrice !== undefined) updates.originalPrice = b.originalPrice != null ? String(b.originalPrice) : null;
  if (b.category !== undefined) updates.category = b.category;
  if (b.brand !== undefined) updates.brand = b.brand;
  if (b.size !== undefined) updates.size = b.size;
  if (b.condition !== undefined) updates.condition = b.condition;
  if (b.status !== undefined) updates.status = b.status;
  if (b.platforms !== undefined) updates.platforms = b.platforms;
  if (b.imageUrls !== undefined) updates.imageUrls = b.imageUrls;
  if (b.poshmarkDescription !== undefined) updates.poshmarkDescription = b.poshmarkDescription;
  if (b.depopDescription !== undefined) updates.depopDescription = b.depopDescription;
  if (b.mercariDescription !== undefined) updates.mercariDescription = b.mercariDescription;

  const [row] = await db
    .update(listingsTable)
    .set(updates)
    .where(eq(listingsTable.id, idParsed.data.id))
    .returning();

  if (!row) return res.status(404).json({ error: "Not found" });

  return res.json(formatListing(row));
});

// DELETE /listings/:id
router.delete("/listings/:id", async (req, res) => {
  const parsed = DeleteListingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  await db.delete(listingsTable).where(eq(listingsTable.id, parsed.data.id));
  return res.status(204).send();
});

// POST /listings/:id/publish
router.post("/listings/:id/publish", async (req, res) => {
  const idParsed = PublishListingParams.safeParse({ id: Number(req.params.id) });
  if (!idParsed.success) return res.status(400).json({ error: "Invalid id" });

  const bodyParsed = PublishListingBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: "Invalid body" });

  const { platforms } = bodyParsed.data;

  // Simulate publish (real platform OAuth would go here)
  const results = platforms.map((platform) => ({
    platform,
    success: true,
    url: `https://www.${platform}.com/listing/${idParsed.data.id}`,
    error: null,
  }));

  // Update listing status and platforms
  const [row] = await db.select().from(listingsTable).where(eq(listingsTable.id, idParsed.data.id));
  if (row) {
    const merged = Array.from(new Set([...row.platforms, ...platforms]));
    await db
      .update(listingsTable)
      .set({ status: "published", platforms: merged, updatedAt: new Date() })
      .where(eq(listingsTable.id, idParsed.data.id));
  }

  return res.json({ results });
});

// POST /listings/:id/mark-sold
router.post("/listings/:id/mark-sold", async (req, res) => {
  const idParsed = MarkListingSoldParams.safeParse({ id: Number(req.params.id) });
  if (!idParsed.success) return res.status(400).json({ error: "Invalid id" });

  const bodyParsed = MarkListingSoldBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: "Invalid body" });

  const [row] = await db
    .update(listingsTable)
    .set({
      status: "sold",
      soldPrice: String(bodyParsed.data.soldPrice),
      soldAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(listingsTable.id, idParsed.data.id))
    .returning();

  if (!row) return res.status(404).json({ error: "Not found" });

  return res.json(formatListing(row));
});

export default router;
