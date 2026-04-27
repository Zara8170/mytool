import { describe, expect, it } from "vitest";
import { parseEventDerivations, truncateToolPayload } from "./events.js";

describe("parseEventDerivations", () => {
  it("returns all-false when no toolName", () => {
    const r = parseEventDerivations(null, null);
    expect(r.isSkillCall).toBe(false);
    expect(r.isAgentCall).toBe(false);
  });

  it("detects Skill tool call and extracts skillName", () => {
    const r = parseEventDerivations(
      "Skill",
      JSON.stringify({ skill: "commit", args: "-m fix" }),
    );
    expect(r.isSkillCall).toBe(true);
    expect(r.skillName).toBe("commit");
    expect(r.isAgentCall).toBe(false);
  });

  it("detects Agent tool call with subagent_type and description", () => {
    const r = parseEventDerivations(
      "Agent",
      JSON.stringify({
        subagent_type: "general-purpose",
        description: "Audit the branch",
        prompt: "very long prompt...",
      }),
    );
    expect(r.isAgentCall).toBe(true);
    expect(r.agentType).toBe("general-purpose");
    expect(r.agentDesc).toBe("Audit the branch");
  });

  it("also recognizes 'Task' as an agent call (alias)", () => {
    const r = parseEventDerivations(
      "Task",
      JSON.stringify({ subagent_type: "researcher" }),
    );
    expect(r.isAgentCall).toBe(true);
    expect(r.agentType).toBe("researcher");
  });

  it("regular tool (Bash) yields no derived flags", () => {
    const r = parseEventDerivations("Bash", JSON.stringify({ command: "ls" }));
    expect(r.isSkillCall).toBe(false);
    expect(r.isAgentCall).toBe(false);
  });

  it("does not throw on malformed JSON input", () => {
    const r = parseEventDerivations("Skill", "{not-json");
    expect(r.isSkillCall).toBe(true);
    expect(r.skillName).toBeNull();
  });

  it("truncates very long agent descriptions", () => {
    const longDesc = "x".repeat(1000);
    const r = parseEventDerivations(
      "Agent",
      JSON.stringify({ subagent_type: "x", description: longDesc }),
    );
    expect(r.agentDesc?.length).toBe(500);
  });
});

describe("truncateToolPayload", () => {
  it("returns null for null/undefined", () => {
    expect(truncateToolPayload(null)).toBeNull();
    expect(truncateToolPayload(undefined)).toBeNull();
  });

  it("preserves short strings", () => {
    expect(truncateToolPayload("hello")).toBe("hello");
  });

  it("truncates long strings to limit", () => {
    const long = "a".repeat(3000);
    const result = truncateToolPayload(long);
    expect(result?.length).toBeLessThanOrEqual(2000);
    expect(result?.endsWith("...[truncated]")).toBe(true);
  });
});
