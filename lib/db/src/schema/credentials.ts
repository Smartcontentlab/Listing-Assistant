import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const credentialsTable = pgTable("platform_credentials", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull().unique(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PlatformCredential = typeof credentialsTable.$inferSelect;
