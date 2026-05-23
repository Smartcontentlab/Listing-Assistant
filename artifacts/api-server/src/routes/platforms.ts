import { Router } from "express";
import { db, listingsTable } from "@workspace/db";

const router = Router();

const PLATFORMS = [
  { name: "poshmark", displayName: "Poshmark", color: "#D6286B", connected: false, username: null },
  { name: "depop", displayName: "Depop", color: "#FF2300", connected: false, username: null },
  { name: "mercari", displayName: "Mercari", color: "#EA3F2B", connected: false, username: null },
];

// GET /platforms
router.get("/platforms", async (req, res) => {
  const allListings = await db.select({ platforms: listingsTable.platforms }).from(listingsTable);

  const platforms = PLATFORMS.map((p) => {
    const listingCount = allListings.filter((l) => l.platforms.includes(p.name)).length;
    return { ...p, listingCount };
  });

  return res.json(platforms);
});

export default router;
