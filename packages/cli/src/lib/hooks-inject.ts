import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const HOOK_COMMAND = "mytool hook";
const HOOK_EVENTS = [
  "SessionStart",
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "SubagentStop",
] as const;

interface HookEntry {
  matcher?: string;
  hooks: Array<{
    type: string;
    command: string;
  }>;
}

interface ClaudeSettings {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

export type InjectResult = "injected" | "already_present" | "partially_injected";

/**
 * 프로젝트 루트의 .claude/settings.json에 mytool hook 명령을 추가합니다.
 *
 * 멱등성 보장:
 *   - 기존에 다른 hook이 등록돼 있어도 보존
 *   - 같은 command가 이미 있으면 중복 추가하지 않음
 *   - 일부 이벤트만 등록돼 있는 경우 누락된 것만 추가
 *
 * 안전성:
 *   - 유효하지 않은 JSON이면 에러 throw (사용자가 수동 수정한 경우 보호)
 *   - hooks 객체가 없으면 새로 생성
 *   - 다른 키(권한 설정 등)는 절대 건드리지 않음
 */
export function injectHooks(projectRoot: string): {
  result: InjectResult;
  settingsPath: string;
  addedEvents: string[];
} {
  const settingsPath = join(projectRoot, ".claude", "settings.json");
  let settings: ClaudeSettings = {};

  if (existsSync(settingsPath)) {
    const raw = readFileSync(settingsPath, "utf-8").trim();
    if (raw.length > 0) {
      try {
        settings = JSON.parse(raw) as ClaudeSettings;
      } catch (err) {
        throw new Error(
          `Failed to parse ${settingsPath}: ${(err as Error).message}\n` +
            `The file is not valid JSON. Please fix it manually before running mytool.`,
        );
      }
    }
  }

  if (!settings.hooks || typeof settings.hooks !== "object") {
    settings.hooks = {};
  }

  const addedEvents: string[] = [];

  for (const eventName of HOOK_EVENTS) {
    const existing = settings.hooks[eventName];
    const list: HookEntry[] = Array.isArray(existing) ? existing : [];

    const alreadyPresent = list.some((entry) =>
      entry.hooks?.some(
        (h) => h.type === "command" && h.command === HOOK_COMMAND,
      ),
    );

    if (alreadyPresent) continue;

    list.push({
      matcher: "",
      hooks: [{ type: "command", command: HOOK_COMMAND }],
    });
    settings.hooks[eventName] = list;
    addedEvents.push(eventName);
  }

  if (addedEvents.length === 0) {
    return { result: "already_present", settingsPath, addedEvents: [] };
  }

  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  const result: InjectResult =
    addedEvents.length === HOOK_EVENTS.length ? "injected" : "partially_injected";
  return { result, settingsPath, addedEvents };
}

/**
 * Hook이 설치되어 있는지만 검사 (수정하지 않음).
 */
export function checkHooksInstalled(projectRoot: string): {
  installed: boolean;
  installedEvents: string[];
  missingEvents: string[];
} {
  const settingsPath = join(projectRoot, ".claude", "settings.json");
  const installedEvents: string[] = [];
  const missingEvents: string[] = [];

  if (!existsSync(settingsPath)) {
    return { installed: false, installedEvents: [], missingEvents: [...HOOK_EVENTS] };
  }

  let settings: ClaudeSettings = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as ClaudeSettings;
  } catch {
    return {
      installed: false,
      installedEvents: [],
      missingEvents: [...HOOK_EVENTS],
    };
  }

  for (const eventName of HOOK_EVENTS) {
    const list = settings.hooks?.[eventName] ?? [];
    const present = list.some((entry) =>
      entry.hooks?.some(
        (h) => h.type === "command" && h.command === HOOK_COMMAND,
      ),
    );
    if (present) installedEvents.push(eventName);
    else missingEvents.push(eventName);
  }

  return {
    installed: installedEvents.length === HOOK_EVENTS.length,
    installedEvents,
    missingEvents,
  };
}
