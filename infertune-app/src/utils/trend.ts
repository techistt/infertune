import type { BenchmarkResult } from "../store/historyStore";

export interface TrendPoint {
  time: number;
  tokensPerSecond: number;
  label: string;
}

/** Models that have at least one benchmark, most-benchmarked first. */
export function benchmarkedModels(results: BenchmarkResult[]): string[] {
  const counts = new Map<string, number>();

  for (const r of results) {
    counts.set(r.model, (counts.get(r.model) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([model]) => model);
}

/** Speed of one model over time, oldest first. */
export function buildTrend(
  results: BenchmarkResult[],
  model: string
): TrendPoint[] {
  return results
    .filter((r) => r.model === model)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => ({
      time: r.createdAt,
      tokensPerSecond: r.avgTokensPerSecond,
      label: `${r.promptName} · ${r.contextLength.toLocaleString()} ctx`,
    }));
}

/** Change from the first to the last point, in percent; null if unknown. */
export function trendChange(points: TrendPoint[]): number | null {
  if (points.length < 2) return null;

  const first = points[0].tokensPerSecond;
  const last = points[points.length - 1].tokensPerSecond;

  if (first <= 0) return null;

  return ((last - first) / first) * 100;
}

/** Tokens per joule (tokens/second divided by watts); null without power data. */
export function tokensPerJoule(
  tokensPerSecond: number,
  watts: number | undefined
): number | null {
  if (!watts || watts <= 0) return null;

  return tokensPerSecond / watts;
}
