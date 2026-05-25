/**
 * Automation Scheduler
 *
 * Runs Poshmark automation tasks throughout the day with randomized,
 * human-like timing to avoid bot detection. All times are jittered.
 *
 * Strategy:
 *  - Share closet: 4-6 times per day, spread across active hours
 *  - Follow back: every 45-90 min
 *  - Share back: every 30-60 min
 *  - Community follow: 2 sessions per day (morning + evening)
 *  - Daily relist: once per day, random time between 9am–11am
 */

import { db } from "@workspace/db";
import { automationConfigTable, automationLogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  shareCloset,
  followBack,
  shareBack,
  followCommunity,
  dailyRelist,
} from "./poshmark-activity.js";
import { hasSession } from "./browser.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeatureKey =
  | "share_closet"
  | "follow_back"
  | "share_back"
  | "community_follow"
  | "daily_relist";

interface ScheduledTask {
  feature: FeatureKey;
  label: string;
  minIntervalMs: number;
  maxIntervalMs: number;
  activeHoursStart: number; // 0-23
  activeHoursEnd: number;
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}

// ─── State ────────────────────────────────────────────────────────────────────

const tasks: Record<FeatureKey, ScheduledTask> = {
  share_closet: {
    feature: "share_closet",
    label: "Share Closet",
    minIntervalMs: 2.5 * 60 * 60 * 1000, // 2.5 hours
    maxIntervalMs: 4.5 * 60 * 60 * 1000, // 4.5 hours
    activeHoursStart: 8,
    activeHoursEnd: 22,
    timer: null,
    running: false,
    lastRunAt: null,
    nextRunAt: null,
  },
  follow_back: {
    feature: "follow_back",
    label: "Follow Back",
    minIntervalMs: 45 * 60 * 1000,  // 45 min
    maxIntervalMs: 90 * 60 * 1000,  // 90 min
    activeHoursStart: 9,
    activeHoursEnd: 21,
    timer: null,
    running: false,
    lastRunAt: null,
    nextRunAt: null,
  },
  share_back: {
    feature: "share_back",
    label: "Share Back",
    minIntervalMs: 30 * 60 * 1000,  // 30 min
    maxIntervalMs: 60 * 60 * 1000,  // 60 min
    activeHoursStart: 9,
    activeHoursEnd: 21,
    timer: null,
    running: false,
    lastRunAt: null,
    nextRunAt: null,
  },
  community_follow: {
    feature: "community_follow",
    label: "Community Follow",
    minIntervalMs: 5 * 60 * 60 * 1000, // 5 hours
    maxIntervalMs: 8 * 60 * 60 * 1000, // 8 hours
    activeHoursStart: 10,
    activeHoursEnd: 20,
    timer: null,
    running: false,
    lastRunAt: null,
    nextRunAt: null,
  },
  daily_relist: {
    feature: "daily_relist",
    label: "Daily Relist",
    minIntervalMs: 23 * 60 * 60 * 1000, // ~once a day
    maxIntervalMs: 25 * 60 * 60 * 1000,
    activeHoursStart: 9,
    activeHoursEnd: 11,
    timer: null,
    running: false,
    lastRunAt: null,
    nextRunAt: null,
  },
};

const enabled: Set<FeatureKey> = new Set();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActiveHour(task: ScheduledTask): boolean {
  const h = new Date().getHours();
  return h >= task.activeHoursStart && h < task.activeHoursEnd;
}

