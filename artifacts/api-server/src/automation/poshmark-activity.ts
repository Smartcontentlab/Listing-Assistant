/**
 * Poshmark activity automation — closet sharing, follow-back, share-back,
 * community following, and daily relisting.
 *
 * All actions use randomized human-like delays to avoid bot detection.
 */

import { getContext, saveSession } from "./browser.js";
import type { Page } from "playwright";

const BASE = "https://poshmark.com";

// ─── Delay helpers ────────────────────────────────────────────────────────────

/** Sleep for a random duration between min and max milliseconds */
function sleep(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((res) => setTimeout(res, ms));
}

/** Human-like short pause (between clicks/typing) */
const humanPause = () => sleep(800, 2500);

/** Medium gap between items in a session */
const itemGap = () => sleep(4000, 12000);

/** Long gap between distinct actions */
const actionGap = () => sleep(15000, 45000);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.goto(`${BASE}/feed`, { waitUntil: "domcontentloaded", timeout: 20000 });
    return !page.url().includes("/login");
  } catch {
    return false;
  }
}

async function getUsername(page: Page): Promise<string | null> {
  try {
    // Try to get username from profile link in nav
    const handle = await page.$eval(
      '[data-et-name="profile_nav"] a, a[href^="/@"]',
      (el) => el.getAttribute("href")
    );
    return handle?.replace("/@", "") ?? null;
  } catch {
    return null;
  }
}

// ─── Share Closet ─────────────────────────────────────────────────────────────

