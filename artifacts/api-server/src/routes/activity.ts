import { Router } from "express";
import { db } from "@workspace/db";
import { listingsTable } from "@workspace/db/schema";
import { gte, eq } from "drizzle-orm";

const router = Router();

// GET /activity?since=<ISO date>
// Returns recent sold/updated listings as notifications
router.get("/activity", async (req, res) => {
  const sinceRaw = req.query.since as string | undefined;
  const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const recentSold = await db
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
      .where(gte(listingsTable.updatedAt, since));

    const notifications = recentSold
      .filter((l) => l.status === "sold" && l.soldAt && new Date(l.soldAt) >= since)
      .map((l) => ({
        id: `sold-${l.id}-${l.soldAt}`,
        type: "sold" as const,
        title: "Item sold! 🎉",
        body: `${l.title}${l.soldPrice ? ` — $${Number(l.soldPrice).toFixed(2)}` : ""}`,
        timestamp: l.soldAt ?? l.updatedAt,
        read: false,
        listingId: l.id,
      }));

    return res.json({ notifications });
  } catch (err) {
    return res.status(500).json({ notifications: [], error: String(err) });
  }
});

export default router;
