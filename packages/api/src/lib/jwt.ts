import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "../env.js";

const ISSUER = "mytool";
const AUDIENCE = "mytool-cli-web";
const JWT_EXPIRY_DAYS = 365;

export interface JwtPayload {
  sub: string; // userId
  email: string;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return await new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${JWT_EXPIRY_DAYS}d`)
    .sign(getSecretKey());
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("Invalid JWT payload");
  }
  return { sub: payload.sub, email: payload.email };
}

/**
 * JWT의 SHA-256 해시. CliToken 테이블에는 평문 토큰 대신 이 해시만 저장.
 * Revocation 체크 시 평문 토큰 → 해시 → DB 조회.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function jwtExpiresAt(): Date {
  const date = new Date();
  date.setDate(date.getDate() + JWT_EXPIRY_DAYS);
  return date;
}
