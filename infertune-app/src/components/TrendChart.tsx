import { useEffect, useMemo, useState } from "react";
import type { BenchmarkResult } from "../store/historyStore";
import { benchmarkedModels, buildTrend, trendChange } from "../utils/trend";

interface TrendChartProps {
  results: BenchmarkResult[];
}

const WIDTH = 640;
const HEIGHT = 200;
const PAD = { left: 44, right: 16, top: 12, bottom: 28 };

/** Speed of one model across all its benchmark runs, oldest to newest. */
export default function TrendChart({ results }: TrendChartProps) {
  const models = useMemo(() => benchmarkedModels(results), [results]);
  const [model, setModel] = useState("");

  useEffect(() => {
    if (!models.includes(model)) setModel(models[0] ?? "");
  }, [models, model]);

  const points = useMemo(() => buildTrend(results, model), [results, model]);
  const change = trendChange(points);

  if (models.length === 0) return null;

  const max = Math.max(...points.map((p) => p.tokensPerSecond), 1) * 1.1;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const line = points.map((p, i) => `${x(i)},${y(p.tokensPerSecond)}`).join(" ");
  const ticks = [0, 0.5, 1].map((f) => f * max);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h3 className="text-sm font-medium">Speed over time</h3>

        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-lg bg-gray-800 p-1.5 text-sm"
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {change !== null && (
          <span
            className={`text-sm ${
              change >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}% since the first run
          </span>
        )}
      </div>

      {points.length < 2 ? (
        <p className="rounded-lg bg-gray-800 p-4 text-sm text-gray-400">
          Run this model at least twice (for example after a driver or Ollama
          update) to see how its speed changes.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full rounded-lg bg-gray-800"
          role="img"
          aria-label={`Tokens per second for ${model} over time`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="#374151"
                strokeWidth="1"
              />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
                {t.toFixed(0)}
              </text>
            </g>
          ))}

          <polyline points={line} fill="none" stroke="#3b82f6" strokeWidth="2" />

          {points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.tokensPerSecond)} r="4" fill="#3b82f6">
              <title>
                {new Date(p.time).toLocaleString()} · {p.tokensPerSecond.toFixed(1)} tok/s · {p.label}
              </title>
            </circle>
          ))}

          <text x={PAD.left} y={HEIGHT - 8} fontSize="11" fill="#9ca3af">
            {new Date(points[0].time).toLocaleDateString()}
          </text>
          <text x={WIDTH - PAD.right} y={HEIGHT - 8} textAnchor="end" fontSize="11" fill="#9ca3af">
            {new Date(points[points.length - 1].time).toLocaleDateString()}
          </text>
        </svg>
      )}

      <p className="mt-1 text-xs text-gray-500">
        Tokens per second. Hover a point for the date and settings. Compare runs
        that used the same prompt and context for a fair trend.
      </p>
    </div>
  );
}
