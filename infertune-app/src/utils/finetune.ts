export type FineTuneMethod = "full" | "lora" | "qlora";

export const METHOD_LABEL: Record<FineTuneMethod, string> = {
  full: "Full fine-tune (16-bit)",
  lora: "LoRA (16-bit base)",
  qlora: "QLoRA (4-bit base)",
};

export interface FineTuneInput {
  /** Model size in billions of parameters. */
  paramsB: number;
  method: FineTuneMethod;
  /** LoRA rank; ignored for a full fine-tune. */
  rank: number;
  seqLen: number;
  batchSize: number;
  gradientCheckpointing: boolean;
}

export interface FineTuneEstimate {
  weightsGb: number;
  gradientsGb: number;
  optimizerGb: number;
  activationsGb: number;
  overheadGb: number;
  totalGb: number;
  trainableParamsM: number;
}

const GB = 1024 ** 3;
const OVERHEAD_GB = 1;

/**
 * Rough VRAM needed to train. Uses the usual rules of thumb:
 * 16-bit weights = 2 bytes/param, 4-bit = ~0.55 bytes/param, Adam keeps two
 * 32-bit values per trainable weight, and activations grow with tokens per
 * step. Real use varies with the framework, so treat it as a planning figure.
 */
export function estimateFineTune(input: FineTuneInput): FineTuneEstimate {
  const params = Math.max(input.paramsB, 0) * 1e9;

  const trainable =
    input.method === "full" ? params : params * Math.max(input.rank, 1) * 0.0004;

  const weightBytes =
    input.method === "qlora" ? params * 0.55 : params * 2;

  // Full fine-tuning also keeps 32-bit master weights.
  const gradientBytes = trainable * (input.method === "full" ? 2 : 4);
  const optimizerBytes = trainable * (input.method === "full" ? 12 : 8);

  const tokens = Math.max(input.seqLen, 1) * Math.max(input.batchSize, 1);
  const activationFactor = input.gradientCheckpointing ? 0.0002 : 0.001;
  const activationBytes = tokens * params * activationFactor;

  const weightsGb = weightBytes / GB;
  const gradientsGb = gradientBytes / GB;
  const optimizerGb = optimizerBytes / GB;
  const activationsGb = activationBytes / GB;

  return {
    weightsGb,
    gradientsGb,
    optimizerGb,
    activationsGb,
    overheadGb: OVERHEAD_GB,
    totalGb:
      weightsGb + gradientsGb + optimizerGb + activationsGb + OVERHEAD_GB,
    trainableParamsM: trainable / 1e6,
  };
}

/** The lightest method that fits in the given VRAM, or null. */
export function lightestFit(
  base: Omit<FineTuneInput, "method">,
  vramGb: number
): FineTuneMethod | null {
  const order: FineTuneMethod[] = ["qlora", "lora", "full"];

  // Prefer the highest quality method that fits.
  for (const method of [...order].reverse()) {
    if (estimateFineTune({ ...base, method }).totalGb <= vramGb * 0.9) {
      return method;
    }
  }

  return null;
}

/** Largest batch size (1..32) that fits, or 0 when even 1 does not. */
export function maxBatch(input: FineTuneInput, vramGb: number): number {
  let best = 0;

  for (let b = 1; b <= 32; b++) {
    if (estimateFineTune({ ...input, batchSize: b }).totalGb <= vramGb * 0.9) {
      best = b;
    } else {
      break;
    }
  }

  return best;
}
