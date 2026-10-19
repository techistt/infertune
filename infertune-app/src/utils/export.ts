import type { BenchmarkResult } from "../store/historyStore";

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(results: BenchmarkResult[]): string {
  const header = [
    "Date",
    "Server",
    "Model",
    "Prompt",
    "Context",
    "Runs",
    "Avg tok/s",
    "Avg time ms",
    "Avg tokens",
    "Peak CPU %",
    "Peak RAM GB",
    "Peak GPU %",
    "Peak VRAM GB",
    "Peak temp C",
    "Avg power W",
  ];

  const lines = results.map((r) =>
    [
      new Date(r.createdAt).toISOString(),
      r.providerName,
      r.model,
      r.promptName,
      r.contextLength,
      r.runs.length,
      r.avgTokensPerSecond.toFixed(2),
      Math.round(r.avgTimeMs),
      Math.round(r.avgTokens),
      r.peakCpu.toFixed(0),
      r.peakRamGb.toFixed(1),
      r.peakGpu.toFixed(0),
      r.peakVramGb.toFixed(1),
      r.peakTempC ? r.peakTempC.toFixed(0) : "",
      r.avgPowerW ? r.avgPowerW.toFixed(0) : "",
    ]
      .map(csvCell)
      .join(",")
  );

  return [header.join(","), ...lines].join("\n");
}

function mdCell(value: string | number): string {
  // A pipe would split the cell; newlines would break the row.
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** A table that pastes cleanly into GitHub, Reddit, Discord and docs. */
export function buildMarkdown(results: BenchmarkResult[]): string {
  const header =
    "| Model | Server | Prompt | Context | Speed (tok/s) | Time (ms) | Peak RAM (GB) | Peak VRAM (GB) |";
  const divider = "|---|---|---|---:|---:|---:|---:|---:|";

  const rows = results.map(
    (r) =>
      "| " +
      [
        r.model,
        r.providerName,
        r.promptName,
        r.contextLength,
        r.avgTokensPerSecond.toFixed(1),
        Math.round(r.avgTimeMs),
        r.peakRamGb.toFixed(1),
        r.peakVramGb.toFixed(1),
      ]
        .map(mdCell)
        .join(" | ") +
      " |"
  );

  return [header, divider, ...rows].join("\n");
}
