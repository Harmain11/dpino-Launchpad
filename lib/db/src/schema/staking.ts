import { pgTable, text, serial, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stakingPositionsTable = pgTable("staking_positions", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  amountStaked: real("amount_staked").notNull(),
  tier: text("tier").notNull(),
  rewardsEarned: real("rewards_earned").notNull().default(0),
  stakedAt: timestamp("staked_at").defaultNow().notNull(),
});

export const insertStakingPositionSchema = createInsertSchema(stakingPositionsTable).omit({ id: true, stakedAt: true });
export type InsertStakingPosition = z.infer<typeof insertStakingPositionSchema>;
export type StakingPosition = typeof stakingPositionsTable.$inferSelect;
