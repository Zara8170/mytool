/**
 * Claude 모델별 단가 (USD per 1M tokens)
 *
 * 가격 변동 시 이 파일만 업데이트하면 모든 비용 계산이 갱신됩니다.
 * Anthropic 공식 가격표: https://www.anthropic.com/pricing
 *
 * NOTE: 아래 단가는 예시이며 실제 가격을 반드시 공식 페이지에서 확인하고 갱신하세요.
 * Pro/Max 구독 사용자는 실제 지불액과 다를 수 있습니다 (정보용 추정치).
 */

export interface ModelPricing {
  /** 입력 토큰 단가 (USD per 1M tokens) */
  inputPerM: number;
  /** 출력 토큰 단가 */
  outputPerM: number;
  /** 캐시 쓰기 (cache creation) 단가 */
  cacheWritePerM: number;
  /** 캐시 읽기 단가 */
  cacheReadPerM: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-7": {
    inputPerM: 15.0,
    outputPerM: 75.0,
    cacheWritePerM: 18.75,
    cacheReadPerM: 1.5,
  },
  "claude-opus-4-6": {
    inputPerM: 15.0,
    outputPerM: 75.0,
    cacheWritePerM: 18.75,
    cacheReadPerM: 1.5,
  },
  "claude-sonnet-4-6": {
    inputPerM: 3.0,
    outputPerM: 15.0,
    cacheWritePerM: 3.75,
    cacheReadPerM: 0.3,
  },
  "claude-haiku-4-5": {
    inputPerM: 1.0,
    outputPerM: 5.0,
    cacheWritePerM: 1.25,
    cacheReadPerM: 0.1,
  },
  // 알 수 없는 모델은 sonnet 단가로 보수적으로 추정
  default: {
    inputPerM: 3.0,
    outputPerM: 15.0,
    cacheWritePerM: 3.75,
    cacheReadPerM: 0.3,
  },
};

/**
 * 토큰 사용량을 USD 비용으로 변환합니다.
 */
export function calculateCost(params: {
  model: string | null | undefined;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}): number {
  const pricing =
    (params.model && MODEL_PRICING[params.model]) || MODEL_PRICING["default"]!;

  const cost =
    (params.inputTokens * pricing.inputPerM +
      params.outputTokens * pricing.outputPerM +
      params.cacheCreationTokens * pricing.cacheWritePerM +
      params.cacheReadTokens * pricing.cacheReadPerM) /
    1_000_000;

  // 소수점 6자리로 반올림 (USD)
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * 모델명이 알려진 가격표에 있는지 확인합니다.
 * 알 수 없는 모델은 default 단가가 사용되며 부정확할 수 있습니다.
 */
export function isKnownModel(model: string | null | undefined): boolean {
  if (!model) return false;
  return model in MODEL_PRICING && model !== "default";
}
