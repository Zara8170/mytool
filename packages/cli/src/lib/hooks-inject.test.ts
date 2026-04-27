import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkHooksInstalled, injectHooks } from "./hooks-inject.js";

describe("injectHooks", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "mytool-hook-test-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates settings.json from scratch with all 5 hook events", () => {
    const result = injectHooks(tmpDir);
    expect(result.result).toBe("injected");
    expect(result.addedEvents).toHaveLength(5);

    const settings = JSON.parse(
      readFileSync(join(tmpDir, ".claude", "settings.json"), "utf-8"),
    );
    expect(Object.keys(settings.hooks)).toEqual(
      expect.arrayContaining([
        "SessionStart",
        "PreToolUse",
        "PostToolUse",
        "Stop",
        "SubagentStop",
      ]),
    );
  });

  it("is idempotent — running twice does not duplicate", () => {
    injectHooks(tmpDir);
    const second = injectHooks(tmpDir);
    expect(second.result).toBe("already_present");
    expect(second.addedEvents).toHaveLength(0);

    const settings = JSON.parse(
      readFileSync(join(tmpDir, ".claude", "settings.json"), "utf-8"),
    );
    // 한 이벤트당 정확히 1개의 mytool entry만 있어야 함
    for (const eventName of Object.keys(settings.hooks)) {
      const entries = settings.hooks[eventName] as Array<{
        hooks: Array<{ command: string }>;
      }>;
      const mytoolEntries = entries.filter((e) =>
        e.hooks?.some((h) => h.command === "mytool hook"),
      );
      expect(mytoolEntries).toHaveLength(1);
    }
  });

  it("preserves existing user hooks for the same event", () => {
    mkdirSync(join(tmpDir, ".claude"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude", "settings.json"),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo before-bash" }],
            },
          ],
        },
        permissions: { allow: ["Bash(npm:*)"] },
      }),
    );

    injectHooks(tmpDir);

    const settings = JSON.parse(
      readFileSync(join(tmpDir, ".claude", "settings.json"), "utf-8"),
    );
    // 기존 user hook 보존
    expect(settings.hooks.PreToolUse).toContainEqual(
      expect.objectContaining({
        matcher: "Bash",
        hooks: [{ type: "command", command: "echo before-bash" }],
      }),
    );
    // mytool hook 추가됨
    expect(settings.hooks.PreToolUse).toContainEqual(
      expect.objectContaining({
        hooks: [{ type: "command", command: "mytool hook" }],
      }),
    );
    // 다른 키 (permissions) 절대 건드리지 않음
    expect(settings.permissions).toEqual({ allow: ["Bash(npm:*)"] });
  });

  it("only adds missing events when partially installed", () => {
    mkdirSync(join(tmpDir, ".claude"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude", "settings.json"),
      JSON.stringify({
        hooks: {
          // SessionStart, Stop만 미리 mytool hook이 들어있는 상태
          SessionStart: [
            { matcher: "", hooks: [{ type: "command", command: "mytool hook" }] },
          ],
          Stop: [
            { matcher: "", hooks: [{ type: "command", command: "mytool hook" }] },
          ],
        },
      }),
    );

    const result = injectHooks(tmpDir);
    expect(result.result).toBe("partially_injected");
    // 누락된 3개만 추가됨
    expect(result.addedEvents).toHaveLength(3);
    expect(result.addedEvents).toEqual(
      expect.arrayContaining(["PreToolUse", "PostToolUse", "SubagentStop"]),
    );
  });

  it("throws on invalid existing JSON instead of silently overwriting", () => {
    mkdirSync(join(tmpDir, ".claude"), { recursive: true });
    writeFileSync(join(tmpDir, ".claude", "settings.json"), "{ broken json");

    expect(() => injectHooks(tmpDir)).toThrow(/not valid JSON/);
  });
});

describe("checkHooksInstalled", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "mytool-check-test-"));
  });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it("reports not-installed when settings.json missing", () => {
    const r = checkHooksInstalled(tmpDir);
    expect(r.installed).toBe(false);
    expect(r.installedEvents).toHaveLength(0);
    expect(r.missingEvents).toHaveLength(5);
  });

  it("reports installed after injectHooks", () => {
    injectHooks(tmpDir);
    const r = checkHooksInstalled(tmpDir);
    expect(r.installed).toBe(true);
    expect(r.missingEvents).toHaveLength(0);
  });
});
