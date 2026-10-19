import { CONTEXT_OPTIONS, modelFit, type Fit } from "./format";
import { GPU_FIT_RATIO } from "./memory";

/** GB of weights per billion parameters, by quantization. */
export const PLANNER_QUANTS: { id: string; label: string; gbPerBillion: number }[] = [
  { id: "q2_k", label: "Q2_K (about 2.6 bits)", gbPerBillion: 0.3 },
  { id: "q3_k_m", label: "Q3_K_M (about 3.9 bits)", gbPerBillion: 0.42 },
  { id: "q4_k_m", label: "Q4_K_M (about 4.8 bits)", gbPerBillion: 0.58 },
  { id: "q5_k_m", label: "Q5_K_M (about 5.7 bits)", gbPerBillion: 0.7 },
  { id: "q6_k", label: "Q6_K (about 6.6 bits)", gbPerBillion: 0.82 },
  { id: "q8_0", label: "Q8_0 (8.5 bits)", gbPerBillion: 1.06 },
  { id: "f16", label: "16-bit (unquantized)", gbPerBillion: 2 },
];

const GB = 1024 ** 3;

/**
 * KV cache bytes per token. Modern models share key/value heads, so this
 * grows slower than model size; the figure is 128 KiB for an 8B model.
 */
export function kvBytesPerToken(paramsB: number): number {
  return 131072 * Math.sqrt(Math.max(paramsB, 0.1) / 8);
}

export interface PlanRow {
  context: number;
  vramGb: number;
  ramGb: number;
  fit: Fit;
}

export interface PlanInput {
  paramsB: number;
  quantId: string;
  vramBytes: number;
  ramBytes: number;
  /** Largest context to list; the model's own limit, when known. */
  contextLimit?: number | null;
}

export function weightsGb(paramsB: number, quantId: string): number {
  const q = PLANNER_QUANTS.find((x) => x.id === quantId) ?? PLANNER_QUANTS[2];

  return paramsB * q.gbPerBillion;
}

/** Memory needed at each standard context length. */
export function planModel(input: PlanInput): PlanRow[] {
  const weights = weightsGb(input.paramsB, input.quantId);
  const kvPerToken = kvBytesPerToken(input.paramsB);

  return CONTEXT_OPTIONS.filter(
    (c) => !input.contextLimit || c <= input.contextLimit
  ).map((context) => {
    const kv = (kvPerToken * context) / GB;
    const vramGb = weights + kv + 0.5;
    const ramGb = weights + kv + 1;

    return {
      context,
      vramGb,
      ramGb,
      fit: modelFit(vramGb, ramGb, input.vramBytes, input.ramBytes),
    };
  });
}

/** Largest listed context that fits fully on the GPU, or null. */
export function maxGpuContext(rows: PlanRow[]): number | null {
  const fits = rows.filter((r) => r.fit === "gpu");

  return fits.length > 0 ? fits[fits.length - 1].context : null;
}

/** Biggest model (in billions) that fits on the GPU at the context. */
export function largestModelFor(
  vramBytes: number,
  quantId: string,
  context: number
): number {
  const vram = vramBytes / GB;
  let best = 0;

  for (let p = 0.5; p <= 200; p += 0.5) {
    const need = weightsGb(p, quantId) + (kvBytesPerToken(p) * context) / GB + 0.5;

    if (need <= vram * GPU_FIT_RATIO) best = p;
    else break;
  }

  return best;
}
