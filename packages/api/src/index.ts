import { serve } from "@hono/node-server";
import { buildApp } from "./app.js";
import { getEnv } from "./env.js";

const env = getEnv();
const app = buildApp();

const port = env.PORT;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 mytool API listening on http://localhost:${info.port}`);
  console.log(`   NODE_ENV=${env.NODE_ENV}`);
  console.log(`   WEB_URL=${env.WEB_URL}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, exiting...");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("SIGINT received, exiting...");
  process.exit(0);
});
