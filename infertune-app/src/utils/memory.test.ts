import { describe, expect, it } from "vitest";
import {
  buildMemoryModel,
  estimateAt,
  suggestContext,
  vramAdvice,
} from "./memory";

// 4 GB of weights + 0.5 GB overhead + 1 GB of KV cache per 8192 tokens.
const model = buildMemoryModel(
  { context: 4096, vramGb: 5.0, ramGb: 5.5 },
  { context: 8192, vramGb: 5.5, ramGb: 6.0 }
);

describe("memory model", () => {
  it("reproduces the points it was built from", () => {
    expect(estimateAt(model, 4096).vramGb).toBeCloseTo(5.0);
    expect(estimateAt(model, 8192).vramGb).toBeCloseTo(5.5);
  });

  it("extrapolates linearly to other contexts", () => {
    expect(estimateAt(model, 16384).vramGb).toBeCloseTo(6.5);
    expect(estimateAt(model, 2048).vramGb).toBeCloseTo(4.75);
  });

  it("never lets memory shrink with context", () => {
    const flat = buildMemoryModel(
      { context: 4096, vramGb: 5, ramGb: 6 },
      { context: 8192, vramGb: 4.9, ramGb: 5.9 }
    );

    expect(estimateAt(flat, 32768).vramGb).toBeGreaterThanOrEqual(
      estimateAt(flat, 4096).vramGb
    );
  });

  it("copes with two identical probe points", () => {
    const same = buildMemoryModel(
      { context: 4096, vramGb: 5, ramGb: 6 },
      { context: 4096, vramGb: 5, ramGb: 6 }
    );

    expect(estimateAt(same, 8192).vramGb).toBe(5);
  });
});

describe("suggestContext", () => {
  it("picks the largest size that fits in 90% of VRAM", () => {
    // 8 GB card: limit is 7.2 GB. 65536 tokens needs 4.5 + 8 = 12.5 GB (no),
    // 16384 needs 6.5 GB (yes), 32768 needs 8.5 GB (no).
    expect(suggestContext(model, 8)).toBe(16384);
  });

  it("respects the model's own context limit", () => {
    expect(suggestContext(model, 8, 8192)).toBe(8192);
  });

  it("returns null when nothing fits", () => {
    expect(suggestContext(model, 4)).toBeNull();
  });

  it("returns null without a GPU", () => {
    expect(suggestContext(model, 0)).toBeNull();
  });
});

describe("vramAdvice", () => {
  it("is silent when there is no GPU memory reading", () => {
    expect(vramAdvice(5, 0, 0, null).level).toBe("ok");
  });

  it("is silent when the model fits in free memory", () => {
    expect(vramAdvice(4, 8, 6, 8192).level).toBe("ok");
  });

  it("warns when the model fits the card but not what is free", () => {
    const advice = vramAdvice(5, 6, 0.7, 4096);
    expect(advice.level).toBe("warn");
    expect(advice.message).toContain("0.7 GB");
  });

  it("explains partial CPU offload for models larger than the card", () => {
    const advice = vramAdvice(9.6, 6, 5, 2048);
    expect(advice.level).toBe("info");
    expect(advice.message).toContain("2,048");
  });

  it("falls back to a free-memory check when the model is unknown", () => {
    expect(vramAdvice(null, 6, 0.7, null).level).toBe("warn");
    expect(vramAdvice(null, 6, 4, null).level).toBe("ok");
  });
});
