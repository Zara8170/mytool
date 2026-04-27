import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import bcrypt from "bcrypt";
import {
  AuthResponseSchema,
  LoginRequestSchema,
  MeResponseSchema,
  RegisterRequestSchema,
} from "@mytool/shared";
import { prisma } from "../db.js";
import { hashToken, jwtExpiresAt, signJwt } from "../lib/jwt.js";
import { conflict, unauthorized } from "../lib/errors.js";
import { authMiddleware } from "../middleware/auth.js";

const BCRYPT_ROUNDS = 12;

export const authRoute = new Hono();

/**
 * POST /api/auth/register
 * 새 사용자 생성. 첫 사용자에게는 자동으로 개인 organization 생성.
 */
authRoute.post(
  "/register",
  zValidator("json", RegisterRequestSchema),
  async (c) => {
    const { email, password, name } = c.req.valid("json");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict("Email already registered");

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 사용자 생성과 동시에 개인 org 생성 (혼자 쓸 때도 동작하게)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name ?? null,
        memberships: {
          create: {
            role: "OWNER",
            org: {
              create: {
                name: name ?? email.split("@")[0]!,
                slug: generateUniqueSlug(email),
              },
            },
          },
        },
      },
    });

    const token = await signJwt({ sub: user.id, email: user.email });
    await prisma.cliToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: jwtExpiresAt(),
      },
    });

    const response = AuthResponseSchema.parse({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
    return c.json(response, 201);
  },
);

/**
 * POST /api/auth/login
 * 이메일·비밀번호로 JWT 발급.
 */
authRoute.post(
  "/login",
  zValidator("json", LoginRequestSchema),
  async (c) => {
    const { email, password } = c.req.valid("json");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw unauthorized("Invalid email or password");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw unauthorized("Invalid email or password");

    const token = await signJwt({ sub: user.id, email: user.email });
    await prisma.cliToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: jwtExpiresAt(),
      },
    });

    const response = AuthResponseSchema.parse({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
    return c.json(response);
  },
);

/**
 * DELETE /api/auth/session
 * 현재 토큰 revoke (logout).
 */
authRoute.delete("/session", authMiddleware, async (c) => {
  const authHeader = c.req.header("Authorization")!;
  const token = authHeader.slice("Bearer ".length).trim();
  await prisma.cliToken.update({
    where: { tokenHash: hashToken(token) },
    data: { revokedAt: new Date() },
  });
  return c.json({ ok: true });
});

/**
 * GET /api/auth/me
 * 현재 사용자 정보 + 소속 조직 목록.
 */
authRoute.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { org: true },
      },
    },
  });
  if (!user) throw unauthorized();

  const response = MeResponseSchema.parse({
    id: user.id,
    email: user.email,
    name: user.name,
    organizations: user.memberships.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      slug: m.org.slug,
      role: m.role,
    })),
  });
  return c.json(response);
});

// 개인 org slug 생성 헬퍼 — 충돌 시 숫자 suffix 추가
function generateUniqueSlug(email: string): string {
  const base = email
    .split("@")[0]!
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return `${base || "user"}-${Date.now().toString(36)}`;
}
