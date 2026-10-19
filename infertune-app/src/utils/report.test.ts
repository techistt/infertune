import { describe, expect, it } from "vitest";
import { buildHtmlReport, escapeHtml } from "./report";
import type { BenchmarkResult } from "../store/historyStore";

const result: BenchmarkResult = {
  id: "1",
  createdAt: 1,
  providerName: "Ollama",
  model: "evil<script>alert(1)</script>:7b",
  promptName: "Q&A",
  contextLength: 4096,
  maxTokens: 200,
  runs: [{ tokens: 100, timeMs: 2000, tokensPerSecond: 50 }],
  avgTokensPerSecond: 50,
  avgTimeMs: 2000,
  avgTokens: 100,
  peakCpu: 40,
  peakRamGb: 6.2,
  peakGpu: 90,
  peakVramGb: 4.5,
  peakTempC: 71,
  avgPowerW: 25,
};

const hardware = { gpuName: "NVIDIA GeForce RTX 3050", vramGb: 6, ramGb: 16 };

describe("escapeHtml", () => {
  it("escapes the characters that matter", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;"
    );
  });
});

describe("buildHtmlReport", () => {
  const html = buildHtmlReport([result], hardware, new Date(Date.UTC(2026, 9, 19)));

  it("is a complete page with the hardware and the numbers", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("RTX 3050");
    expect(html).toContain("6.0 GB VRAM");
    expect(html).toContain("50.0 tok/s");
    expect(html).toContain("71 °C");
    expect(html).toContain("25 W");
    expect(html).toContain("2.00 tok/J");
  });

  it("never lets a model name inject markup", () => {
    expect(html).not.toContain("<script>");
    expect(html).toContain("evil&lt;script&gt;");
  });

  it("shows dashes when there is no power data", () => {
    const plain = buildHtmlReport(
      [{ ...result, peakTempC: undefined, avgPowerW: undefined }],
      hardware
    );

    expect(plain).not.toContain("tok/J");
  });

  it("copes with a machine without a GPU", () => {
    const cpu = buildHtmlReport([result], { gpuName: "", vramGb: 0, ramGb: 8 });

    expect(cpu).toContain("No GPU detected");
  });
});
