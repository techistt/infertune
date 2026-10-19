import type { BenchmarkResult } from "../store/historyStore";

interface SpeedChartProps {
  results: BenchmarkResult[];
}

const MAX_BARS = 8;

/** Horizontal bars comparing average tokens/second of the most recent results. */
export default function SpeedChart({ results }: SpeedChartProps) {
  const recent = results.slice(0, MAX_BARS);

  if (recent.length === 0) return null;

  const max = Math.max(...recent.map((r) => r.avgTokensPerSecond), 0.0001);
  const best = Math.max(...recent.map((r) => r.avgTokensPerSecond));

  return (
    <div
      className="space-y-2"
      role="img"
      aria-label="Average tokens per second for recent benchmark results"
    >
      {recent.map((r) => {
        const isBest = recent.length > 1 && r.avgTokensPerSecond === best;

        return (
          <div key={r.id} className="flex items-center gap-3 text-sm">
            <div
              className="w-48 shrink-0 truncate text-gray-300"
              title={`${r.model} · ${r.promptName} · ${r.contextLength.toLocaleString()} ctx`}
            >
              {r.model}
              <span className="text-gray-600"> · {r.promptName}</span>
            </div>

            <div className="flex-1 h-5 rounded bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded ${isBest ? "bg-green-500" : "bg-blue-500"}`}
                style={{ width: `${Math.max((r.avgTokensPerSecond / max) * 100, 1)}%` }}
              />
            </div>

            <div className="w-24 shrink-0 text-right tabular-nums text-gray-200">
              {r.avgTokensPerSecond.toFixed(1)} tok/s
            </div>
          </div>
        );
      })}

      <p className="pt-1 text-xs text-gray-500">
        Most recent {recent.length} result{recent.length === 1 ? "" : "s"}. The
        green bar is the fastest.
      </p>
    </div>
  );
}
