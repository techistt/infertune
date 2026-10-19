import { describe, expect, it } from "vitest";
import { estimateFineTune, lightestFit, maxBatch, type FineTuneInput } from "./finetune";

const base: FineTuneInput = {
  paramsB: 7,
  method: "qlora",
  rank: 16,
  seqLen: 1024,
  batchSize: 1,
  gradientCheckpointing: true,
};

describe("fine-tune estimate", () => {
  it("orders methods by memory", () => {
    const q = estimateFineTune(base).totalGb;
    const l = estimateFineTune({ ...base, method: "lora" }).totalGb;
    const f = estimateFineTune({ ...base, method: "full" }).totalGb;

    expect(q).toBeLessThan(l);
    expect(l).toBeLessThan(f);
  });

  it("gives plausible 7B numbers", () => {
    expect(estimateFineTune(base).totalGb).toBeGreaterThan(4);
    expect(estimateFineTune(base).totalGb).toBeLessThan(10);
    expect(estimateFineTune({ ...base, method: "full" }).totalGb).toBeGreaterThan(90);
  });

  it("grows with batch, sequence length and no checkpointing", () => {
    const a = estimateFineTune(base).activationsGb;

    expect(estimateFineTune({ ...base, batchSize: 4 }).activationsGb).toBeGreaterThan(a);
    expect(estimateFineTune({ ...base, seqLen: 4096 }).activationsGb).toBeGreaterThan(a);
    expect(estimateFineTune({ ...base, gradientCheckpointing: false }).activationsGb).toBeGreaterThan(a);
  });

  it("scales trainable parameters with rank", () => {
    expect(estimateFineTune({ ...base, rank: 64 }).trainableParamsM).toBeGreaterThan(
      estimateFineTune({ ...base, rank: 8 }).trainableParamsM
    );
  });

  it("finds the best method that fits", () => {
    const { method: _m, ...rest } = base;
    void _m;

    expect(lightestFit(rest, 8)).toBe("qlora");
    expect(lightestFit(rest, 2)).toBeNull();
    expect(lightestFit(rest, 400)).toBe("full");
  });

  it("finds the largest batch that fits", () => {
    expect(maxBatch(base, 1)).toBe(0);
    expect(maxBatch(base, 12)).toBeGreaterThan(1);
  });
});
