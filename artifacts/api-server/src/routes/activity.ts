import { Router } from "express";
import { db } from "@workspace/db";
import { listingsTable, automationLogTable } from "@workspace/db/schema";
import { gte } from "drizzle-orm";

const router = Router();

// GET /activity?since=<ISO date>
// Returns recent sold listings + automation events as notifications
router.get("/activity", async (req, res) => {
  const sinceRaw = req.query.since as string | undefined;
  const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const [recentListings, recentLogs] = await Promise.all([
      db
        .select({
          id: listingsTable.id,
          title: listingsTable.title,
          soldAt: listingsTable.soldAt,
          soldPrice: listingsTable.soldPrice,
          platforms: listingsTable.platforms,
          updatedAt: listingsTable.updatedAt,
          status: listingsTable.status,
        })
        .from(listingsTable)
        .where(gte(listingsTable.updatedAt, since)),

      db
        .select({
          id: automationLogTable.id,
          feature: automationLogTable.feature,
          action: automationLogTable.action,
          status: automationLogTable.status,
          details: automationLogTable.details,
          createdAt: automationLogTable.createdAt,
        })
        .from(automationLogTable)
        .where(gte(automationLogTable.createdAt, since)),
    ]);

    const notifications: Array<{
      id: string;
      type: "sold" | "offer" | "info";
      title: string;
      body: string;
      timestamp: string | Date;
      read: boolean;
      listingId?: number;
    }> = [];

    // Sold notifications
    for (const l of recentListings) {
      if (l.status === "sold" && l.soldAt && new Date(l.soldAt) >= since) {
        notifications.push({
          id: `sold-${l.id}-${l.soldAt}`,
          type: "sold",
          title: "Item sold! 🎉",
          body: `${l.title}${l.soldPrice ? ` — $${Number(l.soldPrice).toFixed(2)}` : ""}`,
          timestamp: l.soldAt ?? l.updatedAt,
          read: false,
          listingId: l.id,
        });
      }
    }

    // Automation log notifications — surface "offer" and "sale" events detected by sales_detection
    for (const log of recentLogs) {
      if (log.feature === "sales_detection" && log.status === "ok") {
        const isOffer = log.action?.toLowerCase().includes("offer");
        notifications.push({
          id: `log-${log.id}`,
          type: isOffer ? "offer" : "sold",
          title: isOffer ? "New offer received!" : log.action,
          body: log.details ?? "",
          timestamp: log.createdAt,
          read: false,
        });
      }
    }

    // Sort newest first
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({ notifications });
  } catch (err) {
    return res.status(500).json({ notifications: [], error: String(err) });
  }
});

export default router;
