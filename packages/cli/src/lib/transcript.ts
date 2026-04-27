import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Claude Code transcript.jsonl 파일의 한 줄.
 * 공식 스키마는 아니므로 알려진 필드만 안전하게 다룹니다.
 */
interface TranscriptLine {
  type?: string;
  message?: {
    role?: string;
    content?: unknown;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  content?: unknown;
  [key: string]: unknown;
}

const CONTENT_LIMIT = 50_000;

export interface TranscriptMessage {
  role: "human" | "assistant";
  content: string;
  timestamp: string;
}

/**
 * 현재 작업 디렉토리와 sessionId로 transcript 파일을 찾아 메시지 배열을 반환한다.
 * Claude Code는 ~/.claude/projects/{경로인코딩}/{sessionId}.jsonl 에 저장한다.
 * Windows: C:\git\personal\mytool → C--git-personal-mytool
 * Mac/Linux: /Users/foo/bar → -Users-foo-bar
 */
export function readTranscriptMessages(
  sessionId: string,
  cwd: string,
): TranscriptMessage[] {
  try {
    const projectHash = cwd.replace(/[:/\\]/g, "-");
    const transcriptPath = join(
      homedir(),
      ".claude",
      "projects",
      projectHash,
      `${sessionId}.jsonl`,
    );

    const lines = readTranscriptLines(transcriptPath);
    const messages: TranscriptMessage[] = [];

    for (const entry of lines) {
      if (entry.type !== "user" && entry.type !== "assistant") continue;

      const role: "human" | "assistant" =
        entry.type === "user" ? "human" : "assistant";
      const msg = entry.message;
      if (!msg) continue;

      // thinking 블록은 스킵하고 text 블록만 추출
      const content = extractTextContent(msg.content);
      if (!content) continue;

      const timestamp =
        typeof entry.timestamp === "string"
          ? (entry.timestamp as string)
          : new Date().toISOString();

      messages.push({
        role,
        content: content.slice(0, CONTENT_LIMIT),
        timestamp,
      });
    }
    return messages;
  } catch {
    return [];
  }
}

function extractTextContent(content: unknown): string | null {
  if (typeof content === "string") return content || null;
  if (Array.isArray(content)) {
    const parts = content
      .map((c: unknown) => {
        if (typeof c === "object" && c !== null) {
          const obj = c as Record<string, unknown>;
          if (obj.type === "text" && typeof obj.text === "string")
            return obj.text;
        }
        return null;
      })
      .filter((s): s is string => s !== null && s.length > 0);
    return parts.length > 0 ? parts.join("\n") : null;
  }
  return null;
}

export interface ExtractedUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string | null;
}

/**
 * transcript.jsonl을 줄 단위로 읽어 각 줄을 JSON 파싱.
 * 줄 단위 파싱 실패는 무시 (부분적으로 깨진 파일에 강건).
 */
function readTranscriptLines(transcriptPath: string): TranscriptLine[] {
  if (!existsSync(transcriptPath)) return [];

  let content: string;
  try {
    content = readFileSync(transcriptPath, "utf-8");
  } catch {
    return [];
  }

  const result: TranscriptLine[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      result.push(JSON.parse(line) as TranscriptLine);
    } catch {
      // 한 줄이 깨져도 다음 줄 진행
    }
  }
  return result;
}

/**
 * Stop / SubagentStop 이벤트에서 호출:
 * type === "assistant" 항목의 message.usage 합산.
 *
 * Claude Code transcript는 한 세션 내에서 여러 assistant turn을 가질 수 있고,
 * 각 turn마다 usage가 누적이 아닌 그 turn 단독 값입니다.
 *
 * 안전 가드: 알 수 없는 형식의 항목은 건너뛰기, 음수는 0으로 보정.
 */
export function extractUsageFromTranscript(
  transcriptPath: string,
): ExtractedUsage | null {
  const lines = readTranscriptLines(transcriptPath);
  if (lines.length === 0) return null;

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;
  let model: string | null = null;
  let foundAny = false;

  for (const line of lines) {
    if (line.type !== "assistant") continue;
    const usage = line.message?.usage;
    if (!usage) continue;

    foundAny = true;
    inputTokens += Math.max(0, usage.input_tokens ?? 0);
    outputTokens += Math.max(0, usage.output_tokens ?? 0);
    cacheCreationTokens += Math.max(0, usage.cache_creation_input_tokens ?? 0);
    cacheReadTokens += Math.max(0, usage.cache_read_input_tokens ?? 0);

    // 마지막으로 본 model을 사용 (대부분 세션 내내 동일)
    if (line.message?.model) model = line.message.model;
  }

  if (!foundAny) return null;
  return {
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    model,
  };
}

/**
 * SessionStart 이벤트에서 호출:
 * Slash 커맨드(`/commit` 등)는 Skill tool hook이 발화되지 않으므로,
 * transcript에서 별도로 감지해야 합니다.
 *
 * 두 가지 패턴 모두 시도:
 *   1. type === "queue-operation"이고 content가 "/"로 시작 (Argos가 발견한 패턴)
 *   2. 첫 user 메시지 content가 "/skill-name" 형태
 *
 * 반환: skill 이름 (e.g. "/commit" → "commit") 또는 null
 */
export function detectSlashCommand(transcriptPath: string): string | null {
  const lines = readTranscriptLines(transcriptPath);

  // 패턴 1: queue-operation
  const queueOp = lines.find(
    (l) =>
      l.type === "queue-operation" &&
      typeof l.content === "string" &&
      (l.content as string).startsWith("/"),
  );
  if (queueOp && typeof queueOp.content === "string") {
    return extractSkillName(queueOp.content);
  }

  // 패턴 2: 첫 user 메시지
  for (const line of lines) {
    if (line.type !== "user" && line.message?.role !== "user") continue;
    const content = extractFirstTextContent(line);
    if (content?.startsWith("/")) {
      return extractSkillName(content);
    }
    break; // 첫 user 메시지만 검사
  }

  return null;
}

/**
 * "/commit -m foo" → "commit"
 */
function extractSkillName(input: string): string | null {
  const trimmed = input.replace(/^\//, "").trim();
  if (!trimmed) return null;
  const firstWord = trimmed.split(/\s/)[0];
  return firstWord || null;
}

/**
 * line.message.content가 array of blocks 또는 string일 수 있음.
 * 첫 text 블록의 텍스트 반환.
 */
function extractFirstTextContent(line: TranscriptLine): string | null {
  const c = line.message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    for (const block of c) {
      if (
        block &&
        typeof block === "object" &&
        "type" in block &&
        (block as { type: unknown }).type === "text" &&
        "text" in block &&
        typeof (block as { text: unknown }).text === "string"
      ) {
        return (block as { text: string }).text;
      }
    }
  }
  return null;
}
