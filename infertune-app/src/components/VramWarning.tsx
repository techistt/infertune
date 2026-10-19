import { useAppStore } from "../store/useAppStore";
import { useModelMemory } from "../hooks/useModelMemory";
import { bytesToGb } from "../utils/format";
import { estimateAt, vramAdvice } from "../utils/memory";

interface VramWarningProps {
  /** Model about to be used; enables a model-specific check. */
  model?: string;
  /** Context length to check against. Defaults to the Playground setting. */
  context?: number;
}

/** Heads-up shown before running a model that may not fit in GPU memory. */
export default function VramWarning({ model = "", context }: VramWarningProps) {
  const total = useAppStore((s) => s.gpuStats.memory_total);
  const used = useAppStore((s) => s.gpuStats.memory_used);
  const gpuName = useAppStore((s) => s.gpuStats.name);
  const storeContext = useAppStore((s) => s.contextLength);

  const { memory, suggested } = useModelMemory(model);

  const totalGb = bytesToGb(total);
  const freeGb = bytesToGb(Math.max(total - used, 0));

  const estimate = memory ? estimateAt(memory, context ?? storeContext) : null;
  const advice = vramAdvice(estimate ? estimate.vramGb : null, totalGb, freeGb, suggested);

  if (advice.level === "ok") return null;

  const style =
    advice.level === "warn"
      ? "border-yellow-700 bg-yellow-950/40 text-yellow-200"
      : "border-blue-800 bg-blue-950/40 text-blue-200";

  return (
    <div className={`rounded-lg border p-3 text-sm ${style}`}>
      <p className="font-medium">
        {advice.level === "warn" ? "GPU memory is tight" : "Partly runs on the CPU"}
        {gpuName ? ` · ${gpuName}` : ""}
      </p>
      <p className="mt-1 opacity-90">{advice.message}</p>
      {advice.level === "warn" && (
        <p className="mt-1 opacity-80">
          Close other GPU-heavy apps, unload models with{" "}
          <code>ollama stop &lt;model&gt;</code>, or lower the context length.
        </p>
      )}
    </div>
  );
}
