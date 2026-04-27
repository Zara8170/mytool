import { describe, expect, it } from "vitest";
import { calculateCost, isKnownModel, MODEL_PRICING } from "./pricing.js";

describe("calculateCost", () => {
  it("returns 0 for zero usage", () => {
    expect(
      calculateCost({
        model: "claude-sonnet-4-6",
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      }),
    ).toBe(0);
  });

  it("calculates cost using sonnet pricing for 1M input + 1M output", () => {
    const cost = calculateCost({
      model: "claude-sonnet-4-6",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });
    // 3 + 15 = $18
    expect(cost).toBe(18);
  });

  it("uses default pricing when model is unknown", () => {
    const cost = calculateCost({
      model: "claude-totally-fake-model",
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });
    expect(cost).toBe(MODEL_PRICING["default"]!.inputPerM);
  });

  it("uses default pricing when model is null", () => {
    const cost = calculateCost({
      model: null,
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });
    expect(cost).toBe(MODEL_PRICING["default"]!.inputPerM);
  });

  it("includes cache write and cache read separately", () => {
    const cost = calculateCost({
      model: "claude-sonnet-4-6",
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 1_000_000, // 3.75
      cacheReadTokens: 1_000_000, // 0.30
    });
    expect(cost).toBe(4.05);
  });

  it("rounds to 6 decimal places", () => {
    const cost = calculateCost({
      model: "claude-sonnet-4-6",
      inputTokens: 1,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });
    // 3 / 1_000_000 = 0.000003
    expect(cost).toBe(0.000003);
  });
});

describe("isKnownModel", () => {
  it("returns true for known models", () => {
    expect(isKnownModel("claude-sonnet-4-6")).toBe(true);
    expect(isKnownModel("claude-opus-4-7")).toBe(true);
  });

  it("returns false for default and unknowns", () => {
    expect(isKnownModel("default")).toBe(false);
    expect(isKnownModel("unknown-model")).toBe(false);
    expect(isKnownModel(null)).toBe(false);
    expect(isKnownModel(undefined)).toBe(false);
  });
});
