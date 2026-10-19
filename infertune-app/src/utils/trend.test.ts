import { describe, expect, it } from "vitest";
import {
  benchmarkedModels,
  buildTrend,
  tokensPerJoule,
  trendChange,
} from "./trend";
import type { BenchmarkResult } from "../store/historyStore";

function result(model: string, createdAt: number, tps: number): BenchmarkResult {
  return {
    id: `${model}-${createdAt}`,
    createdAt,
    providerName: "Ollama",
    model,
    promptName: "Short Q&A",
    contextLength: 4096,
    maxTokens: 200,
    runs: [],
    avgTokensPerSecond: tps,
    avgTimeMs: 1000,
    avgTokens: 100,
    peakCpu: 0,
    peakRamGb: 0,
    peakGpu: 0,
    peakVramGb: 0,
  };
}

describe("trend", () => {
  const data = [
    result("a", 300, 30),
    result("b", 100, 50),
    result("a", 100, 20),
    result("a", 200, 25),
  ];

  it("lists the most benchmarked model first", () => {
    expect(benchmarkedModels(data)).toEqual(["a", "b"]);
  });

  it("orders a model's results oldest first", () => {
    expect(buildTrend(data, "a").map((p) => p.tokensPerSecond)).toEqual([20, 25, 30]);
  });

  it("computes the change from first to last", () => {
    expect(trendChange(buildTrend(data, "a"))).toBeCloseTo(50);
    expect(trendChange(buildTrend(data, "b"))).toBeNull();
  });

  it("does not divide by zero", () => {
    expect(trendChange([
      { time: 1, tokensPerSecond: 0, label: "" },
      { time: 2, tokensPerSecond: 5, label: "" },
    ])).toBeNull();
  });
});

describe("tokensPerJoule", () => {
  it("divides speed by power", () => {
    expect(tokensPerJoule(60, 30)).toBe(2);
  });

  it("is null without power data", () => {
    expect(tokensPerJoule(60, undefined)).toBeNull();
    expect(tokensPerJoule(60, 0)).toBeNull();
  });
});
