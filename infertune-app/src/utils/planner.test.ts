import { describe, expect, it } from "vitest";
import { kvBytesPerToken, largestModelFor, maxGpuContext, planModel, weightsGb } from "./planner";

const GB = 1024 ** 3;

describe("planner", () => {
  it("computes weights from size and quantization", () => {
    expect(weightsGb(8, "q4_k_m")).toBeCloseTo(4.64, 2);
    expect(weightsGb(8, "f16")).toBe(16);
    // unknown quantization falls back to q4_k_m
    expect(weightsGb(8, "mystery")).toBeCloseTo(4.64, 2);
  });

  it("scales the KV cache sub-linearly with size", () => {
    expect(kvBytesPerToken(8)).toBe(131072);
    expect(kvBytesPerToken(32)).toBeCloseTo(262144, 0);
  });

  it("memory grows with context and fit degrades", () => {
    const rows = planModel({ paramsB: 8, quantId: "q4_k_m", vramBytes: 8 * GB, ramBytes: 32 * GB });

    for (let i = 1; i < rows.length; i++) expect(rows[i].vramGb).toBeGreaterThan(rows[i - 1].vramGb);
    expect(rows[0].fit).toBe("gpu");
    expect(rows[rows.length - 1].fit).not.toBe("gpu");
  });

  it("finds the largest context that fits the GPU", () => {
    const rows = planModel({ paramsB: 8, quantId: "q4_k_m", vramBytes: 8 * GB, ramBytes: 32 * GB });
    const best = maxGpuContext(rows);

    expect(best).not.toBeNull();
    expect(rows.find((r) => r.context === best)?.fit).toBe("gpu");

    const none = planModel({ paramsB: 70, quantId: "f16", vramBytes: 6 * GB, ramBytes: 8 * GB });
    expect(maxGpuContext(none)).toBeNull();
  });

  it("respects the model's context limit", () => {
    const rows = planModel({ paramsB: 3, quantId: "q4_k_m", vramBytes: 6 * GB, ramBytes: 16 * GB, contextLimit: 8192 });

    expect(Math.max(...rows.map((r) => r.context))).toBe(8192);
  });

  it("finds the largest model that fits", () => {
    const six = largestModelFor(6 * GB, "q4_k_m", 4096);
    const twelve = largestModelFor(12 * GB, "q4_k_m", 4096);

    expect(six).toBeGreaterThan(4);
    expect(six).toBeLessThan(10);
    expect(twelve).toBeGreaterThan(six);
    expect(largestModelFor(0, "q4_k_m", 4096)).toBe(0);
  });
});
