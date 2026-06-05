import { getContext, saveSession } from "./browser.js";
import type { Listing } from "@workspace/db";

const POSHMARK_URL = "https://poshmark.com";

export async function loginPoshmark(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  const context = await getContext("poshmark");
  const page = await context.newPage();
  try {
    await page.goto(`${POSHMARK_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.fill('input[name="login_form[username_email]"]', username);
    await page.fill('input[name="login_form[password]"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.includes("/login"), { timeout: 15000 });
    await saveSession("poshmark", context);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  } finally {
    await page.close();
    await context.close();
  }
}

export async function postToPoshmark(listing: Listing): Promise<{ success: boolean; url?: string; error?: string }> {
  const context = await getContext("poshmark");
  const page = await context.newPage();
  try {
    await page.goto(`${POSHMARK_URL}/create-listing`, { waitUntil: "domcontentloaded", timeout: 30000 });

    // If redirected to login, session expired
    if (page.url().includes("/login")) {
      return { success: false, error: "Session expired — please re-login in Platforms settings." };
    }

    // Upload photos
    if (listing.imageUrls?.length) {
      for (const imgUrl of listing.imageUrls.slice(0, 8)) {
        // Fetch image and upload
        const response = await fetch(imgUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser(),
          page.click('[data-test="add-photo-btn"], [aria-label="Add photo"], .photo-upload-btn').catch(() => page.click('input[type="file"]')),
        ]);
        await fileChooser.setFiles([{ name: "photo.jpg", mimeType: "image/jpeg", buffer }]);
        await page.waitForTimeout(1500);
      }
    }

    // Title
    await page.fill('input[name="listing[title]"], [data-test="title-input"] input, #title', listing.title);

    // Description (Poshmark specific)
    const desc = listing.poshmarkDescription ?? listing.description ?? "";
    await page.fill('textarea[name="listing[description]"], [data-test="description-textarea"] textarea, #description', desc);

    // Category — Poshmark uses dropdown flow; we click and select by keyword
    const categoryMap: Record<string, string> = {
      tops: "Tops",
      bottoms: "Bottoms",
      dresses: "Dresses",
      outerwear: "Jackets & Coats",
      shoes: "Shoes",
      bags: "Handbags",
      accessories: "Accessories",
      activewear: "Activewear",
      other: "Other",
    };
    const catLabel = categoryMap[listing.category ?? "other"] ?? "Other";
    await page.click('[data-test="category-dropdown"], #category').catch(() => null);
    await page.click(`text="${catLabel}"`).catch(() => null);

    // Size
    if (listing.size) {
      await page.click('[data-test="size-dropdown"], #size').catch(() => null);
      await page.click(`text="${listing.size}"`).catch(() => null);
    }

    // Condition
    const condMap: Record<string, string> = {
      new_with_tags: "NWT",
      new_without_tags: "NWOT",
      excellent: "Excellent Condition",
      good: "Good Condition",
      fair: "Fair Condition",
    };
    const condLabel = condMap[listing.condition] ?? "Good Condition";
    await page.click(`text="${condLabel}"`).catch(() => null);

    // Price and original price
    await page.fill('input[name="listing[price]"], [data-test="price-input"] input, #price', String(listing.price));
    if (listing.originalPrice) {
      await page.fill('input[name="listing[original_price]"], [data-test="original-price-input"] input, #original_price', String(listing.originalPrice)).catch(() => null);
    }

    // Brand
    if (listing.brand) {
      await page.fill('input[name="listing[brand]"], [data-test="brand-input"] input, #brand', listing.brand).catch(() => null);
    }

    // List item
    await page.click('[data-test="list-item-btn"], button:has-text("List"), button:has-text("Next")');
    await page.waitForURL((url) => url.includes("/listing/"), { timeout: 20000 });

    const finalUrl = page.url();
    await saveSession("poshmark", context);
    return { success: true, url: finalUrl };
  } catch (err) {
    return { success: false, error: `Poshmark post failed: ${String(err)}` };
  } finally {
    await page.close();
    await context.close();
  }
}

export async function delistFromPoshmark(listing: { title: string }): Promise<{ success: boolean; error?: string }> {
  const context = await getContext("poshmark");
  const page = await context.newPage();
  try {
    // Go to "My Closet" active listings
    await page.goto(`${POSHMARK_URL}/closet/my`, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (page.url().includes("/login")) {
      return { success: false, error: "Session expired — please re-login in Platforms settings." };
    }

    // Find listing tile by title text
    const titleLower = listing.title.toLowerCase();
    const tiles = await page.$$('[class*="tile"], [class*="listing"], [data-test*="item"]');
    let found = false;

    for (const tile of tiles) {
      const text = (await tile.innerText().catch(() => "")).toLowerCase();
      if (text.includes(titleLower.slice(0, 20))) {
        // Click to open the listing
        await tile.click();
        await page.waitForLoadState("domcontentloaded");
        found = true;
        break;
      }
    }

    if (!found) {
      return { success: false, error: `Listing "${listing.title}" not found in Poshmark closet.` };
    }

    // Click the edit button / three-dot menu
    await page.click('[aria-label="Edit listing"], [data-test="edit-listing"], button:has-text("Edit")').catch(() =>
      page.click('[class*="overflow"], [aria-label="More options"], [class*="kebab"]')
    );
    await page.waitForTimeout(800);

    // Click Delete
    await page.click('text="Delete"').catch(() =>
      page.click('[data-test="delete-listing"], button:has-text("Delete listing")')
    );
    await page.waitForTimeout(600);

    // Confirm delete in the modal
    await page.click('text="Yes, delete", text="Confirm", text="Delete"').catch(() => null);
    await page.waitForTimeout(1500);

    await saveSession("poshmark", context);
    return { success: true };
  } catch (err) {
    return { success: false, error: `Poshmark delist failed: ${String(err)}` };
  } finally {
    await page.close();
    await context.close();
  }
}
