import { Hono } from "hono";
import { prisma } from "../db.js";

export const healthRoute = new Hono();

healthRoute.get("/", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ status: "ok", db: "connected" });
  } catch (err) {
    return c.json(
      { status: "degraded", db: "error", message: (err as Error).message },
      503,
    );
  }
});
