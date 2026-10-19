import { useAppStore } from "../store/useAppStore";
import { bytesToGb } from "../utils/format";

/** Heads-up shown when little GPU memory is free. */
const WARN_BELOW_GB = 1.5;

export default function VramWarning() {
  const total = useAppStore((s) => s.gpuStats.memory_total);
  const used = useAppStore((s) => s.gpuStats.memory_used);
  const gpuName = useAppStore((s) => s.gpuStats.name);

  // No GPU memory reading (CPU-only or unsupported GPU): nothing to warn about.
  if (total <= 0) return null;

  const freeGb = bytesToGb(Math.max(total - used, 0));

  if (freeGb >= WARN_BELOW_GB) return null;

  return (
    <div className="rounded-lg border border-yellow-700 bg-yellow-950/40 p-3 text-sm text-yellow-200">
      <p className="font-medium">
        Low GPU memory: {freeGb.toFixed(1)} GB free
        {gpuName ? ` on ${gpuName}` : ""}
      </p>
      <p className="mt-1 text-yellow-300/80">
        A model that is already loaded can keep running, but loading a new one
        may crash the server. Close other GPU-heavy apps, unload models with{" "}
        <code>ollama stop &lt;model&gt;</code>, or lower the context length.
      </p>
    </div>
  );
}
