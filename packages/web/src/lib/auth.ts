import { cookies } from "next/headers";

const TOKEN_COOKIE = "mytool_token";
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1년

/**
 * 서버 컴포넌트나 라우트 핸들러에서 현재 사용자 토큰 조회.
 */
export async function getAuthToken(): Promise<string | null> {
  const c = await cookies();
  return c.get(TOKEN_COOKIE)?.value ?? null;
}

/**
 * 라우트 핸들러에서 로그인 후 호출.
 * httpOnly + Secure(prod) + SameSite=Lax 쿠키에 JWT 저장.
 */
export async function setAuthToken(token: string): Promise<void> {
  const c = await cookies();
  c.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearAuthToken(): Promise<void> {
  const c = await cookies();
  c.delete(TOKEN_COOKIE);
}
