import { getContext, saveSession, humanDelay, humanMove, humanType } from "./browser.ts";
import type { Listing } from "@workspace/db";

const POSHMARK_URL = "https://poshmark.com";

const SELECTORS = {
  login: {
    username: 'input[name="login_form[username_email]"]',
    password: 'input[name="login_form[password]"]',
    submit: 'button[type="submit"]',
  },
  createListing: {
    url: "/create-listing",
    title: 'input[name="listing[title]"], [data-test="title-input"] input, #title',
    description: 'textarea[name="listing[description]"], [data-test="description-textarea"] textarea, #description',
    category: {
      dropdown: '[data-test="category-dropdown"], #category',
      option: (label: string) => `text="${label}"`,
    },
    size: {
      dropdown: '[data-test="size-dropdown"], #size',
      option: (label: string) => `text="${label}"`,
    },
    condition: (label: string) => `text="${label}"`,
    price: 'input[name="listing[price]"], [data-test="price-input"] input, #price',
    originalPrice: 'input[name="listing[original_price]"], [data-test="original-price-input"] input, #original_price',
    brand: 'input[name="listing[brand]"], [data-test="brand-input"] input, #brand',
    photoUpload: '[data-test="add-photo-btn"], [aria-label="Add photo"], .photo-upload-btn, input[type="file"]',
    listButton: '[data-test="list-item-btn"], button:has-text("List"), button:has-text("Next")',
  },
  closet: {
    url: "/closet/my",
    itemTiles: '[class*="tile"], [class*="listing"], [data-test*="item"]',
    editButton: '[aria-label="Edit listing"], [data-test="edit-listing"], button:has-text("Edit")',
    moreOptions: '[class*="overflow"], [aria-label="More options"], [class*="kebab"]',
    deleteButton: 'text="Delete", [data-test="delete-listing"], button:has-text("Delete listing")',
    confirmDelete: 'text="Yes, delete", text="Confirm", text="Delete"',
  },
};

