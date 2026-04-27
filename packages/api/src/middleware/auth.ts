import { createMiddleware } from "hono/factory";
import { prisma } from "../db.js";
import { hashToken, verifyJwt } from "../lib/jwt.js";
import { unauthorized } from "../lib/errors.js";

export interface AuthVariables {
  userId: string;
  userEmail: string;
}

declare module "hono" {
  interface ContextVariableMap extends AuthVariables {}
}

/**
 * Authorization: Bearer <jwt> 헤더를 검증합니다.
 * - JWT 서명 검증
 * - DB에서 토큰 revocation 체크
 * - 통과 시 c.set('userId', ...), c.set('userEmail', ...)
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw unauthorized("Missing Bearer token");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw unauthorized("Empty token");

  let payload;
  try {
    payload = await verifyJwt(token);
  } catch {
    throw unauthorized("Invalid or expired token");
  }

  // Revocation 체크
  const tokenHash = hashToken(token);
  const dbToken = await prisma.cliToken.findUnique({
    where: { tokenHash },
    select: { revokedAt: true, expiresAt: true },
  });
  if (dbToken?.revokedAt) {
    throw unauthorized("Token has been revoked");
  }
  if (dbToken && dbToken.expiresAt < new Date()) {
    throw unauthorized("Token has expired");
  }

  c.set("userId", payload.sub);
  c.set("userEmail", payload.email);
  await next();
});
