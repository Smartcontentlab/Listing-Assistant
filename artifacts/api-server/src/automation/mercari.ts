import { getContext, saveSession } from "./browser.js";
import type { Listing } from "@workspace/db";

const MERCARI_URL = "https://www.mercari.com";

export async function loginMercari(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  const context = await getContext("mercari");
  const page = await context.newPage();
  try {
    await page.goto(`${MERCARI_URL}/login/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.fill('input[type="email"], input[name="email"]', username);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.includes("/login"), { timeout: 15000 });
    await saveSession("mercari", context);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  } finally {
    await page.close();
    await context.close();
  }
}

export async function postToMercari(listing: Listing): Promise<{ success: boolean; url?: string; error?: string }> {
  const context = await getContext("mercari");
  const page = await context.newPage();
  try {
    await page.goto(`${MERCARI_URL}/sell/`, { waitUntil: "domcontentloaded", timeout: 30000 });

    if (page.url().includes("/login")) {
      return { success: false, error: "Session expired — please re-login in Platforms settings." };
    }

    // Upload photos
    if (listing.imageUrls?.length) {
      for (const imgUrl of listing.imageUrls.slice(0, 12)) {
        const response = await fetch(imgUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser(),
          page.click('[aria-label="Add photos"], [data-testid="photo-upload"], button:has-text("Add Photo")').catch(() => page.click('input[type="file"]')),
        ]);
        await fileChooser.setFiles([{ name: "photo.jpg", mimeType: "image/jpeg", buffer }]);
        await page.waitForTimeout(1500);
      }
    }

    // Title
    await page.fill('input[name="name"], [data-testid="item-name-input"] input, #item-name', listing.title);

    // Description (Mercari style)
    const desc = listing.mercariDescription ?? listing.description ?? "";
    await page.fill('textarea[name="description"], [data-testid="description-textarea"] textarea, #description', desc);

    // Category flow — Mercari uses multi-level category picker
    await page.click('[data-testid="category-field"], [aria-label="Category"]').catch(() => null);
    const catMap: Record<string, string> = {
      tops: "Women - Tops",
      bottoms: "Women - Bottoms",
      dresses: "Women - Dresses",
      outerwear: "Women - Coats & Jackets",
      shoes: "Women - Shoes",
      bags: "Women - Bags & Purses",
      accessories: "Women - Accessories",
      activewear: "Women - Activewear",
      other: "Everything Else",
    };
    await page.click(`text="${catMap[listing.category ?? "other"] ?? "Everything Else"}"`).catch(() => null);

    // Brand
    if (listing.brand) {
      await page.fill('[data-testid="brand-field"] input, input[placeholder*="brand" i], #brand', listing.brand).catch(() => null);
    }

    // Condition
    const condMap: Record<string, string> = {
      new_with_tags: "New",
      new_without_tags: "Like New",
      excellent: "Like New",
      good: "Good",
      fair: "Fair",
    };
    await page.click(`text="${condMap[listing.condition] ?? "Good"}"`).catch(() => null);

    // Size
    if (listing.size) {
      await page.click('[data-testid="size-field"]').catch(() => null);
      await page.click(`text="${listing.size}"`).catch(() => null);
    }

    // Price
    await page.fill('input[name="price"], [data-testid="price-input"] input, #price', String(listing.price));

    // Shipping — pick a standard option
    await page.click('text="Ship by myself"').catch(() =>
      page.click('[data-testid="ship-by-myself"]').catch(() => null)
    );

    // Submit
    await page.click('button:has-text("List"), button[type="submit"], [data-testid="submit-listing"]');
    await page.waitForTimeout(4000);

    const finalUrl = page.url();
    await saveSession("mercari", context);
    return { success: true, url: finalUrl };
  } catch (err) {
    return { success: false, error: `Mercari post failed: ${String(err)}` };
  } finally {
    await page.close();
    await context.close();
  }
}
