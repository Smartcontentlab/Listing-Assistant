/**
 * Sales Detector — scrapes each connected platform for new sold orders,
 * matches them to CrossList inventory, marks them sold, and queues
 * delisting + shipping notifications automatically.
 */

import { getContext, saveSession, hasSession } from "./browser.js";
import { db } from "@workspace/db";
import { listingsTable, automationLogTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const BASE_POSHMARK = "https://poshmark.com";
const BASE_DEPOP = "https://www.depop.com";
const BASE_MERCARI = "https://www.mercari.com";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DetectedSale {
  platform: string;
  orderId: string;
  title: string;
  salePrice: number;
  soldAt: Date;
}

// ─── Fuzzy title match ────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function titleSimilarity(a: string, b: string): number {
  const wa = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const wb = new Set(normalize(b).split(/\s+/).filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  for (const w of wa) { if (wb.has(w)) common++; }
  return (common * 2) / (wa.size + wb.size);
}

// ─── Platform scrapers ────────────────────────────────────────────────────────

async function detectPoshmarkSales(): Promise<DetectedSale[]> {
  if (!(await hasSession("poshmark"))) return [];
  const context = await getContext("poshmark");
  const page = await context.newPage();
  const sales: DetectedSale[] = [];

  try {
    await page.goto(`${BASE_POSHMARK}/sales`, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (page.url().includes("/login")) return [];

    // Wait for order list to load
    await page.waitForSelector('[class*="order"], [data-test*="order"], .order-item', { timeout: 10000 }).catch(() => null);

    const orderItems = await page.$$('[class*="order"], [data-test*="order-item"]');

    for (const item of orderItems.slice(0, 20)) {
      try {
        const text = await item.innerText().catch(() => "");
        if (!text.toLowerCase().includes("sold")) continue;

        // Try to extract title and price from the order row
        const titleEl = await item.$('[class*="title"], h3, [class*="item-name"]');
        const priceEl = await item.$('[class*="price"], [class*="amount"]');
        const orderIdEl = await item.$('[class*="order-id"], [data-order-id]');

        const title = titleEl ? (await titleEl.innerText()).trim() : "";
        const priceText = priceEl ? (await priceEl.innerText()).replace(/[^0-9.]/g, "") : "0";
        const orderId = orderIdEl ? (await orderIdEl.getAttribute("data-order-id") ?? `pm-${Date.now()}-${Math.random()}`) : `pm-${Date.now()}`;

        if (title) {
          sales.push({
            platform: "poshmark",
            orderId,
            title,
            salePrice: parseFloat(priceText) || 0,
            soldAt: new Date(),
          });
        }
      } catch { /* skip malformed items */ }
    }

    await saveSession("poshmark", context);
  } catch (err) {
    console.warn("[sales-detector] Poshmark error:", err);
  } finally {
    await page.close();
    await context.close();
  }

  return sales;
}

async function detectDepopSales(): Promise<DetectedSale[]> {
  if (!(await hasSession("depop"))) return [];
  const context = await getContext("depop");
  const page = await context.newPage();
  const sales: DetectedSale[] = [];

  try {
    await page.goto(`${BASE_DEPOP}/selling/sold/`, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (page.url().includes("/login")) return [];

    await page.waitForSelector('[class*="sold"], [data-testid*="sold"], [class*="receipt"]', { timeout: 10000 }).catch(() => null);

    const items = await page.$$('[class*="sold-item"], [data-testid*="receipt"], [class*="receipt"]');
    for (const item of items.slice(0, 20)) {
      try {
        const titleEl = await item.$('[class*="title"], [class*="item-name"], h3');
        const priceEl = await item.$('[class*="price"], [class*="amount"]');
        const title = titleEl ? (await titleEl.innerText()).trim() : "";
        const priceText = priceEl ? (await priceEl.innerText()).replace(/[^0-9.]/g, "") : "0";

        if (title) {
          sales.push({
            platform: "depop",
            orderId: `dp-${Date.now()}-${Math.random()}`,
            title,
            salePrice: parseFloat(priceText) || 0,
            soldAt: new Date(),
          });
        }
      } catch { /* skip */ }
    }

    await saveSession("depop", context);
  } catch (err) {
    console.warn("[sales-detector] Depop error:", err);
  } finally {
    await page.close();
    await context.close();
  }

  return sales;
}

async function detectMercariSales(): Promise<DetectedSale[]> {
  if (!(await hasSession("mercari"))) return [];
  const context = await getContext("mercari");
  const page = await context.newPage();
  const sales: DetectedSale[] = [];

  try {
    await page.goto(`${BASE_MERCARI}/mypage/sales/`, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (page.url().includes("/login")) return [];

    await page.waitForSelector('[class*="item"], [data-testid*="item"]', { timeout: 10000 }).catch(() => null);

    const items = await page.$$('[class*="soldItem"], [data-testid*="sold"], [class*="complete"]');
    for (const item of items.slice(0, 20)) {
      try {
        const titleEl = await item.$('[class*="name"], [class*="title"], h3');
        const priceEl = await item.$('[class*="price"], [class*="amount"]');
        const title = titleEl ? (await titleEl.innerText()).trim() : "";
        const priceText = priceEl ? (await priceEl.innerText()).replace(/[^0-9.]/g, "") : "0";

        if (title) {
          sales.push({
            platform: "mercari",
            orderId: `mc-${Date.now()}-${Math.random()}`,
            title,
            salePrice: parseFloat(priceText) || 0,
            soldAt: new Date(),
          });
        }
      } catch { /* skip */ }
    }

    await saveSession("mercari", context);
  } catch (err) {
    console.warn("[sales-detector] Mercari error:", err);
  } finally {
    await page.close();
    await context.close();
  }

  return sales;
}

// ─── Match sales to inventory ─────────────────────────────────────────────────

async function processSales(detected: DetectedSale[]): Promise<number> {
  if (!detected.length) return 0;

  // Load all active/published listings
  const active = await db
    .select({ id: listingsTable.id, title: listingsTable.title, platforms: listingsTable.platforms, status: listingsTable.status })
    .from(listingsTable)
    .where(inArray(listingsTable.status, ["published", "draft"]));

  let matched = 0;

  for (const sale of detected) {
    // Find the best matching listing by title similarity
    let bestMatch: typeof active[0] | null = null;
    let bestScore = 0;

    for (const listing of active) {
      const score = titleSimilarity(sale.title, listing.title);
      if (score > bestScore && score > 0.4) { // 40% word overlap threshold
        bestScore = score;
        bestMatch = listing;
      }
    }

    if (!bestMatch) continue;

    // Mark as sold
    await db.update(listingsTable).set({
      status: "sold",
      soldPrice: String(sale.salePrice),
      soldAt: sale.soldAt,
      updatedAt: new Date(),
    }).where(eq(listingsTable.id, bestMatch.id));

    // Log notification
    await db.insert(automationLogTable).values({
      feature: "sales_detection",
      action: `Sold on ${sale.platform}`,
      status: "ok",
      details: `"${bestMatch.title}" — $${sale.salePrice}. Delist from: ${(bestMatch.platforms ?? []).filter(p => p !== sale.platform).join(", ") || "no other platforms"}`,
      count: 1,
    });

    matched++;
    console.log(`[sales-detector] ✓ Matched sale: "${bestMatch.title}" on ${sale.platform} for $${sale.salePrice}`);
  }

  return matched;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function detectSales(): Promise<{ detected: number; matched: number; errors: string[] }> {
  const errors: string[] = [];
  const allSales: DetectedSale[] = [];

  const [poshSales, depopSales, mercariSales] = await Promise.allSettled([
    detectPoshmarkSales(),
    detectDepopSales(),
    detectMercariSales(),
  ]);

  if (poshSales.status === "fulfilled") allSales.push(...poshSales.value);
  else errors.push(`Poshmark: ${String(poshSales.reason)}`);

  if (depopSales.status === "fulfilled") allSales.push(...depopSales.value);
  else errors.push(`Depop: ${String(depopSales.reason)}`);

  if (mercariSales.status === "fulfilled") allSales.push(...mercariSales.value);
  else errors.push(`Mercari: ${String(mercariSales.reason)}`);

  const matched = await processSales(allSales);

  return { detected: allSales.length, matched, errors };
}
