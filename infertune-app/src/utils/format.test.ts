import { describe, expect, it } from "vitest";
import {
  bytesToGb,
  formatDuration,
  formatGb,
  modelFit,
  tokensPerSecond,
} from "./format";

const GB = 1024 ** 3;

describe("units", () => {
  it("converts bytes to GB", () => {
    expect(bytesToGb(2 * GB)).toBe(2);
    expect(formatGb(1.5 * GB)).toBe("1.5 GB");
    expect(formatGb(1.5 * GB, 2)).toBe("1.50 GB");
  });

  it("formats durations", () => {
    expect(formatDuration(250)).toBe("250 ms");
    expect(formatDuration(1500)).toBe("1.5 s");
    expect(formatDuration(125_000)).toBe("2 min 5 s");
  });

  it("computes tokens per second and guards against zero time", () => {
    expect(tokensPerSecond(100, 2000)).toBe(50);
    expect(tokensPerSecond(100, 0)).toBe(0);
  });
});

describe("modelFit", () => {
  it("fits on the GPU with headroom", () => {
    expect(modelFit(4, 5, 8 * GB, 16 * GB)).toBe("gpu");
  });

  it("does not call a model GPU-fit when it fills the card", () => {
    // 5.9 GB needed on a 6 GB card leaves no headroom (limit is 90%).
    expect(modelFit(5.9, 6.4, 6 * GB, 16 * GB)).toBe("partial");
  });

  it("offloads partially when only RAM is enough", () => {
    expect(modelFit(9, 9.5, 6 * GB, 16 * GB)).toBe("partial");
  });

  it("falls back to CPU without a GPU", () => {
    expect(modelFit(4, 5, 0, 16 * GB)).toBe("cpu");
  });

  it("flags models too large for the machine", () => {
    expect(modelFit(40, 41, 6 * GB, 16 * GB)).toBe("toolarge");
  });
});
