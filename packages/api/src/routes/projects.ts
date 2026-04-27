import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { CreateProjectSchema } from "@mytool/shared";
import { prisma } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { conflict, forbidden, notFound } from "../lib/errors.js";

export const projectsRoute = new Hono();
projectsRoute.use("*", authMiddleware);

/**
 * POST /api/projects
 */
projectsRoute.post(
  "/",
  zValidator("json", CreateProjectSchema),
  async (c) => {
    const userId = c.get("userId");
    const { orgId, name, slug } = c.req.valid("json");

    // 사용자가 해당 org의 멤버인지 확인
    const membership = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (!membership) throw forbidden("Not a member of this organization");

    // slug 중복 체크 (org 내)
    const existing = await prisma.project.findUnique({
      where: { orgId_slug: { orgId, slug } },
    });
    if (existing) throw conflict("Project slug already exists in this organization");

    const project = await prisma.project.create({
      data: { orgId, name, slug },
    });

    return c.json(
      {
        id: project.id,
        orgId: project.orgId,
        name: project.name,
        slug: project.slug,
        createdAt: project.createdAt.toISOString(),
      },
      201,
    );
  },
);

/**
 * GET /api/projects/:projectId
 */
projectsRoute.get("/:projectId", async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, orgId: true, name: true, slug: true, createdAt: true },
  });
  if (!project) throw notFound("Project not found");

  // org 멤버십 확인
  const membership = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId, orgId: project.orgId } },
  });
  if (!membership) throw forbidden("Not a member of this project's organization");

  return c.json({
    id: project.id,
    orgId: project.orgId,
    name: project.name,
    slug: project.slug,
    createdAt: project.createdAt.toISOString(),
  });
});
