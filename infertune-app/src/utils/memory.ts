import { CONTEXT_OPTIONS } from "./format";

/** Fraction of VRAM a model may use and still count as "fits on the GPU". */
export const GPU_FIT_RATIO = 0.9;

/** Estimated memory use as a straight line in the context length. */
export interface MemoryModel {
  vramBase: number;
  vramPerToken: number;
  ramBase: number;
  ramPerToken: number;
}

export interface MemoryPoint {
  context: number;
  vramGb: number;
  ramGb: number;
}

/**
 * Weights are fixed and the KV cache grows linearly with context, so two
 * estimates at different contexts describe every other context.
 */
export function buildMemoryModel(a: MemoryPoint, b: MemoryPoint): MemoryModel {
  const span = b.context - a.context;
  const vramPerToken = span !== 0 ? (b.vramGb - a.vramGb) / span : 0;
  const ramPerToken = span !== 0 ? (b.ramGb - a.ramGb) / span : 0;

  return {
    vramPerToken: Math.max(vramPerToken, 0),
    ramPerToken: Math.max(ramPerToken, 0),
    vramBase: a.vramGb - Math.max(vramPerToken, 0) * a.context,
    ramBase: a.ramGb - Math.max(ramPerToken, 0) * a.context,
  };
}

export function estimateAt(
  model: MemoryModel,
  context: number
): { vramGb: number; ramGb: number } {
  return {
    vramGb: model.vramBase + model.vramPerToken * context,
    ramGb: model.ramBase + model.ramPerToken * context,
  };
}

/**
 * Largest standard context size that still fits fully on the GPU, or null
 * when even the smallest does not.
 */
export function suggestContext(
  model: MemoryModel,
  vramTotalGb: number,
  limit: number | null = null
): number | null {
  if (vramTotalGb <= 0) return null;

  let best: number | null = null;

  for (const option of CONTEXT_OPTIONS) {
    if (limit !== null && option > limit) break;

    if (estimateAt(model, option).vramGb <= vramTotalGb * GPU_FIT_RATIO) {
      best = option;
    }
  }

  return best;
}

export type AdviceLevel = "ok" | "info" | "warn";

export interface VramAdvice {
  level: AdviceLevel;
  message: string;
}

/**
 * What to tell the user before running a model.
 * `estVramGb` is null when the model's needs are unknown.
 */
export function vramAdvice(
  estVramGb: number | null,
  vramTotalGb: number,
  vramFreeGb: number,
  suggested: number | null
): VramAdvice {
  if (vramTotalGb <= 0) {
    return { level: "ok", message: "" };
  }

  const hint =
    suggested !== null
      ? ` A context of ${suggested.toLocaleString()} would fit on the GPU.`
      : "";

  if (estVramGb === null) {
    return vramFreeGb < 1.5
      ? {
          level: "warn",
          message: `Only ${vramFreeGb.toFixed(1)} GB of GPU memory is free. Loading a model may fail.`,
        }
      : { level: "ok", message: "" };
  }

  if (estVramGb > vramTotalGb * GPU_FIT_RATIO) {
    return {
      level: "info",
      message: `This model needs about ${estVramGb.toFixed(1)} GB but the GPU has ${vramTotalGb.toFixed(1)} GB, so part of it runs on the CPU and will be slower.${hint}`,
    };
  }

  if (estVramGb > vramFreeGb) {
    return {
      level: "warn",
      message: `This model needs about ${estVramGb.toFixed(1)} GB but only ${vramFreeGb.toFixed(1)} GB of GPU memory is free. Loading it may fail unless it is already loaded.`,
    };
  }

  return { level: "ok", message: "" };
}
