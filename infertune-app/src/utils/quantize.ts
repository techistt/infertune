export interface QuantTarget {
  /** The exact name Ollama expects. */
  id: string;
  label: string;
  /** Approximate size relative to the original in GB per billion parameters. */
  gbPerBillion: number;
  note: string;
}

export const QUANT_TARGETS: QuantTarget[] = [
  { id: "q8_0", label: "Q8_0", gbPerBillion: 1.06, note: "Almost lossless, about half the size of 16-bit." },
  { id: "q6_K", label: "Q6_K", gbPerBillion: 0.82, note: "Very close to the original quality." },
  { id: "q5_K_M", label: "Q5_K_M", gbPerBillion: 0.7, note: "Good quality, a bit larger than Q4." },
  { id: "q4_K_M", label: "Q4_K_M", gbPerBillion: 0.58, note: "The usual sweet spot of size and quality." },
  { id: "q4_K_S", label: "Q4_K_S", gbPerBillion: 0.56, note: "Slightly smaller than Q4_K_M." },
  { id: "q3_K_M", label: "Q3_K_M", gbPerBillion: 0.42, note: "Small; quality starts to drop noticeably." },
  { id: "q2_K", label: "Q2_K", gbPerBillion: 0.3, note: "Smallest; expect clearly worse answers." },
];

/** True for 16-bit and 32-bit sources, which Ollama can quantize. */
export function isFullPrecision(quantization: string | null | undefined): boolean {
  if (!quantization) return false;

  return /^(f16|f32|fp16|fp32|bf16)$/i.test(quantization.trim());
}

/** Estimated size of the new model in GB, or null when the size is unknown. */
export function estimateQuantizedSizeGb(
  paramsB: number | null,
  target: QuantTarget
): number | null {
  if (paramsB === null || paramsB <= 0) return null;

  return paramsB * target.gbPerBillion;
}

/** A name for the new model: swaps a trailing 16-bit marker, or adds the level. */
export function suggestName(source: string, target: QuantTarget): string {
  const level = target.id.toLowerCase();
  const tag = /:(?:fp16|f16|fp32|f32|bf16)$/i;

  // "model:f16" -> "model:q4_k_m"
  if (tag.test(source)) return source.replace(tag, `:${level}`);

  const swapped = source.replace(/[-_](?:fp16|f16|fp32|f32|bf16)$/i, "");

  return `${swapped}-${level}`;
}

/** Ollama model names: lowercase-friendly path, optional :tag. */
export function isValidModelName(name: string): boolean {
  return /^[a-z0-9][a-z0-9._\-/]*(:[a-z0-9][a-z0-9._-]*)?$/i.test(name.trim());
}
