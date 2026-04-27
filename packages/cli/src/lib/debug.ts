import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getDebugLogPath } from "./config.js";

export function debugLog(message: string, error?: unknown): void {
  if (process.env["MYTOOL_DEBUG"] !== "1") return;
  try {
    const path = getDebugLogPath();
    mkdirSync(dirname(path), { recursive: true });
    const timestamp = new Date().toISOString();
    let line = `[${timestamp}] ${message}`;
    if (error) {
      const errMsg = error instanceof Error ? error.stack ?? error.message : String(error);
      line += `\n  ${errMsg}`;
    }
    appendFileSync(path, line + "\n");
  } catch {
    // 로깅 실패는 무시 (절대 사용자 흐름 차단 안 함)
  }
}
