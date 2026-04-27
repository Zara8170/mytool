import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { CreateOrgSchema } from "@mytool/shared";
import { prisma } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { conflict, forbidden, notFound } from "../lib/errors.js";

export const orgsRoute = new Hono();
orgsRoute.use("*", authMiddleware);

/**
 * POST /api/orgs
 * 새 조직 생성. 생성자는 OWNER가 됨.
 */
orgsRoute.post("/", zValidator("json", CreateOrgSchema), async (c) => {
  const userId = c.get("userId");
  const { name, slug } = c.req.valid("json");

  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) throw conflict("Slug already taken");

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      members: {
        create: { userId, role: "OWNER" },
      },
    },
  });

  return c.json(
    {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt.toISOString(),
    },
    201,
  );
});

/**
 * GET /api/orgs/:orgId
 */
orgsRoute.get("/:orgId", async (c) => {
  const userId = c.get("userId");
  const orgId = c.req.param("orgId");

  await assertOrgMembership(userId, orgId);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      _count: { select: { members: true, projects: true } },
    },
  });
  if (!org) throw notFound("Organization not found");

  return c.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    memberCount: org._count.members,
    projectCount: org._count.projects,
    createdAt: org.createdAt.toISOString(),
  });
});

/**
 * POST /api/orgs/:orgId/members
 * 기존 project.json을 가진 사용자가 org에 합류할 때 사용.
 * 보안: invite 시스템이 추가될 때까지는 누구나 자유롭게 가입할 수 있게 두지 않음.
 *      현재 MVP에서는 같은 프로젝트의 OWNER가 invite한 경우만 허용해야 하지만,
 *      간단히 시작하기 위해 본인이 OWNER인 org에는 가입 가능하도록 처리.
 *      (개인 사용 시에는 회원가입 시 자동 생성된 본인 org만 사용함)
 */
orgsRoute.post("/:orgId/members", async (c) => {
  const userId = c.get("userId");
  const orgId = c.req.param("orgId");

  const existing = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (existing) return c.json({ ok: true });

  // MVP: invite 토큰 시스템이 없으므로, 합류 가능 여부를 막고 메시지만 안내
  throw forbidden(
    "Joining an existing organization requires an invite (not yet implemented). " +
      "Use your own organization for now.",
  );
});

/**
 * GET /api/orgs/:orgId/projects
 */
orgsRoute.get("/:orgId/projects", async (c) => {
  const userId = c.get("userId");
  const orgId = c.req.param("orgId");
  await assertOrgMembership(userId, orgId);

  const projects = await prisma.project.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  return c.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

async function assertOrgMembership(userId: string, orgId: string) {
  const membership = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!membership) throw forbidden("Not a member of this organization");
}
