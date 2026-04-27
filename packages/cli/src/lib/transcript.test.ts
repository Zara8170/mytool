import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectSlashCommand, extractUsageFromTranscript } from "./transcript.js";

describe("extractUsageFromTranscript", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "mytool-trans-test-"));
  });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  function writeTranscript(lines: object[]): string {
    const path = join(tmpDir, "transcript.jsonl");
    writeFileSync(path, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    return path;
  }

  it("returns null when file does not exist", () => {
    expect(extractUsageFromTranscript("/nonexistent/path.jsonl")).toBeNull();
  });

  it("returns null when no assistant entries", () => {
    const path = writeTranscript([
      { type: "user", message: { role: "user", content: "hi" } },
    ]);
    expect(extractUsageFromTranscript(path)).toBeNull();
  });

  it("sums usage across multiple assistant turns", () => {
    const path = writeTranscript([
      { type: "user", message: { role: "user", content: "hi" } },
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-6",
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 200,
            cache_read_input_tokens: 0,
          },
        },
      },
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-6",
          usage: {
            input_tokens: 30,
            output_tokens: 20,
            cache_read_input_tokens: 200,
          },
        },
      },
    ]);

    const usage = extractUsageFromTranscript(path);
    expect(usage).toEqual({
      inputTokens: 130,
      outputTokens: 70,
      cacheCreationTokens: 200,
      cacheReadTokens: 200,
      model: "claude-sonnet-4-6",
    });
  });

  it("ignores broken JSON lines and continues", () => {
    const path = writeTranscript([
      {
        type: "assistant",
        message: { usage: { input_tokens: 10, output_tokens: 5 } },
      },
    ]);
    // 손상된 줄 추가
    writeFileSync(path, "not-valid-json\n", { flag: "a" });
    writeFileSync(
      path,
      JSON.stringify({
        type: "assistant",
        message: { usage: { input_tokens: 20, output_tokens: 10 } },
      }) + "\n",
      { flag: "a" },
    );

    const usage = extractUsageFromTranscript(path);
    expect(usage?.inputTokens).toBe(30);
    expect(usage?.outputTokens).toBe(15);
  });

  it("clamps negative usage values to 0", () => {
    const path = writeTranscript([
      {
        type: "assistant",
        message: { usage: { input_tokens: -5, output_tokens: 10 } },
      },
    ]);
    const usage = extractUsageFromTranscript(path);
    expect(usage?.inputTokens).toBe(0);
    expect(usage?.outputTokens).toBe(10);
  });
});

describe("detectSlashCommand", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "mytool-slash-test-"));
  });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  function writeTranscript(lines: object[]): string {
    const path = join(tmpDir, "transcript.jsonl");
    writeFileSync(path, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    return path;
  }

  it("detects via queue-operation", () => {
    const path = writeTranscript([
      { type: "queue-operation", content: "/commit" },
      { type: "assistant", message: { content: "..." } },
    ]);
    expect(detectSlashCommand(path)).toBe("commit");
  });

  it("detects via first user message text content", () => {
    const path = writeTranscript([
      {
        type: "user",
        message: { role: "user", content: "/refactor src/api" },
      },
    ]);
    expect(detectSlashCommand(path)).toBe("refactor");
  });

  it("returns null when first user message is not a slash command", () => {
    const path = writeTranscript([
      {
        type: "user",
        message: { role: "user", content: "hello world" },
      },
    ]);
    expect(detectSlashCommand(path)).toBeNull();
  });

  it("handles content as array of blocks", () => {
    const path = writeTranscript([
      {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "text", text: "/test foo" }],
        },
      },
    ]);
    expect(detectSlashCommand(path)).toBe("test");
  });
});