function jitter(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

async function logRun(feature: FeatureKey, action: string, status: "ok" | "error", details: string, count = 0) {
  try {
    await db.insert(automationLogTable).values({ feature, action, status, details, count });
    await db
      .update(automationConfigTable)
      .set({ lastRunAt: new Date() })
      .where(eq(automationConfigTable.feature, feature));
  } catch {
    // don't crash scheduler on log failure
  }
}

async function runTask(task: ScheduledTask) {
  if (task.running) return;
  if (!enabled.has(task.feature)) return;
  if (!isActiveHour(task)) {
    scheduleNext(task);
    return;
  }

  // Check session
  const sessionOk = await hasSession("poshmark");
  if (!sessionOk) {
    await logRun(task.feature, task.label, "error", "No Poshmark session — connect your account in Platforms.", 0);
    scheduleNext(task);
    return;
  }

  task.running = true;
  task.lastRunAt = new Date();

  try {
    let result: { errors: string[] } & Record<string, number>;
    switch (task.feature) {
      case "share_closet":
        result = await shareCloset() as any;
        await logRun(task.feature, task.label, result.errors.length ? "error" : "ok",
          result.errors.length ? result.errors[0] : `Shared ${(result as any).shared} items`,
          (result as any).shared);
        break;
      case "follow_back":
        result = await followBack() as any;
        await logRun(task.feature, task.label, result.errors.length ? "error" : "ok",
          result.errors.length ? result.errors[0] : `Followed back ${(result as any).followed} people`,
          (result as any).followed);
        break;
      case "share_back":
        result = await shareBack() as any;
        await logRun(task.feature, task.label, result.errors.length ? "error" : "ok",
          result.errors.length ? result.errors[0] : `Shared back for ${(result as any).shared} people`,
          (result as any).shared);
        break;
      case "community_follow":
        result = await followCommunity() as any;
        await logRun(task.feature, task.label, result.errors.length ? "error" : "ok",
          result.errors.length ? result.errors[0] : `Followed ${(result as any).followed} community users`,
          (result as any).followed);
        break;
      case "daily_relist":
        result = await dailyRelist() as any;
        await logRun(task.feature, task.label, result.errors.length ? "error" : "ok",
          result.errors.length ? result.errors[0] : `Relisted ${(result as any).relisted} items`,
          (result as any).relisted);
        break;
    }
  } catch (err) {
    await logRun(task.feature, task.label, "error", String(err), 0);
  } finally {
    task.running = false;
    scheduleNext(task);
  }
}

function scheduleNext(task: ScheduledTask) {
  if (!enabled.has(task.feature)) return;
  if (task.timer) clearTimeout(task.timer);

  const delayMs = jitter(task.minIntervalMs, task.maxIntervalMs);
  task.nextRunAt = new Date(Date.now() + delayMs);

  task.timer = setTimeout(() => runTask(task), delayMs);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function enableFeature(feature: FeatureKey) {
  enabled.add(feature);
  const task = tasks[feature];
  if (!task.timer && !task.running) {
    // Run first time after a short random delay (1-5 min) so it doesn't all fire at once
    const initialDelay = jitter(60_000, 5 * 60_000);
    task.nextRunAt = new Date(Date.now() + initialDelay);
    task.timer = setTimeout(() => runTask(task), initialDelay);
  }
  await db
    .insert(automationConfigTable)
    .values({ feature, enabled: true })
    .onConflictDoUpdate({ target: automationConfigTable.feature, set: { enabled: true, updatedAt: new Date() } });
}

export async function disableFeature(feature: FeatureKey) {
  enabled.delete(feature);
  const task = tasks[feature];
  if (task.timer) {
    clearTimeout(task.timer);
    task.timer = null;
  }
  task.nextRunAt = null;
  await db
    .insert(automationConfigTable)
    .values({ feature, enabled: false })
    .onConflictDoUpdate({ target: automationConfigTable.feature, set: { enabled: false, updatedAt: new Date() } });
}

export async function runNow(feature: FeatureKey): Promise<void> {
  const task = tasks[feature];
  if (task.timer) clearTimeout(task.timer);
  task.timer = null;
  await runTask(task);
}

export function getStatus(): Record<FeatureKey, { enabled: boolean; running: boolean; lastRunAt: Date | null; nextRunAt: Date | null }> {
  const result: any = {};
  for (const [key, task] of Object.entries(tasks)) {
    result[key] = {
      enabled: enabled.has(key as FeatureKey),
      running: task.running,
      lastRunAt: task.lastRunAt,
      nextRunAt: task.nextRunAt,
    };
  }
  return result;
}

/** Called on server start — restores enabled features from DB */
export async function initScheduler() {
  try {
    const configs = await db.select().from(automationConfigTable);
    for (const config of configs) {
      if (config.enabled) {
        await enableFeature(config.feature as FeatureKey);
      }
    }
    console.log(`[scheduler] Initialized — ${enabled.size} features active`);
  } catch (err) {
    console.warn("[scheduler] Init failed:", err);
  }
}
