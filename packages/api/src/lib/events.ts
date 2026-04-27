import { TRUNCATION_LIMITS, truncate } from "@mytool/shared";

export interface ParsedEventDerivations {
  isSkillCall: boolean;
  skillName: string | null;
  isAgentCall: boolean;
  agentType: string | null;
  agentDesc: string | null;
}

/**
 * tool_name + tool_input(JSON 문자열)에서 파생 필드 추출.
 * Skill 호출: tool_name === "Skill", input.skill 에서 이름 추출
 * Agent 호출: tool_name === "Agent", input.subagent_type / description
 */
export function parseEventDerivations(
  toolName: string | null | undefined,
  toolInputJson: string | null | undefined,
): ParsedEventDerivations {
  const result: ParsedEventDerivations = {
    isSkillCall: false,
    skillName: null,
    isAgentCall: false,
    agentType: null,
    agentDesc: null,
  };

  if (!toolName) return result;

  let parsedInput: Record<string, unknown> | null = null;
  if (toolInputJson) {
    try {
      const v = JSON.parse(toolInputJson);
      if (v && typeof v === "object") parsedInput = v as Record<string, unknown>;
    } catch {
      // 무시 — 파생 필드 추출만 실패할 뿐 전체 흐름은 진행
    }
  }

  if (toolName === "Skill") {
    result.isSkillCall = true;
    if (parsedInput && typeof parsedInput["skill"] === "string") {
      result.skillName = parsedInput["skill"] as string;
    }
  } else if (toolName === "Agent" || toolName === "Task") {
    // Anthropic이 도구명을 변경한 케이스를 대비해 Task도 포함
    result.isAgentCall = true;
    if (parsedInput && typeof parsedInput["subagent_type"] === "string") {
      result.agentType = parsedInput["subagent_type"] as string;
    }
    if (parsedInput && typeof parsedInput["description"] === "string") {
      result.agentDesc = (parsedInput["description"] as string).slice(0, 500);
    }
  }

  return result;
}

/**
 * 도구 페이로드(JSON 문자열)를 안전한 길이로 잘라냄.
 */
export function truncateToolPayload(s: string | null | undefined): string | null {
  if (!s) return null;
  return truncate(s, TRUNCATION_LIMITS.toolPayload);
}
