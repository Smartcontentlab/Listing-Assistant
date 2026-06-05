import { pgTable, serial, text, numeric, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conditionEnum = pgEnum("condition", [
  "new_with_tags",
  "new_without_tags",
  "excellent",
  "good",
  "fair",
]);

export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "published",
  "sold",
  "archived",
]);

export const listingsTable = pgTable("listings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: numeric("original_price", { precision: 10, scale: 2 }),
  category: text("category"),
  brand: text("brand"),
  size: text("size"),
  condition: conditionEnum("condition").notNull().default("good"),
  status: listingStatusEnum("status").notNull().default("draft"),
  platforms: text("platforms").array().notNull().default([]),
  imageUrls: text("image_urls").array().notNull().default([]),
  poshmarkDescription: text("poshmark_description"),
  depopDescription: text("depop_description"),
  mercariDescription: text("mercari_description"),
  soldPrice: numeric("sold_price", { precision: 10, scale: 2 }),
  soldAt: timestamp("sold_at"),
  platformUrls: text("platform_urls"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;
