import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { FIT_CLASS, FIT_LABEL, formatGb } from "../utils/format";
import {
  PLANNER_QUANTS,
  largestModelFor,
  maxGpuContext,
  planModel,
  weightsGb,
} from "../utils/planner";

const PRESETS = [1, 3, 7, 8, 14, 32, 70];

export default function Planner() {
  const vram = useAppStore((s) => s.gpuStats.memory_total);
  const ram = useAppStore((s) => s.hardware.ram_total);

  const [paramsB, setParamsB] = useState(8);
  const [quantId, setQuantId] = useState("q4_k_m");
  const [limit, setLimit] = useState<number | "">("");

  const rows = planModel({
    paramsB,
    quantId,
    vramBytes: vram,
    ramBytes: ram,
    contextLimit: limit === "" ? null : limit,
  });
  const best = maxGpuContext(rows);
  const biggest = vram > 0 ? largestModelFor(vram, quantId, 4096) : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-xl font-semibold">What fits?</h2>
        <p className="mt-1 text-sm text-gray-400">
          Check a model before you download it. Enter its size and
          quantization to see how much memory each context length needs on your
          computer ({vram > 0 ? `${formatGb(vram)} VRAM` : "no GPU memory"},{" "}
          {formatGb(ram)} RAM).
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-400">
              Parameters (billions)
            </span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={paramsB}
              onChange={(e) => setParamsB(Math.max(Number(e.target.value), 0.1))}
              className="w-28 rounded-lg bg-gray-800 p-2"
            />
          </label>

          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setParamsB(p)}
                className={`rounded px-2 py-1 text-xs ${
                  paramsB === p ? "bg-blue-700" : "bg-gray-800 hover:bg-gray-700"
                }`}
              >
                {p}B
              </button>
            ))}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-400">Quantization</span>
            <select
              value={quantId}
              onChange={(e) => setQuantId(e.target.value)}
              className="rounded-lg bg-gray-800 p-2"
            >
              {PLANNER_QUANTS.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-400">
              Model's max context (optional)
            </span>
            <input
              type="number"
              min={2048}
              step={1024}
              value={limit}
              onChange={(e) =>
                setLimit(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="no limit"
              className="w-32 rounded-lg bg-gray-800 p-2"
            />
          </label>
        </div>

        <div className="mt-4 rounded-lg bg-gray-800 p-3 text-sm">
          Weights alone: about {weightsGb(paramsB, quantId).toFixed(1)} GB.{" "}
          {vram > 0 &&
            (best
              ? `On your GPU it fits fully up to a ${best.toLocaleString()} token context.`
              : "It does not fit fully on your GPU at any listed context; part would run on the CPU.")}
          {biggest > 0 &&
            ` At this quantization and a 4,096 context, the largest model that fits fully on your GPU is about ${biggest}B.`}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th className="py-2 pr-4 font-medium">Context</th>
              <th className="py-2 pr-4 font-medium">VRAM needed</th>
              <th className="py-2 pr-4 font-medium">RAM needed</th>
              <th className="py-2 font-medium">Fit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.context} className="border-b border-gray-800/60">
                <td className="py-2 pr-4">{r.context.toLocaleString()} tokens</td>
                <td className="py-2 pr-4">{r.vramGb.toFixed(1)} GB</td>
                <td className="py-2 pr-4">{r.ramGb.toFixed(1)} GB</td>
                <td className="py-2">
                  <span className={`rounded px-2 py-1 text-xs ${FIT_CLASS[r.fit]}`}>
                    {FIT_LABEL[r.fit]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-gray-500">
          Estimates: weights plus a KV cache sized from the parameter count plus
          runtime overhead (0.5 GB on GPU, 1 GB on CPU). Real use varies by model design
          and server.
        </p>
      </div>
    </div>
  );
}
