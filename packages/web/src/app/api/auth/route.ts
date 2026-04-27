import { NextResponse } from "next/server";
import { z } from "zod";
import { setAuthToken } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

const BodySchema = z.object({
  mode: z.enum(["login", "register"]),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  let body;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid input" },
      { status: 400 },
    );
  }

  const path = body.mode === "login" ? "/api/auth/login" : "/api/auth/register";
  const apiRes = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      ...(body.mode === "register" && body.name ? { name: body.name } : {}),
    }),
  });

  if (!apiRes.ok) {
    const errBody = (await apiRes
      .json()
      .catch(() => ({ error: { message: "Authentication failed" } }))) as {
      error?: { message?: string };
    };
    return NextResponse.json(
      { error: errBody.error?.message ?? "Authentication failed" },
      { status: apiRes.status },
    );
  }

  const data = (await apiRes.json()) as {
    token: string;
    user: { id: string; email: string; name: string | null };
  };

  await setAuthToken(data.token);
  return NextResponse.json({ ok: true, user: data.user });
}
