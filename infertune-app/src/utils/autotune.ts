export interface TuneConfig {
  id: string;
  label: string;
  contextLength: number;
  /** Ollama GPU layers; null means "let the server decide". */
  numGpu: number | null;
}

export interface TuneResult {
  config: TuneConfig;
  ok: boolean;
  error?: string;
  tokensPerSecond: number;
  peakVramGb: number;
  peakRamGb: number;
  peakTempC: number;
  avgPowerW: number;
}

const CONTEXTS = [2048, 4096, 8192, 16384];
const LAYER_SHARES = [0.75, 0.5, 0.25, 0];

export interface PlanInput {
  /** Largest context the model supports; null when unknown. */
  contextLimit: number | null;
  /** Transformer layer count; null when unknown. */
  layers: number | null;
  /** GPU layer control exists on Ollama only. */
  supportsLayers: boolean;
  /** Context used while sweeping GPU layers. */
  baseContext: number;
}

/**
 * The settings to try: first a sweep over context size, then (Ollama with a
 * known layer count) a sweep over how much of the model sits on the GPU.
 */
export function planConfigs(input: PlanInput): TuneConfig[] {
  const limit = input.contextLimit;
  let contexts = CONTEXTS.filter((c) => limit === null || c <= limit);

  if (contexts.length === 0) contexts = [CONTEXTS[0]];

  const configs: TuneConfig[] = contexts.map((c) => ({
    id: `ctx-${c}`,
    label: `${c.toLocaleString("en-US")} context, automatic GPU`,
    contextLength: c,
    numGpu: null,
  }));

  if (input.supportsLayers && input.layers && input.layers > 0) {
    const layers = input.layers;
    const base = contexts.includes(input.baseContext)
      ? input.baseContext
      : contexts[Math.min(1, contexts.length - 1)];
    const seen = new Set<number>();

    for (const share of LAYER_SHARES) {
      const n = Math.round(layers * share);

      if (seen.has(n)) continue;
      seen.add(n);

      configs.push({
        id: `gpu-${n}`,
        label: `${base.toLocaleString("en-US")} context, ${n}/${layers} layers on GPU`,
        contextLength: base,
        numGpu: n,
      });
    }
  }

  return configs;
}

export interface TuneSummary {
  fastest: TuneResult | null;
  /** Largest context that stays within `tolerance` of the fastest speed. */
  balanced: TuneResult | null;
}

export function summarize(results: TuneResult[], tolerance = 0.85): TuneSummary {
  const ok = results.filter((r) => r.ok && r.tokensPerSecond > 0);

  if (ok.length === 0) return { fastest: null, balanced: null };

  const fastest = ok.reduce((a, b) =>
    b.tokensPerSecond > a.tokensPerSecond ? b : a
  );

  const near = ok.filter(
    (r) => r.tokensPerSecond >= fastest.tokensPerSecond * tolerance
  );

  const balanced = near.reduce((a, b) => {
    if (b.config.contextLength !== a.config.contextLength) {
      return b.config.contextLength > a.config.contextLength ? b : a;
    }

    return b.tokensPerSecond > a.tokensPerSecond ? b : a;
  });

  return { fastest, balanced };
}
