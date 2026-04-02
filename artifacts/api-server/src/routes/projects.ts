import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  ListProjectsQueryParams,
  CreateProjectBody,
  GetProjectParams,
  GetProjectResponse,
  ListProjectsResponse,
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

router.get("/projects", async (req, res) => {
  const parsed = ListProjectsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: "Invalid query params" });
    return;
  }

  const { status } = parsed.data;
  let projects;

  if (status && status !== "all") {
    projects = await db.select().from(projectsTable).where(eq(projectsTable.status, status as "upcoming" | "live" | "ended")).orderBy(desc(projectsTable.createdAt));
  } else {
    projects = await db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt));
  }

  const response = ListProjectsResponse.parse(projects.map(mapProject));
  res.json(response);
});

router.post("/projects", async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [project] = await db.insert(projectsTable).values({
    name: data.name,
    ticker: data.ticker,
    description: data.description,
    tokenAddress: data.tokenAddress,
    totalRaise: data.totalRaise,
    raisedAmount: 0,
    tokenPrice: data.tokenPrice,
    minAllocation: data.minAllocation,
    maxAllocation: data.maxAllocation,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
    websiteUrl: data.websiteUrl,
    twitterUrl: data.twitterUrl,
    telegramUrl: data.telegramUrl,
    category: data.category,
    participants: 0,
    status: "upcoming",
  }).returning();

  const response = GetProjectResponse.parse(mapProject(project));
  res.status(201).json(response);
});

router.get("/projects/:id", async (req, res) => {
  const parsed = GetProjectParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: "Invalid params" });
    return;
  }

  const id = parseInt(parsed.data.id, 10);
  if (isNaN(id)) {
    res.status(404).json({ error: "not_found", message: "Project not found" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "not_found", message: "Project not found" });
    return;
  }

  const response = GetProjectResponse.parse(mapProject(project));
  res.json(response);
});

export default router;