export async function shareCloset(): Promise<{ shared: number; errors: string[] }> {
  const context = await getContext("poshmark");
  const page = await context.newPage();
  const errors: string[] = [];
  let shared = 0;

  try {
    if (!(await isLoggedIn(page))) {
      return { shared: 0, errors: ["Not logged in — connect your Poshmark account first."] };
    }

    const username = await getUsername(page);
    if (!username) throw new Error("Could not determine Poshmark username");

    // Go to own closet
    await page.goto(`${BASE}/@${username}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await humanPause();

    // Collect all listing share buttons on the page (scroll to load all)
    let prevCount = 0;
    for (let scroll = 0; scroll < 20; scroll++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await sleep(1500, 3000);
      const count = await page.$$eval('[data-et-name="share"], button[aria-label*="share" i], .share-btn', (els) => els.length);
      if (count === prevCount) break;
      prevCount = count;
    }

    const shareButtons = await page.$$('[data-et-name="share"], button[aria-label*="share" i], .share-btn');

    for (const btn of shareButtons) {
      try {
        await btn.scrollIntoViewIfNeeded();
        await humanPause();
        await btn.click();
        await sleep(600, 1200);

        // Click "Share to followers" in the share modal
        const toFollowers = await page.$('button:has-text("Followers"), [data-et-name="share_to_followers"]');
        if (toFollowers) {
          await toFollowers.click();
          await sleep(400, 800);
        }

        shared++;
        await itemGap();
      } catch (err) {
        errors.push(`Share error: ${String(err)}`);
      }
    }

    await saveSession("poshmark", context);
  } catch (err) {
    errors.push(String(err));
  } finally {
    await page.close();
    await context.close();
  }

  return { shared, errors };
}

// ─── Follow Back ──────────────────────────────────────────────────────────────

export async function followBack(): Promise<{ followed: number; errors: string[] }> {
  const context = await getContext("poshmark");
  const page = await context.newPage();
  const errors: string[] = [];
  let followed = 0;

  try {
    if (!(await isLoggedIn(page))) {
      return { followed: 0, errors: ["Not logged in."] };
    }

    const username = await getUsername(page);
    if (!username) throw new Error("Could not determine username");

    // Go to followers list
    await page.goto(`${BASE}/@${username}/followers`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await humanPause();

    // Find all "Follow" buttons (not "Following" — those are already followed)
    const followBtns = await page.$$('button:has-text("Follow"):not(:has-text("Following"))');

    // Cap at 30 per session to stay under radar
    const toFollow = followBtns.slice(0, 30);

    for (const btn of toFollow) {
      try {
        await btn.scrollIntoViewIfNeeded();
        await humanPause();
        await btn.click();
        followed++;
        await itemGap();
      } catch (err) {
        errors.push(`Follow error: ${String(err)}`);
      }
    }

    await saveSession("poshmark", context);
  } catch (err) {
    errors.push(String(err));
  } finally {
    await page.close();
    await context.close();
  }

  return { followed, errors };
}

// ─── Share Back ───────────────────────────────────────────────────────────────

export async function shareBack(): Promise<{ shared: number; errors: string[] }> {
  const context = await getContext("poshmark");
  const page = await context.newPage();
  const errors: string[] = [];
  let shared = 0;

  try {
    if (!(await isLoggedIn(page))) {
      return { shared: 0, errors: ["Not logged in."] };
    }

    // Check news/activity feed for "shared your listing"
    await page.goto(`${BASE}/news`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await humanPause();

    // Find activity items where someone shared your listing
    const activityItems = await page.$$('[class*="activity"], .news-item, [data-et-name*="news"]');

    const usersToShareBack = new Set<string>();
    for (const item of activityItems.slice(0, 20)) {
      try {
        const text = await item.innerText();
        if (text.toLowerCase().includes("shared")) {
          // Extract the user link
          const link = await item.$('a[href*="/@"]');
          if (link) {
            const href = await link.getAttribute("href");
            const user = href?.match(/@([^/]+)/)?.[1];
            if (user) usersToShareBack.add(user);
          }
        }
      } catch {
        // skip
      }
    }

    // Share one item from each person's closet
    for (const user of Array.from(usersToShareBack).slice(0, 10)) {
      try {
        await page.goto(`${BASE}/@${user}`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await humanPause();

        // Share their first available listing
        const firstShare = await page.$('[data-et-name="share"], button[aria-label*="share" i]');
        if (firstShare) {
          await firstShare.scrollIntoViewIfNeeded();
          await firstShare.click();
          await sleep(600, 1200);
          const toFollowers = await page.$('button:has-text("Followers"), [data-et-name="share_to_followers"]');
          if (toFollowers) await toFollowers.click();
          shared++;
        }

        await actionGap();
      } catch (err) {
        errors.push(`Share-back error for @${user}: ${String(err)}`);
      }
    }

    await saveSession("poshmark", context);
  } catch (err) {
    errors.push(String(err));
  } finally {
    await page.close();
    await context.close();
  }

  return { shared, errors };
}

// ─── Community Following ──────────────────────────────────────────────────────

export async function followCommunity(
  category: string = "Women"
): Promise<{ followed: number; errors: string[] }> {
  const context = await getContext("poshmark");
  const page = await context.newPage();
  const errors: string[] = [];
  let followed = 0;

  try {
    if (!(await isLoggedIn(page))) {
      return { followed: 0, errors: ["Not logged in."] };
    }

    // Browse the category feed and follow sellers
    await page.goto(`${BASE}/category/${category.toLowerCase()}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await humanPause();

    // Collect seller profile links from listings
    const sellerLinks = await page.$$eval(
      'a[href*="/@"]',
      (links) => [...new Set(links.map((l) => l.getAttribute("href")).filter(Boolean))] as string[]
    );

    // Visit up to 15 sellers and follow them
    const toVisit = sellerLinks.slice(0, 15);
    for (const href of toVisit) {
      try {
        await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await humanPause();

        const followBtn = await page.$('button:has-text("Follow"):not(:has-text("Following"))');
        if (followBtn) {
          await followBtn.click();
          followed++;
          await itemGap();
        }
        await actionGap();
      } catch (err) {
        errors.push(`Community follow error: ${String(err)}`);
      }
    }

    await saveSession("poshmark", context);
  } catch (err) {
    errors.push(String(err));
  } finally {
    await page.close();
    await context.close();
  }

  return { followed, errors };
}

// ─── Daily Relist ─────────────────────────────────────────────────────────────

export async function dailyRelist(): Promise<{ relisted: number; errors: string[] }> {
  // Relisting on Poshmark = sharing all closet items fresh — this is their
  // recommended mechanism. True deletion+repost is rarely needed and risky.
  // We'll do a full closet share as the "relist" to bump all items to top.
  const result = await shareCloset();
  return { relisted: result.shared, errors: result.errors };
}
