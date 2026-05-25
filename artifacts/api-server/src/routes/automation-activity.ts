import { Router } from "express";
import { db } from "@workspace/db";
import { automationLogTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  enableFeature,
  disableFeature,
  runNow,
  getStatus,
  type FeatureKey,
} from "../automation/scheduler.js";

const router = Router();

// GET /automation/activity/status
router.get("/automation/activity/status", async (_req, res) => {
  const status = getStatus();
  return res.json(status);
});

// GET /automation/activity/logs?limit=50
router.get("/automation/activity/logs", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const logs = await db
    .select()
    .from(automationLogTable)
    .orderBy(desc(automationLogTable.createdAt))
    .limit(limit);
  return res.json(logs);
});

// POST /automation/activity/enable  { feature: "share_closet" }
router.post("/automation/activity/enable", async (req, res) => {
  const { feature } = req.body ?? {};
  if (!feature) return res.status(400).json({ error: "feature required" });
  try {
    await enableFeature(feature as FeatureKey);
    return res.json({ success: true, feature });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /automation/activity/disable  { feature: "share_closet" }
router.post("/automation/activity/disable", async (req, res) => {
  const { feature } = req.body ?? {};
  if (!feature) return res.status(400).json({ error: "feature required" });
  try {
    await disableFeature(feature as FeatureKey);
    return res.json({ success: true, feature });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /automation/activity/run-now  { feature: "share_closet" }
router.post("/automation/activity/run-now", async (req, res) => {
  const { feature } = req.body ?? {};
  if (!feature) return res.status(400).json({ error: "feature required" });
  // Fire async, respond immediately
  runNow(feature as FeatureKey).catch(console.error);
  return res.json({ success: true, message: `${feature} triggered — running in background.` });
});

export default router;
