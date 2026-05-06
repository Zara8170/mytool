import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/db";
import { signJwt, hashToken, tokenExpiresAt } from "@/lib/jwt";
import { handleRouteError, conflict } from "@/lib/api-errors";

const BCRYPT_ROUNDS = 12;

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  kind: z.enum(["web", "cli"]).optional().default("cli"),
});

function generateUniqueSlug(email: string): string {
  const base = email
    .split("@")[0]!
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return `${base || "user"}-${Date.now().toString(36)}`;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    let body;
    try {
      body = BodySchema.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw conflict("Email already registered");

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        name: body.name ?? null,
        memberships: {
          create: {
            role: "OWNER",
            org: {
              create: {
                name: body.name ?? body.email.split("@")[0]!,
                slug: generateUniqueSlug(body.email),
              },
            },
          },
        },
      },
    });

    const kind = body.kind;
    const token = await signJwt({ sub: user.id, email: user.email, kind });
    const expiresAt = tokenExpiresAt(kind);

    await prisma.cliToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        kind: kind === "cli" ? "CLI" : "WEB",
        label: "CLI",
        expiresAt,
      },
    });

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      kind,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