const CATEGORY_MAP: Record<string, string> = {
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

const COND_MAP: Record<string, string> = {
  new_with_tags: "NWT",
  new_without_tags: "NWOT",
  excellent: "Excellent Condition",
  good: "Good Condition",
  fair: "Fair Condition",
};

function clickWithFallback(page: any, selectors: string[], description: string): Promise<void> {
  for (const selector of selectors) {
    try {
      await page.click(selector, { timeout: 3000 });
      return;
    } catch {
      continue;
    }
  }
  throw new Error(`Failed to click ${description} with any selector`);
}

async function fillWithFallback(page: any, selectors: string[], value: string, description: string): Promise<void> {
  for (const selector of selectors) {
    try {
      await page.fill(selector, value);
      return;
    } catch {
      continue;
    }
  }
  throw new Error(`Failed to fill ${description} with any selector`);
}

export async function loginPoshmark(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  const context = await getContext("poshmark");
  const page = await context.newPage();
  
  try {
    await page.goto(`${POSHMARK_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await humanDelay(500, 1000);
    
    await fillWithFallback(page, [SELECTORS.login.username], username, "username");
    await humanDelay(200, 500);
    await fillWithFallback(page, [SELECTORS.login.password], password, "password");
    await humanDelay(200, 500);
    await page.click(SELECTORS.login.submit);
    
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
    await humanDelay(1000, 2000);
    
    // Check if session expired
    if (page.url().includes("/login")) {
      return { success: false, error: "Session expired — please re-login in Platforms settings." };
    }
    
    // Upload photos with human-like delays
    if (listing.imageUrls?.length) {
      for (const imgUrl of listing.imageUrls.slice(0, 8)) {
        try {
          const response = await fetch(imgUrl);
          const buffer = Buffer.from(await response.arrayBuffer());
          
          const [fileChooser] = await Promise.all([
            page.waitForFileChooser({ timeout: 10000 }),
            clickWithFallback(page, [
              SELECTORS.createListing.photoUpload,
            ], "photo upload button").catch(() => page.click('input[type="file"]')),
          ]);
          await fileChooser.setFiles([{ name: "photo.jpg", mimeType: "image/jpeg", buffer }]);
          await humanDelay(1500, 3000);
        } catch (e) {
          console.warn(`Failed to upload photo: ${e}`);
        }
      }
    }
    
    // Title
    await fillWithFallback(page, [SELECTORS.createListing.title], listing.title, "title");
    await humanDelay(300, 600);
    
    // Description (Poshmark specific)
    const desc = listing.poshmarkDescription ?? listing.description ?? "";
    await fillWithFallback(page, [SELECTORS.createListing.description], desc, "description");
    await humanDelay(300, 600);
    
    // Category
    const catLabel = CATEGORY_MAP[listing.category ?? "other"] ?? "Other";
    await clickWithFallback(page, [SELECTORS.createListing.category.dropdown], "category dropdown");
    await humanDelay(300, 600);
    await clickWithFallback(page, [SELECTORS.createListing.category.option(catLabel)], `category option ${catLabel}`).catch(() => {});
    await humanDelay(300, 600);
    
    // Size
    if (listing.size) {
      await clickWithFallback(page, [SELECTORS.createListing.size.dropdown], "size dropdown");
      await humanDelay(300, 600);
      await clickWithFallback(page, [SELECTORS.createListing.size.option(listing.size)], `size option ${listing.size}`).catch(() => {});
      await humanDelay(300, 600);
    }
    
    // Condition
    const condLabel = COND_MAP[listing.condition] ?? "Good Condition";
    await clickWithFallback(page, [SELECTORS.createListing.condition(condLabel)], `condition ${condLabel}`).catch(() => {});
    await humanDelay(300, 600);
    
    // Price and original price
    await fillWithFallback(page, [SELECTORS.createListing.price], String(listing.price), "price");
    await humanDelay(200, 500);
    if (listing.originalPrice) {
      await fillWithFallback(page, [SELECTORS.createListing.originalPrice], String(listing.originalPrice), "original price").catch(() => {});
      await humanDelay(200, 500);
    }
    
    // Brand
    if (listing.brand) {
      await fillWithFallback(page, [SELECTORS.createListing.brand], listing.brand, "brand").catch(() => {});
      await humanDelay(200, 500);
    }
    
    // List item
    await clickWithFallback(page, [SELECTORS.createListing.listButton], "list/submit button");
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
    await page.goto(`${POSHMARK_URL}/closet/my`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await humanDelay(1000, 2000);
    
    if (page.url().includes("/login")) {
      return { success: false, error: "Session expired — please re-login in Platforms settings." };
    }
    
    const titleLower = listing.title.toLowerCase();
    const tiles = await page.$$(SELECTORS.closet.itemTiles);
    let found = false;
    
    for (const tile of tiles) {
      const text = (await tile.innerText().catch(() => "")).toLowerCase();
      if (text.includes(titleLower.slice(0, 20))) {
        await tile.click();
        await page.waitForLoadState("domcontentloaded");
        await humanDelay(500, 1000);
        found = true;
        break;
      }
    }
    
    if (!found) {
      return { success: false, error: `Listing "${listing.title}" not found in Poshmark closet.` };
    }
    
    // Click edit/more options
    await clickWithFallback(page, [SELECTORS.closet.editButton, SELECTORS.closet.moreOptions], "edit/more options");
    await humanDelay(500, 1000);
    
    // Click Delete
    await clickWithFallback(page, [SELECTORS.closet.deleteButton], "delete button");
    await humanDelay(500, 1000);
    
    // Confirm delete
    await clickWithFallback(page, [SELECTORS.closet.confirmDelete], "confirm delete").catch(() => {});
    await humanDelay(1500, 3000);
    
    await saveSession("poshmark", context);
    return { success: true };
  } catch (err) {
    return { success: false, error: `Poshmark delist failed: ${String(err)}` };
  } finally {
    await page.close();
    await context.close();
  }
}