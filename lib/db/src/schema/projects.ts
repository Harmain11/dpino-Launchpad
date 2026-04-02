import { pgTable, text, serial, real, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectStatusEnum = pgEnum("project_status", ["upcoming", "live", "ended"]);

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ticker: text("ticker").notNull(),
  description: text("description").notNull(),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  tokenAddress: text("token_address"),
  status: projectStatusEnum("status").notNull().default("upcoming"),
  totalRaise: real("total_raise").notNull(),
  raisedAmount: real("raised_amount").notNull().default(0),
  tokenPrice: real("token_price").notNull(),
  minAllocation: real("min_allocation"),
  maxAllocation: real("max_allocation"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  websiteUrl: text("website_url"),
  twitterUrl: text("twitter_url"),
  telegramUrl: text("telegram_url"),
  participants: integer("participants").notNull().default(0),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
