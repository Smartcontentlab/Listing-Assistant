import { pgTable, serial, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const automationConfigTable = pgTable("automation_config", {
  id: serial("id").primaryKey(),
  feature: text("feature").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  settings: jsonb("settings").default({}),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const automationLogTable = pgTable("automation_log", {
  id: serial("id").primaryKey(),
  feature: text("feature").notNull(),
  action: text("action").notNull(),
  status: text("status").notNull().default("ok"),
  details: text("details"),
  count: integer("count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AutomationConfig = typeof automationConfigTable.$inferSelect;
export type AutomationLog = typeof automationLogTable.$inferSelect;
