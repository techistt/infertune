import type { BenchmarkResult } from "../store/historyStore";
import { tokensPerJoule } from "./trend";

export interface ReportHardware {
  gpuName: string;
  vramGb: number;
  ramGb: number;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A single self-contained HTML page (no scripts, no external files) that
 * opens in any browser and prints cleanly to PDF.
 */
export function buildHtmlReport(
  results: BenchmarkResult[],
  hardware: ReportHardware,
  generatedAt: Date = new Date()
): string {
  const max = Math.max(...results.map((r) => r.avgTokensPerSecond), 0.0001);

  const rows = results
    .map((r) => {
      const efficiency = tokensPerJoule(r.avgTokensPerSecond, r.avgPowerW);
      const width = Math.max((r.avgTokensPerSecond / max) * 100, 1);

      return `<tr>
<td><strong>${escapeHtml(r.model)}</strong><br><span class="muted">${escapeHtml(r.providerName)} · ${escapeHtml(r.promptName)} · ${r.contextLength.toLocaleString("en-US")} ctx · ${r.runs.length} run${r.runs.length === 1 ? "" : "s"}</span></td>
<td class="num"><div class="bar"><span style="width:${width.toFixed(1)}%"></span></div>${r.avgTokensPerSecond.toFixed(1)} tok/s</td>
<td class="num">${Math.round(r.avgTimeMs).toLocaleString("en-US")} ms</td>
<td class="num">${r.peakRamGb.toFixed(1)} GB</td>
<td class="num">${r.peakVramGb.toFixed(1)} GB</td>
<td class="num">${r.peakTempC ? `${r.peakTempC.toFixed(0)} °C` : "-"}</td>
<td class="num">${r.avgPowerW ? `${r.avgPowerW.toFixed(0)} W` : "-"}${efficiency !== null ? `<br><span class="muted">${efficiency.toFixed(2)} tok/J</span>` : ""}</td>
</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>InferTune benchmark report</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;padding:32px;color:#111827;background:#fff;max-width:1100px;margin-inline:auto}
h1{margin:0 0 4px;font-size:26px}
.muted{color:#6b7280;font-size:13px}
.specs{margin:20px 0;padding:14px 16px;background:#f3f4f6;border-radius:8px;font-size:14px}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;font-weight:600;color:#374151;border-bottom:2px solid #d1d5db;padding:8px 10px}
td{border-bottom:1px solid #e5e7eb;padding:10px;vertical-align:top}
.num{white-space:nowrap}
.bar{height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;margin-bottom:4px;min-width:90px}
.bar span{display:block;height:100%;background:#2563eb}
footer{margin-top:24px;font-size:12px;color:#6b7280}
@media print{body{padding:0}}
</style>
</head>
<body>
<h1>InferTune benchmark report</h1>
<div class="muted">Generated ${escapeHtml(generatedAt.toLocaleString("en-US"))}</div>
<div class="specs">
<strong>Hardware:</strong> ${escapeHtml(hardware.gpuName || "No GPU detected")}${hardware.vramGb > 0 ? ` (${hardware.vramGb.toFixed(1)} GB VRAM)` : ""}, ${hardware.ramGb.toFixed(1)} GB RAM
</div>
<table>
<thead><tr><th>Model</th><th>Speed</th><th>Time</th><th>Peak RAM</th><th>Peak VRAM</th><th>GPU temp</th><th>GPU power</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<footer>Speed is the average tokens per second over the runs. Peaks are the highest values seen while the model was generating. Estimates depend on the server, model and settings used.</footer>
</body>
</html>
`;
}
