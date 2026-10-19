import { describe, expect, it } from "vitest";
import { buildCsv, buildMarkdown } from "./export";
import type { BenchmarkResult } from "../store/historyStore";

function result(overrides: Partial<BenchmarkResult> = {}): BenchmarkResult {
  return {
    id: "1",
    createdAt: Date.UTC(2026, 9, 19),
    providerName: "Ollama",
    model: "llama3.2:3b",
    promptName: "Short Q&A",
    contextLength: 4096,
    maxTokens: 200,
    runs: [
      { tokens: 100, timeMs: 2000, tokensPerSecond: 50 },
      { tokens: 100, timeMs: 2000, tokensPerSecond: 50 },
    ],
    avgTokensPerSecond: 50,
    avgTimeMs: 2000,
    avgTokens: 100,
    peakCpu: 40.4,
    peakRamGb: 6.25,
    peakGpu: 88,
    peakVramGb: 4.5,
    peakTempC: 70.2,
    avgPowerW: 41.6,
    ...overrides,
  };
}

describe("buildCsv", () => {
  it("writes a header and one row per result", () => {
    const lines = buildCsv([result(), result({ model: "qwen2.5:7b" })]).split("\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Avg tok/s");
    expect(lines[1]).toContain("llama3.2:3b");
    expect(lines[1]).toContain("50.00");
  });

  it("includes temperature and power, and leaves them blank when unknown", () => {
    const [, withData] = buildCsv([result()]).split("\n");
    const [, without] = buildCsv([result({ peakTempC: undefined, avgPowerW: undefined })]).split("\n");

    expect(withData.endsWith(",70,42")).toBe(true);
    expect(without.endsWith(",,")).toBe(true);
  });

  it("quotes cells that contain commas or quotes", () => {
    const csv = buildCsv([result({ promptName: 'Say "hi", please' })]);

    expect(csv).toContain('"Say ""hi"", please"');
  });
});

describe("buildMarkdown", () => {
  it("builds a table with header, divider and rows", () => {
    const lines = buildMarkdown([result()]).split("\n");

    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^\|---/);
    expect(lines[2]).toContain("| llama3.2:3b | Ollama |");
    expect(lines[2]).toContain("50.0");
  });

  it("escapes pipes so a cell cannot split a row", () => {
    const md = buildMarkdown([result({ model: "a|b" })]);

    expect(md).toContain("a\\|b");
  });
});
