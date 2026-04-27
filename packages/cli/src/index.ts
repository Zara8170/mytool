#!/usr/bin/env node
import { Command } from "commander";
import { mainCommand } from "./commands/main.js";
import { hookCommand } from "./commands/hook.js";
import { logoutCommand, statusCommand } from "./commands/status.js";

const program = new Command();

program
  .name("mytool")
  .description("Claude Code observability for individuals and small teams")
  .version("0.1.0")
  .option("--api-url <url>", "Override API URL (for self-hosting)");

// 메인 (인자 없이 호출): mytool
program.action(async (opts) => {
  await mainCommand({ apiUrl: opts.apiUrl });
});

// mytool hook (Claude Code가 호출, 사용자가 직접 쓰지 않음)
program
  .command("hook")
  .description("[internal] Process Claude Code hook event from stdin")
  .action(async () => {
    await hookCommand();
  });

// mytool status
program
  .command("status")
  .description("Show current authentication and project status")
  .action(async (_, cmd) => {
    const opts = cmd.optsWithGlobals();
    await statusCommand({ apiUrl: opts.apiUrl });
  });

// mytool logout
program
  .command("logout")
  .description("Log out and remove local credentials")
  .action(async (_, cmd) => {
    const opts = cmd.optsWithGlobals();
    await logoutCommand({ apiUrl: opts.apiUrl });
  });

program
  .parseAsync(process.argv)
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
