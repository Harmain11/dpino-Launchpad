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
    logoUrl: (data as any).logoUrl,
    bannerUrl: (data as any).bannerUrl,
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

router.put("/projects/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid project ID" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const ALLOWED_STATUSES = ["upcoming", "live", "ended"];
  const updateFields: Partial<typeof projectsTable.$inferInsert> = {};

  if (body.status !== undefined) {
    if (!ALLOWED_STATUSES.includes(body.status as string)) {
      res.status(400).json({ error: "bad_request", message: "Invalid status value" });
      return;
    }
    updateFields.status = body.status as "upcoming" | "live" | "ended";
  }
  if (body.name !== undefined)         updateFields.name = String(body.name);
  if (body.description !== undefined)  updateFields.description = String(body.description);
  if (body.category !== undefined)     updateFields.category = String(body.category);
  if (body.totalRaise !== undefined)   updateFields.totalRaise = Number(body.totalRaise);
  if (body.tokenPrice !== undefined)   updateFields.tokenPrice = Number(body.tokenPrice);
  if (body.raisedAmount !== undefined) updateFields.raisedAmount = Number(body.raisedAmount);
  if (body.participants !== undefined) updateFields.participants = Number(body.participants);
  if ("minAllocation" in body) updateFields.minAllocation = body.minAllocation != null ? Number(body.minAllocation) : null as unknown as undefined;
  if ("maxAllocation" in body) updateFields.maxAllocation = body.maxAllocation != null ? Number(body.maxAllocation) : null as unknown as undefined;
  if ("tokenAddress" in body) updateFields.tokenAddress = body.tokenAddress as string | null as unknown as undefined;
  if ("logoUrl" in body)      updateFields.logoUrl      = body.logoUrl as string | null as unknown as undefined;
  if ("bannerUrl" in body)    updateFields.bannerUrl    = body.bannerUrl as string | null as unknown as undefined;
  if ("websiteUrl" in body)   updateFields.websiteUrl   = body.websiteUrl as string | null as unknown as undefined;
  if ("twitterUrl" in body)   updateFields.twitterUrl   = body.twitterUrl as string | null as unknown as undefined;
  if ("telegramUrl" in body)  updateFields.telegramUrl  = body.telegramUrl as string | null as unknown as undefined;
  if (body.startDate !== undefined) updateFields.startDate = new Date(String(body.startDate));
  if (body.endDate !== undefined)   updateFields.endDate   = new Date(String(body.endDate));

  if (Object.keys(updateFields).length === 0) {
    res.status(400).json({ error: "bad_request", message: "No updatable fields provided" });
    return;
  }

  const [project] = await db.update(projectsTable)
    .set(updateFields)
    .where(eq(projectsTable.id, id))
    .returning();

  if (!project) {
    res.status(404).json({ error: "not_found", message: "Project not found" });
    return;
  }

  res.json(mapProject(project));
});

router.delete("/projects/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid project ID" });
    return;
  }

  const [deleted] = await db.delete(projectsTable).where(eq(projectsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "not_found", message: "Project not found" });
    return;
  }

  res.json({ success: true, id: String(id) });
});

export default router;
