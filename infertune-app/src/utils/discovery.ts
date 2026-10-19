import { modelFit, type Fit } from "./format";

export interface CatalogModel {
  name: string;
  family: string;
  purpose: string;
  paramsB: number;
  /** Approximate download size in GB at the default 4-bit quantization. */
  sizeGb: number;
}

/** A small curated list of widely used Ollama models. Sizes are approximate. */
export const CATALOG: CatalogModel[] = [
  { name: "llama3.2:1b", family: "Llama", purpose: "Tiny, very fast", paramsB: 1.2, sizeGb: 1.3 },
  { name: "llama3.2:3b", family: "Llama", purpose: "Small general model", paramsB: 3.2, sizeGb: 2.0 },
  { name: "llama3.1:8b", family: "Llama", purpose: "General purpose", paramsB: 8, sizeGb: 4.9 },
  { name: "qwen2.5:3b", family: "Qwen", purpose: "Small, multilingual", paramsB: 3, sizeGb: 1.9 },
  { name: "qwen2.5:7b", family: "Qwen", purpose: "General purpose", paramsB: 7.6, sizeGb: 4.7 },
  { name: "qwen2.5:14b", family: "Qwen", purpose: "Stronger general model", paramsB: 14.8, sizeGb: 9.0 },
  { name: "qwen2.5-coder:7b", family: "Qwen", purpose: "Coding", paramsB: 7.6, sizeGb: 4.7 },
  { name: "mistral:7b", family: "Mistral", purpose: "General purpose", paramsB: 7.2, sizeGb: 4.1 },
  { name: "gemma2:2b", family: "Gemma", purpose: "Small, efficient", paramsB: 2.6, sizeGb: 1.6 },
  { name: "gemma2:9b", family: "Gemma", purpose: "General purpose", paramsB: 9.2, sizeGb: 5.4 },
  { name: "phi3:mini", family: "Phi", purpose: "Small reasoning", paramsB: 3.8, sizeGb: 2.2 },
  { name: "deepseek-r1:7b", family: "DeepSeek", purpose: "Reasoning", paramsB: 7.6, sizeGb: 4.7 },
  { name: "deepseek-r1:14b", family: "DeepSeek", purpose: "Reasoning", paramsB: 14.8, sizeGb: 9.0 },
];

export interface CatalogEntry extends CatalogModel {
  fit: Fit;
  estVramGb: number;
  estRamGb: number;
  installed: boolean;
}

/** Rough memory need: the download plus 15% for the KV cache and overhead. */
export function estimateModelMemory(m: CatalogModel): number {
  return m.sizeGb * 1.15 + 0.5;
}

export function sameModel(installed: string, name: string): boolean {
  const norm = (n: string) => (n.includes(":") ? n : `${n}:latest`);

  return norm(installed) === norm(name);
}

/** Catalog with fit and install status, best-fitting and largest first. */
export function discover(
  installedNames: string[],
  vramBytes: number,
  ramBytes: number
): CatalogEntry[] {
  const order: Record<Fit, number> = { gpu: 0, partial: 1, cpu: 2, toolarge: 3 };

  return CATALOG.map((m) => {
    const need = estimateModelMemory(m);

    return {
      ...m,
      estVramGb: need,
      estRamGb: need,
      fit: modelFit(need, need, vramBytes, ramBytes),
      installed: installedNames.some((n) => sameModel(n, m.name)),
    };
  }).sort((a, b) => order[a.fit] - order[b.fit] || b.paramsB - a.paramsB);
}
