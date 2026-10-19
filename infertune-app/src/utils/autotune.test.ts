import { describe, expect, it } from "vitest";
import { planConfigs, summarize, type TuneResult } from "./autotune";

const res = (id: string, ctx: number, tps: number, ok = true): TuneResult => ({
  config: { id, label: id, contextLength: ctx, numGpu: null },
  ok,
  tokensPerSecond: tps,
  peakVramGb: 0,
  peakRamGb: 0,
  peakTempC: 0,
  avgPowerW: 0,
});

describe("autotune plan", () => {
  it("sweeps contexts up to the model limit", () => {
    const plan = planConfigs({ contextLimit: 8192, layers: null, supportsLayers: true, baseContext: 4096 });

    expect(plan.map((c) => c.contextLength)).toEqual([2048, 4096, 8192]);
  });

  it("adds GPU layer splits only when supported and known", () => {
    const withLayers = planConfigs({ contextLimit: null, layers: 32, supportsLayers: true, baseContext: 4096 });
    const gpu = withLayers.filter((c) => c.numGpu !== null);

    expect(gpu.map((c) => c.numGpu)).toEqual([24, 16, 8, 0]);
    expect(gpu.every((c) => c.contextLength === 4096)).toBe(true);

    expect(planConfigs({ contextLimit: null, layers: 32, supportsLayers: false, baseContext: 4096 })
      .some((c) => c.numGpu !== null)).toBe(false);
    expect(planConfigs({ contextLimit: null, layers: null, supportsLayers: true, baseContext: 4096 })
      .some((c) => c.numGpu !== null)).toBe(false);
  });

  it("falls back to the smallest context for tiny limits", () => {
    const plan = planConfigs({ contextLimit: 512, layers: null, supportsLayers: false, baseContext: 4096 });

    expect(plan).toHaveLength(1);
    expect(plan[0].contextLength).toBe(2048);
  });

  it("skips duplicate layer counts", () => {
    const plan = planConfigs({ contextLimit: null, layers: 1, supportsLayers: true, baseContext: 4096 });
    const counts = plan.filter((c) => c.numGpu !== null).map((c) => c.numGpu);

    expect(new Set(counts).size).toBe(counts.length);
  });
});

describe("autotune summary", () => {
  it("picks the fastest and a balanced option", () => {
    const s = summarize([res("a", 2048, 50), res("b", 4096, 46), res("c", 8192, 30), res("d", 16384, 0, false)]);

    expect(s.fastest?.config.id).toBe("a");
    expect(s.balanced?.config.id).toBe("b");
  });

  it("returns nothing when all failed", () => {
    expect(summarize([res("a", 2048, 0, false)])).toEqual({ fastest: null, balanced: null });
  });
});
