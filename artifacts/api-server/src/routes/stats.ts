import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, stakingPositionsTable } from "@workspace/db/schema";
import { eq, count, sum, desc } from "drizzle-orm";
import {
  GetPlatformStatsResponse,
  GetFeaturedProjectsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function mapProject(p: typeof projectsTable.$inferSelect) {
  return {
    id: String(p.id),
    name: p.name,
    ticker: p.ticker,
    description: p.description,
    logoUrl: p.logoUrl ?? undefined,
    bannerUrl: p.bannerUrl ?? undefined,
    tokenAddress: p.tokenAddress ?? undefined,
    status: p.status,
    totalRaise: p.totalRaise,
    raisedAmount: p.raisedAmount,
    tokenPrice: p.tokenPrice,
    minAllocation: p.minAllocation ?? undefined,
    maxAllocation: p.maxAllocation ?? undefined,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    websiteUrl: p.websiteUrl ?? undefined,
    twitterUrl: p.twitterUrl ?? undefined,
    telegramUrl: p.telegramUrl ?? undefined,
    participants: p.participants,
    category: p.category,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/stats/platform", async (_req, res) => {
  const [projectCount] = await db.select({ count: count() }).from(projectsTable);
  const [liveCount] = await db.select({ count: count() }).from(projectsTable).where(eq(projectsTable.status, "live"));
  const [endedCount] = await db.select({ count: count() }).from(projectsTable).where(eq(projectsTable.status, "ended"));
  const [stakerCount] = await db.select({ count: count() }).from(stakingPositionsTable);
  const [totalStaked] = await db.select({ total: sum(stakingPositionsTable.amountStaked) }).from(stakingPositionsTable);
  const [totalRaised] = await db.select({ total: sum(projectsTable.raisedAmount) }).from(projectsTable);

  const totalLaunched = projectCount.count;
  const endedProjects = endedCount.count;

  const response = GetPlatformStatsResponse.parse({
    totalProjectsLaunched: totalLaunched,
    totalRaisedUsd: Number(totalRaised.total ?? 0),
    totalStakers: stakerCount.count,
    totalDpinoStaked: Number(totalStaked.total ?? 0),
    activeLaunches: liveCount.count,
    successRate: totalLaunched > 0 ? Math.round((endedProjects / totalLaunched) * 100) : 100,
  });

  res.json(response);
});

router.get("/stats/projects/featured", async (_req, res) => {
  const projects = await db.select().from(projectsTable)
    .where(eq(projectsTable.status, "live"))
    .orderBy(desc(projectsTable.raisedAmount))
    .limit(6);

  if (projects.length < 3) {
    const upcoming = await db.select().from(projectsTable)
      .where(eq(projectsTable.status, "upcoming"))
      .orderBy(desc(projectsTable.createdAt))
      .limit(6 - projects.length);
    projects.push(...upcoming);
  }

  const response = GetFeaturedProjectsResponse.parse(projects.map(mapProject));
  res.json(response);
});

export default router;
