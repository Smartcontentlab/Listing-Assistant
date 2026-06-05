import { Router } from "express";
import { db } from "@workspace/db";
import { credentialsTable, listingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hasSession, clearSession } from "../automation/browser.js";
import { loginPoshmark, postToPoshmark, delistFromPoshmark } from "../automation/poshmark.js";
import { loginDepop, postToDepop, delistFromDepop } from "../automation/depop.js";
import { loginMercari, postToMercari, delistFromMercari } from "../automation/mercari.js";

const router = Router();

const loginFns: Record<string, (u: string, p: string) => Promise<{ success: boolean; error?: string }>> = {
  poshmark: loginPoshmark,
  depop: loginDepop,
  mercari: loginMercari,
};

const postFns: Record<string, (listing: any) => Promise<{ success: boolean; url?: string; error?: string }>> = {
  poshmark: postToPoshmark,
  depop: postToDepop,
  mercari: postToMercari,
};

const delistFns: Record<string, (listing: { title: string }) => Promise<{ success: boolean; error?: string }>> = {
  poshmark: delistFromPoshmark,
  depop: delistFromDepop,
  mercari: delistFromMercari,
};

// GET /automation/credentials — list connected platforms
router.get("/automation/credentials", async (_req, res) => {
  const rows = await db.select().from(credentialsTable);
  const result = await Promise.all(
    rows.map(async (r) => ({
      platform: r.platform,
      username: r.username,
      connected: await hasSession(r.platform),
    }))
  );
  return res.json(result);
});

// POST /automation/credentials — save + test login
router.post("/automation/credentials", async (req, res) => {
  const { platform, username, password } = req.body ?? {};
  if (!platform || !username || !password) {
    return res.status(400).json({ error: "platform, username, password required" });
  }

  const loginFn = loginFns[platform.toLowerCase()];
  if (!loginFn) return res.status(400).json({ error: "Unknown platform" });

  const loginResult = await loginFn(username, password);
  if (!loginResult.success) {
    return res.status(401).json({ error: loginResult.error ?? "Login failed. Check credentials." });
  }

  // Upsert credentials
  await db
    .insert(credentialsTable)
    .values({ platform: platform.toLowerCase(), username, password })
    .onConflictDoUpdate({
      target: credentialsTable.platform,
      set: { username, password, updatedAt: new Date() },
    });

  return res.json({ success: true, message: `Connected to ${platform} successfully.` });
});

// DELETE /automation/credentials/:platform
router.delete("/automation/credentials/:platform", async (req, res) => {
  const { platform } = req.params;
  await clearSession(platform);
  await db.delete(credentialsTable).where(eq(credentialsTable.platform, platform));
  return res.json({ success: true });
});

// POST /automation/post/:listingId — publish to all selected platforms
router.post("/automation/post/:listingId", async (req, res) => {
  const id = Number(req.params.listingId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid listing id" });

  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id));
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  const platforms = listing.platforms ?? [];
  if (!platforms.length) return res.status(400).json({ error: "No platforms selected for this listing" });

  const results: Record<string, { success: boolean; url?: string; error?: string }> = {};

  for (const platform of platforms) {
    const postFn = postFns[platform.toLowerCase()];
    if (!postFn) {
      results[platform] = { success: false, error: "Platform not supported for automation yet" };
      continue;
    }
    results[platform] = await postFn(listing);
  }

  const allSuccess = Object.values(results).every((r) => r.success);
  if (allSuccess) {
    await db.update(listingsTable).set({ status: "published", updatedAt: new Date() }).where(eq(listingsTable.id, id));
  }

  return res.json({ results });
});

// POST /automation/delist/:listingId — remove from all platforms (or a specific one)
router.post("/automation/delist/:listingId", async (req, res) => {
  const id = Number(req.params.listingId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid listing id" });

  const { platform: specificPlatform } = req.body ?? {};

  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id));
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  const platforms = specificPlatform
    ? [specificPlatform]
    : (listing.platforms ?? []);

  if (!platforms.length) return res.status(400).json({ error: "No platforms on this listing" });

  const results: Record<string, { success: boolean; error?: string }> = {};

  for (const platform of platforms) {
    const delistFn = delistFns[platform.toLowerCase()];
    if (!delistFn) {
      results[platform] = { success: false, error: "Delist not supported for this platform yet" };
      continue;
    }
    results[platform] = await delistFn({ title: listing.title });
  }

  return res.json({ results });
});

export default router;
