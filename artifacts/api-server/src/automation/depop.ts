import { getContext, saveSession, humanDelay, humanMove, humanType } from "./browser.ts";
import type { Listing } from "@workspace/db";

const DEPOP_URL = "https://www.depop.com";

const SELECTORS = {
  login: {
    username: 'input[name="username"]',
    password: 'input[name="password"]',
    submit: 'button[type="submit"]',
  },
  sell: {
    url: "/sell/",
    photos: {
      uploadButton: 'button[aria-label="Add photo"], [data-testid="photo-upload-button"], label[for*="photo"]',
      fileInput: 'input[type="file"]',
    },
    description: 'textarea[name="description"], [data-testid="description-input"] textarea, #description',
    price: 'input[name="price"], [data-testid="price-input"] input, #price',
    category: {
      dropdown: '[data-testid="category-selector"], [aria-label="Category"]',
      options: {
        tops: "Tops",
        bottoms: "Bottoms",
        dresses: "Dresses",
        outerwear: "Coats & Jackets",
        shoes: "Shoes & Boots",
        bags: "Bags & Purses",
        accessories: "Accessories",
        activewear: "Activewear",
        other: "Other",
      },
    },
    condition: {
      options: {
        new_with_tags: "New with tags",
        new_without_tags: "New without tags",
        excellent: "Like new",
        good: "Good",
        fair: "Fair",
      },
    },
    size: {
      dropdown: '[data-testid="size-selector"], [aria-label="Size"]',
    },
    submit: 'button[type="submit"], button:has-text("Upload"), button:has-text("List")',
  },
  selling: {
    url: "/selling/",
    items: '[class*="item"], [data-testid*="listing"], [class*="product"]',
    editButton: 'button:has-text("Edit"), [aria-label="Edit"], [data-testid="edit-button"]',
    deleteButton: 'button:has-text("Delete"), [data-testid="delete-button"]',
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

export async function loginDepop(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  const context = await getContext("depop");
  const page = await context.newPage();
  
  try {
    await page.goto(`${DEPOP_URL}/login/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await humanDelay(500, 1000);
    
    await fillWithFallback(page, [SELECTORS.login.username], username, "username");
    await humanDelay(200, 500);
    await fillWithFallback(page, [SELECTORS.login.password], password, "password");
    await humanDelay(200, 500);
    await page.click(SELECTORS.login.submit);
    
    await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 15000 });
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
    await humanDelay(1000, 2000);
    
    if (page.url().toString().includes("/login")) {
      return { success: false, error: "Session expired — please re-login in Platforms settings." };
    }
    
    // Upload photos (Depop max 4)
    if (listing.imageUrls?.length) {
      for (const imgUrl of listing.imageUrls.slice(0, 4)) {
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
    
    // Description (Depop style)
    const desc = listing.depopDescription ?? listing.description ?? "";
    await fillWithFallback(page, [SELECTORS.sell.description], desc, "description");
    await humanDelay(300, 600);
    
    // Price
    await fillWithFallback(page, [SELECTORS.sell.price], String(listing.price), "price");
    await humanDelay(200, 500);
    
    // Category
    const catMap = SELECTORS.sell.category.options;
    await clickWithFallback(page, [SELECTORS.sell.category.dropdown], "category dropdown");
    await humanDelay(300, 600);
    await clickWithFallback(page, [`text="${catMap[listing.category ?? "other"] ?? "Other"}"`], "category option").catch(() => {});
    await humanDelay(300, 600);
    
    // Condition
    const condMap = {
      new_with_tags: "New with tags",
      new_without_tags: "New without tags",
      excellent: "Like new",
      good: "Good",
      fair: "Fair",
    };
    await clickWithFallback(page, [`text="${condMap[listing.condition] ?? "Good"}"`], "condition option").catch(() => {});
    await humanDelay(300, 600);
    
    // Size
    if (listing.size) {
      await clickWithFallback(page, [SELECTORS.sell.size.dropdown], "size dropdown");
      await humanDelay(300, 600);
      await clickWithFallback(page, [`text="${listing.size}"`], `size option ${listing.size}`).catch(() => {});
      await humanDelay(300, 600);
    }
    
    // Submit
    await clickWithFallback(page, [SELECTORS.sell.submit], "submit button");
    await humanDelay(3000, 5000);
    
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
    await humanDelay(1000, 2000);
    
    if (page.url().toString().includes("/login")) {
      return { success: false, error: "Session expired — please re-login in Platforms settings." };
    }
    
    const titleLower = listing.title.toLowerCase();
    const items = await page.$$(SELECTORS.selling.items);
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
      return { success: false, error: `Listing "${listing.title}" not found on Depop.` };
    }
    
    // Open edit or options menu
    await clickWithFallback(page, [SELECTORS.selling.editButton], "edit button").catch(() => {});
    await humanDelay(500, 1000);
    
    // Click Delete
    await clickWithFallback(page, [SELECTORS.selling.deleteButton], "delete button").catch(() => {});
    await humanDelay(500, 1000);
    
    // Confirm
    await clickWithFallback(page, [SELECTORS.selling.confirmDelete], "confirm delete").catch(() => {});
    await humanDelay(1500, 3000);
    
    await saveSession("depop", context);
    return { success: true };
  } catch (err) {
    return { success: false, error: `Depop delist failed: ${String(err)}` };
  } finally {
    await page.close();
    await context.close();
  }
}