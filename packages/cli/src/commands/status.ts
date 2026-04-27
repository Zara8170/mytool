import chalk from "chalk";
import { existsSync, unlinkSync } from "node:fs";
import { api } from "../lib/api-client.js";
import {
  getConfigPath,
  readConfig,
  resolveApiUrl,
} from "../lib/config.js";
import { checkHooksInstalled } from "../lib/hooks-inject.js";
import { findProjectConfig } from "../lib/project.js";

export async function statusCommand(opts: { apiUrl?: string }): Promise<void> {
  const config = readConfig();
  const projectInfo = findProjectConfig(process.cwd());
  const apiUrl = resolveApiUrl(
    opts.apiUrl,
    projectInfo?.config.apiUrl,
    config?.apiUrl,
  );

  console.log(chalk.bold("mytool status"));
  console.log();

  // Auth
  if (config) {
    console.log(chalk.green("✓"), "Logged in as", chalk.cyan(config.user.email));
  } else {
    console.log(chalk.red("✗"), "Not logged in");
  }

  // Project config
  if (projectInfo) {
    console.log(
      chalk.green("✓"),
      "Project config:",
      chalk.cyan(projectInfo.configDir + "/.mytool/project.json"),
    );
    console.log("    projectId:", projectInfo.config.projectId);
    console.log("    orgId:    ", projectInfo.config.orgId);

    const hooks = checkHooksInstalled(projectInfo.configDir);
    if (hooks.installed) {
      console.log(chalk.green("✓"), "All hooks installed");
    } else if (hooks.installedEvents.length > 0) {
      console.log(
        chalk.yellow("⚠"),
        `Hooks partially installed (missing: ${hooks.missingEvents.join(", ")})`,
      );
      console.log("    Run", chalk.bold("mytool"), "to fix");
    } else {
      console.log(
        chalk.red("✗"),
        "Hooks not installed in .claude/settings.json",
      );
      console.log("    Run", chalk.bold("mytool"), "to install");
    }
  } else {
    console.log(chalk.yellow("⚠"), "No .mytool/project.json found in current dir or ancestors");
  }

  // API
  console.log();
  console.log("API URL:", chalk.cyan(apiUrl));
  if (config) {
    process.stdout.write("API connectivity: ");
    try {
      const me = await api.me(apiUrl, config.token);
      console.log(chalk.green("✓"), `connected (${me.organizations.length} orgs)`);
    } catch (err) {
      console.log(chalk.red("✗"), "failed");
      console.log("   ", err instanceof Error ? err.message : String(err));
    }
  }
}

export async function logoutCommand(opts: { apiUrl?: string }): Promise<void> {
  const config = readConfig();
  if (!config) {
    console.log("Not logged in.");
    return;
  }
  const apiUrl = resolveApiUrl(opts.apiUrl, undefined, config.apiUrl);

  // Best-effort: 서버에 revoke 요청. 실패해도 로컬 토큰은 삭제.
  try {
    await api.logout(apiUrl, config.token);
  } catch {
    // 무시
  }

  const path = getConfigPath();
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      // ignore
    }
  }
  console.log(chalk.green("✓"), "Logged out and removed local credentials.");
}
