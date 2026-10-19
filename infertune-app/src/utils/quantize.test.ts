import { describe, expect, it } from "vitest";
import {
  QUANT_TARGETS,
  estimateQuantizedSizeGb,
  isFullPrecision,
  isValidModelName,
  suggestName,
} from "./quantize";

const q4 = QUANT_TARGETS.find((t) => t.id === "q4_K_M")!;

describe("quantize helpers", () => {
  it("accepts only 16/32-bit sources", () => {
    for (const q of ["F16", "f32", "BF16", "fp16"]) expect(isFullPrecision(q)).toBe(true);
    for (const q of ["Q4_K_M", "Q8_0", "", null, undefined]) expect(isFullPrecision(q)).toBe(false);
  });

  it("estimates the new size", () => {
    expect(estimateQuantizedSizeGb(8, q4)).toBeCloseTo(4.64, 2);
    expect(estimateQuantizedSizeGb(null, q4)).toBeNull();
    expect(estimateQuantizedSizeGb(0, q4)).toBeNull();
  });

  it("suggests a name", () => {
    expect(suggestName("llama3.2:3b-instruct-fp16", q4)).toBe("llama3.2:3b-instruct-q4_k_m");
    expect(suggestName("mymodel:f16", q4)).toBe("mymodel:q4_k_m");
    expect(suggestName("plain", q4)).toBe("plain-q4_k_m");
  });

  it("checks model names", () => {
    expect(isValidModelName("llama3.2:3b-q4_k_m")).toBe(true);
    expect(isValidModelName("user/model:tag")).toBe(true);
    expect(isValidModelName("")).toBe(false);
    expect(isValidModelName("bad name")).toBe(false);
    expect(isValidModelName("x:")).toBe(false);
  });

  it("lists targets with unique ids", () => {
    const ids = QUANT_TARGETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
