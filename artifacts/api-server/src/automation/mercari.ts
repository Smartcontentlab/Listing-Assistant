import { getContext, saveSession, humanDelay, humanMove, humanType } from "./browser.ts";
import type { Listing } from "@workspace/db";

const MERCARI_URL = "https://www.mercari.com";

const SELECTORS = {
  login: {
    email: 'input[type="email"], input[name="email"]',
    password: 'input[type="password"], input[name="password"]',
    submit: 'button[type="submit"]',
  },
  sell: {
    url: "/sell/",
    photos: {
      uploadButton: '[aria-label="Add photos"], [data-testid="photo-upload"], button:has-text("Add Photo")',
      fileInput: 'input[type="file"]',
    },
    title: 'input[name="name"], [data-testid="item-name-input"] input, #item-name',
    description: 'textarea[name="description"], [data-testid="description-textarea"] textarea, #description',
    category: {
      dropdown: '[data-testid="category-field"], [aria-label="Category"]',
      options: {
        tops: "Women - Tops",
        bottoms: "Women - Bottoms",
        dresses: "Women - Dresses",
        outerwear: "Women - Coats & Jackets",
        shoes: "Women - Shoes",
        bags: "Women - Bags & Purses",
        accessories: "Women - Accessories",
        activewear: "Women - Activewear",
        other: "Everything Else",
      },
    },
    brand: '[data-testid="brand-field"] input, input[placeholder*="brand" i], #brand',
    condition: {
      options: {
        new_with_tags: "New",
        new_without_tags: "Like New",
        excellent: "Like New",
        good: "Good",
        fair: "Fair",
      },
    },
    size: {
      dropdown: '[data-testid="size-field"]',
    },
    price: 'input[name="price"], [data-testid="price-input"] input, #price',
    shipping: 'text="Ship by myself", [data-testid="ship-by-myself"]',
    submit: 'button:has-text("List"), button[type="submit"], [data-testid="submit-listing"]',
  },
  mypage: {
    url: "/mypage/listings/",
    items: '[class*="item"], [data-testid*="listing"], [class*="product"]',
    editButton: 'button:has-text("Edit"), [aria-label="Edit listing"], [data-testid="edit"]',
    moreOptions: '[aria-label="More options"], [class*="menu-button"]',
    deleteButton: 'button:has-text("Delete"), [data-testid="delete"]',
    confirmDelete: 'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")',
  },
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

function fillWithFallback(page: any, selectors: string[], value: string, description: string): Promise<void> {
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

export async function loginMercari(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  const context = await getContext("mercari");
  const page = await context.newPage();
  
  try {
    await page.goto(`${MERCARI_URL}/login/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await humanDelay(500, 1000);
    
    await fillWithFallback(page, [SELECTORS.login.email], username, "email");
    await humanDelay(200, 500);
    await fillWithFallback(page, [SELECTORS.login.password], password, "password");
    await humanDelay(200, 500);
    await page.click(SELECTORS.login.submit);
    
    await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 15000 });
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
    await humanDelay(1000, 2000);
    
    if (page.url().toString().includes("/login")) {
      return { success: false, error: "Session expired — please re-login in Platforms settings." };
    }
    
    // Upload photos (Mercari max 12)
    if (listing.imageUrls?.length) {
      for (const imgUrl of listing.imageUrls.slice(0, 12)) {
        try {
          const response = await fetch(imgUrl);
          const buffer = Buffer.from(await response.arrayBuffer());
          
          const [fileChooser] = await Promise.all([
            page.waitForFileChooser({ timeout: 10000 }),
            clickWithFallback(page, [SELECTORS.sell.photos.uploadButton], "photo upload button")
              .catch(() => page.click(SELECTORS.sell.photos.fileInput)),
          ]);
          await fileChooser.setFiles([{ name: "photo.jpg", mimeType: "image/jpeg", buffer }]);
          await humanDelay(1500, 3000);
        } catch (e) {
          console.warn(`Failed to upload photo: ${e}`);
        }
      }
    }
    
    // Title
    await fillWithFallback(page, [SELECTORS.sell.title], listing.title, "title");
    await humanDelay(300, 600);
    
    // Description (Mercari style)
    const desc = listing.mercariDescription ?? listing.description ?? "";
    await fillWithFallback(page, [SELECTORS.sell.description], desc, "description");
    await humanDelay(300, 600);
    
    // Category flow — Mercari uses multi-level category picker
    await clickWithFallback(page, [SELECTORS.sell.category.dropdown], "category dropdown").catch(() => null);
    const catMap = SELECTORS.sell.category.options;
    await clickWithFallback(page, [`text="${catMap[listing.category ?? "other"] ?? "Everything Else"}"`], "category option").catch(() => null);
    await humanDelay(300, 600);
    
    // Brand
    if (listing.brand) {
      await fillWithFallback(page, [SELECTORS.sell.brand], listing.brand, "brand").catch(() => null);
      await humanDelay(200, 500);
    }
    
    // Condition
    const condMap = SELECTORS.sell.condition.options;
    await clickWithFallback(page, [`text="${condMap[listing.condition] ?? "Good"}"`], "condition option").catch(() => null);
    await humanDelay(300, 600);
    
    // Size
    if (listing.size) {
      await clickWithFallback(page, [SELECTORS.sell.size.dropdown], "size dropdown").catch(() => null);
      await humanDelay(300, 600);
      await clickWithFallback(page, [`text="${listing.size}"`], `size option ${listing.size}`).catch(() => null);
      await humanDelay(300, 600);
    }
    
    // Price
    await fillWithFallback(page, [SELECTORS.sell.price], String(listing.price), "price");
    await humanDelay(200, 500);
    
    // Shipping — pick a standard option
    await clickWithFallback(page, [SELECTORS.sell.shipping], "ship by myself").catch(() => null);
    await humanDelay(300, 600);
    
    // Submit
    await clickWithFallback(page, [SELECTORS.sell.submit], "submit button");
    await humanDelay(4000, 6000);
    
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

export async function delistFromMercari(listing: { title: string }): Promise<{ success: boolean; error?: string }> {
  const context = await getContext("mercari");
  const page = await context.newPage();
  
  try {
    await page.goto(`${MERCARI_URL}/mypage/listings/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await humanDelay(1000, 2000);
    
    if (page.url().toString().includes("/login")) {
      return { success: false, error: "Session expired — please re-login in Platforms settings." };
    }
    
    const titleLower = listing.title.toLowerCase();
    const items = await page.$$(SELECTORS.mypage.items);
    let found = false;
    
    for (const item of items) {
      const text = (await item.innerText().catch(() => "")).toLowerCase();
      if (text.includes(titleLower.slice(0, 20))) {
        await item.click();
        await page.waitForLoadState("domcontentloaded");
        await humanDelay(500, 1000);
        found = true;
        break;
      }
    }
    
    if (!found) {
      return { success: false, error: `Listing "${listing.title}" not found on Mercari.` };
    }
    
    // Click Edit or three-dot menu
    await clickWithFallback(page, [SELECTORS.mypage.editButton], "edit button").catch(() => 
      clickWithFallback(page, [SELECTORS.mypage.moreOptions], "more options")
    );
    await humanDelay(500, 1000);
    
    // Click Delete
    await clickWithFallback(page, [SELECTORS.mypage.deleteButton], "delete button").catch(() => null);
    await humanDelay(500, 1000);
    
    // Confirm
    await clickWithFallback(page, [SELECTORS.mypage.confirmDelete], "confirm delete").catch(() => null);
    await humanDelay(1500, 3000);
    
    await saveSession("mercari", context);
    return { success: true };
  } catch (err) {
    return { success: false, error: `Mercari delist failed: ${String(err)}` };
  } finally {
    await page.close();
    await context.close();
  }
}