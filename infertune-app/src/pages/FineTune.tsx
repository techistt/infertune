import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { bytesToGb } from "../utils/format";
import {
  METHOD_LABEL,
  estimateFineTune,
  lightestFit,
  maxBatch,
  type FineTuneInput,
  type FineTuneMethod,
} from "../utils/finetune";

const METHODS: FineTuneMethod[] = ["qlora", "lora", "full"];

function Row({ label, gb }: { label: string; gb: number }) {
  return (
    <tr className="border-b border-gray-800/60">
      <td className="py-2 pr-4 text-gray-400">{label}</td>
      <td className="py-2 text-right">{gb.toFixed(1)} GB</td>
    </tr>
  );
}

export default function FineTune() {
  const vramGb = bytesToGb(useAppStore((s) => s.gpuStats.memory_total));

  const [input, setInput] = useState<FineTuneInput>({
    paramsB: 7,
    method: "qlora",
    rank: 16,
    seqLen: 1024,
    batchSize: 1,
    gradientCheckpointing: true,
  });

  const set = <K extends keyof FineTuneInput>(key: K, value: FineTuneInput[K]) =>
    setInput((current) => ({ ...current, [key]: value }));

  const est = estimateFineTune(input);
  const fits = vramGb > 0 && est.totalGb <= vramGb * 0.9;
  const { method: _method, ...rest } = input;
  void _method;
  const best = vramGb > 0 ? lightestFit(rest, vramGb) : null;
  const batch = vramGb > 0 ? maxBatch(input, vramGb) : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-xl font-semibold">Fine-tune estimator</h2>
        <p className="mt-1 text-sm text-gray-400">
          Estimates the GPU memory needed to fine-tune a model. This is a
          calculator only: it does not train anything. Figures are planning
          estimates and vary by framework.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-400">
              Model size (billions of parameters)
            </span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={input.paramsB}
              onChange={(e) => set("paramsB", Math.max(Number(e.target.value), 0.1))}
              className="w-full rounded-lg bg-gray-800 p-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-400">Method</span>
            <select
              value={input.method}
              onChange={(e) => set("method", e.target.value as FineTuneMethod)}
              className="w-full rounded-lg bg-gray-800 p-2"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-400">LoRA rank</span>
            <select
              value={input.rank}
              disabled={input.method === "full"}
              onChange={(e) => set("rank", Number(e.target.value))}
              className="w-full rounded-lg bg-gray-800 p-2 disabled:opacity-50"
            >
              {[4, 8, 16, 32, 64, 128].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-400">Sequence length (tokens)</span>
            <select
              value={input.seqLen}
              onChange={(e) => set("seqLen", Number(e.target.value))}
              className="w-full rounded-lg bg-gray-800 p-2"
            >
              {[256, 512, 1024, 2048, 4096, 8192].map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-400">Batch size</span>
            <input
              type="number"
              min={1}
              max={64}
              value={input.batchSize}
              onChange={(e) =>
                set("batchSize", Math.min(Math.max(Math.round(Number(e.target.value)), 1), 64))
              }
              className="w-full rounded-lg bg-gray-800 p-2"
            />
          </label>

          <label className="flex items-center gap-2 pt-6 text-sm">
            <input
              type="checkbox"
              checked={input.gradientCheckpointing}
              onChange={(e) => set("gradientCheckpointing", e.target.checked)}
            />
            Gradient checkpointing
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Estimated memory</h2>
          <span className="text-2xl font-semibold">{est.totalGb.toFixed(1)} GB</span>
        </div>

        <table className="mt-3 w-full max-w-md text-sm">
          <tbody>
            <Row label="Model weights" gb={est.weightsGb} />
            <Row label="Gradients" gb={est.gradientsGb} />
            <Row label="Optimizer state" gb={est.optimizerGb} />
            <Row label="Activations" gb={est.activationsGb} />
            <Row label="CUDA / framework overhead" gb={est.overheadGb} />
          </tbody>
        </table>

        {input.method !== "full" && (
          <p className="mt-2 text-xs text-gray-500">
            About {est.trainableParamsM.toFixed(0)} M trainable parameters.
          </p>
        )}

        <div className="mt-4 text-sm">
          {vramGb <= 0 ? (
            <p className="text-gray-400">No GPU memory detected, so fit cannot be checked.</p>
          ) : fits ? (
            <p className="rounded-lg bg-green-950 p-3 text-green-300">
              Should fit in your {vramGb.toFixed(1)} GB of VRAM. The largest batch
              size that fits is about {batch}.
            </p>
          ) : (
            <p className="rounded-lg bg-red-950 p-3 text-red-300">
              Likely too large for your {vramGb.toFixed(1)} GB of VRAM.
              {best
                ? ` ${METHOD_LABEL[best]} would fit with these settings.`
                : " Try a smaller model, shorter sequences or batch size 1."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
