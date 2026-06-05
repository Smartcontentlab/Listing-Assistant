import { getContext, saveSession } from "./browser.js";
import type { Listing } from "@workspace/db";

const DEPOP_URL = "https://www.depop.com";

export async function loginDepop(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  const context = await getContext("depop");
  const page = await context.newPage();
  try {
    await page.goto(`${DEPOP_URL}/login/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.includes("/login"), { timeout: 15000 });
    await saveSession("depop", context);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  } finally {
    await page.close();
    await context.close();
  }
}

export async function postToDepop(listing: Listing): Promise<{ success: boolean; url?: string; error?: string }> {
  const context = await getContext("depop");
  const page = await context.newPage();
  try {
    await page.goto(`${DEPOP_URL}/sell/`, { waitUntil: "domcontentloaded", timeout: 30000 });

    if (page.url().includes("/login")) {
      return { success: false, error: "Session expired — please re-login in Platforms settings." };
    }

    // Upload photos
    if (listing.imageUrls?.length) {
      for (const imgUrl of listing.imageUrls.slice(0, 4)) {
        const response = await fetch(imgUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser(),
          page.click('button[aria-label="Add photo"], [data-testid="photo-upload-button"], label[for*="photo"]').catch(() => page.click('input[type="file"]')),
        ]);
        await fileChooser.setFiles([{ name: "photo.jpg", mimeType: "image/jpeg", buffer }]);
        await page.waitForTimeout(1500);
      }
    }

    // Description (Depop style)
    const desc = listing.depopDescription ?? listing.description ?? "";
    await page.fill('textarea[name="description"], [data-testid="description-input"] textarea, #description', desc);

    // Price
    await page.fill('input[name="price"], [data-testid="price-input"] input, #price', String(listing.price));

    // Category
    const catMap: Record<string, string> = {
      tops: "Tops",
      bottoms: "Bottoms",
      dresses: "Dresses",
      outerwear: "Coats & Jackets",
      shoes: "Shoes & Boots",
      bags: "Bags & Purses",
      accessories: "Accessories",
      activewear: "Activewear",
      other: "Other",
    };
    await page.click('[data-testid="category-selector"], [aria-label="Category"]').catch(() => null);
    await page.click(`text="${catMap[listing.category ?? "other"] ?? "Other"}"`).catch(() => null);

    // Condition
    const condMap: Record<string, string> = {
      new_with_tags: "New with tags",
      new_without_tags: "New without tags",
      excellent: "Like new",
      good: "Good",
      fair: "Fair",
    };
    await page.click(`text="${condMap[listing.condition] ?? "Good"}"`).catch(() => null);

    // Size
    if (listing.size) {
      await page.click('[data-testid="size-selector"], [aria-label="Size"]').catch(() => null);
      await page.click(`text="${listing.size}"`).catch(() => null);
    }

    // Submit
    await page.click('button[type="submit"], button:has-text("Upload"), button:has-text("List")');
    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    await saveSession("depop", context);
    return { success: true, url: finalUrl };
  } catch (err) {
    return { success: false, error: `Depop post failed: ${String(err)}` };
  } finally {
    await page.close();
    await context.close();
  }
}

export async function delistFromDepop(listing: { title: string }): Promise<{ success: boolean; error?: string }> {
  const context = await getContext("depop");
  const page = await context.newPage();
  try {
    await page.goto(`${DEPOP_URL}/selling/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (page.url().includes("/login")) {
      return { success: false, error: "Session expired — please re-login in Platforms settings." };
    }

    const titleLower = listing.title.toLowerCase();
    const items = await page.$$('[class*="item"], [data-testid*="listing"], [class*="product"]');
    let found = false;

    for (const item of items) {
      const text = (await item.innerText().catch(() => "")).toLowerCase();
      if (text.includes(titleLower.slice(0, 20))) {
        await item.click();
        await page.waitForLoadState("domcontentloaded");
        found = true;
        break;
      }
    }

    if (!found) {
      return { success: false, error: `Listing "${listing.title}" not found on Depop.` };
    }

    // Open edit or options menu
    await page.click('button:has-text("Edit"), [aria-label="Edit"], [data-testid="edit-button"]').catch(() => null);
    await page.waitForTimeout(600);

    // Click Delete
    await page.click('button:has-text("Delete"), [data-testid="delete-button"]').catch(() => null);
    await page.waitForTimeout(600);

    // Confirm
    await page.click('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').catch(() => null);
    await page.waitForTimeout(1500);

    await saveSession("depop", context);
    return { success: true };
  } catch (err) {
    return { success: false, error: `Depop delist failed: ${String(err)}` };
  } finally {
    await page.close();
    await context.close();
  }
}
