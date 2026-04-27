import { NextResponse } from "next/server";
import { clearAuthToken, getAuthToken } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function POST(): Promise<NextResponse> {
  const token = await getAuthToken();
  if (token) {
    // best-effort: 서버에 revoke 요청
    await fetch(`${API_URL}/api/auth/session`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  await clearAuthToken();
  return NextResponse.json({ ok: true });
}
