import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { stakingPositionsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  ListStakingPositionsQueryParams,
  CreateStakingPositionBody,
  GetStakingTiersResponse,
  ListStakingPositionsResponse,
  ListStakingPositionsResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

const STAKING_TIERS = [
  {
    id: "soldier",
    name: "SOLDIER",
    requiredAmount: 100000,
    allocationMultiplier: 1,
    benefits: [
      "Guaranteed allocation in every launch",
      "Share of protocol fees",
      "Early access to project info",
    ],
    color: "#6B7280",
  },
  {
    id: "general",
    name: "GENERAL",
    requiredAmount: 500000,
    allocationMultiplier: 3,
    benefits: [
      "3x allocation multiplier",
      "Larger share of protocol fees",
      "Priority whitelist spots",
      "Exclusive community channels",
    ],
    color: "#8B5CF6",
  },
  {
    id: "dark-lord",
    name: "DARK LORD",
    requiredAmount: 1000000,
    allocationMultiplier: 7,
    benefits: [
      "7x allocation multiplier",
      "Maximum protocol fee share",
      "Direct project founder access",
      "Dark Lord badge & NFT",
      "VIP events & activations",
    ],
    color: "#F59E0B",
  },
];

function getTierForAmount(amount: number): string {
  if (amount >= 1000000) return "DARK LORD";
  if (amount >= 500000) return "GENERAL";
  if (amount >= 100000) return "SOLDIER";
  return "NONE";
}

function mapPosition(p: typeof stakingPositionsTable.$inferSelect) {
  return {
    id: String(p.id),
    walletAddress: p.walletAddress,
    amountStaked: p.amountStaked,
    tier: p.tier,
    rewardsEarned: p.rewardsEarned,
    stakedAt: p.stakedAt.toISOString(),
  };
}

const router2: IRouter = Router();

router2.get("/staking/tiers", (_req, res) => {
  const response = GetStakingTiersResponse.parse(STAKING_TIERS);
  res.json(response);
});

router2.get("/staking/positions", async (req, res) => {
  const parsed = ListStakingPositionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: "Invalid params" });
    return;
  }

  let positions;
  if (parsed.data.walletAddress) {
    positions = await db.select().from(stakingPositionsTable).where(eq(stakingPositionsTable.walletAddress, parsed.data.walletAddress)).orderBy(desc(stakingPositionsTable.stakedAt));
  } else {
    positions = await db.select().from(stakingPositionsTable).orderBy(desc(stakingPositionsTable.stakedAt));
  }

  const response = ListStakingPositionsResponse.parse(positions.map(mapPosition));
  res.json(response);
});

router2.post("/staking/positions", async (req, res) => {
  const parsed = CreateStakingPositionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const { walletAddress, amountStaked } = parsed.data;
  const tier = getTierForAmount(amountStaked);

  const [position] = await db.insert(stakingPositionsTable).values({
    walletAddress,
    amountStaked,
    tier,
    rewardsEarned: 0,
  }).returning();

  const response = ListStakingPositionsResponseItem.parse(mapPosition(position));
  res.status(201).json(response);
});

router2.delete("/staking/positions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid ID" });
    return;
  }
  const [deleted] = await db.delete(stakingPositionsTable).where(eq(stakingPositionsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ success: true, id: String(id) });
});

export default router2;
