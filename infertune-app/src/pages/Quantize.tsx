import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Minimize2 } from "lucide-react";
import { useAppStore, type ModelRanking } from "../store/useAppStore";
import { useActiveProfile } from "../store/settingsStore";
import { toConfig } from "../types/provider";
import {
  getModelRankings,
  quantizeModel,
  type PullProgress,
} from "../services/modelService";
import { logger, errorMessage } from "../store/logStore";
import { notifyDone } from "../services/notify";
import {
  QUANT_TARGETS,
  estimateQuantizedSizeGb,
  isFullPrecision,
  isValidModelName,
  suggestName,
} from "../utils/quantize";

export default function Quantize() {
  const profile = useActiveProfile();
  const online = useAppStore((s) => s.providerOnline);
  const ramTotal = useAppStore((s) => s.hardware.ram_total);
  const gpuMemory = useAppStore((s) => s.gpuStats.memory_total);
  const vendor = useAppStore((s) => s.gpuStats.vendor);
  const setPage = useAppStore((s) => s.setPage);
  const setModel = useAppStore((s) => s.setModel);

  const [models, setModels] = useState<ModelRanking[]>([]);
  const [source, setSource] = useState("");
  const [targetId, setTargetId] = useState("q4_K_M");
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const isOllama = profile.kind === "ollama";
  const target = QUANT_TARGETS.find((t) => t.id === targetId) ?? QUANT_TARGETS[3];
  const src = models.find((m) => m.name === source) ?? null;
  const sourceOk = src ? isFullPrecision(src.quantization) : false;

  const load = useCallback(async () => {
    if (!isOllama || !online) {
      setModels([]);
      return;
    }

    try {
      const list = await getModelRankings(
        ramTotal,
        gpuMemory,
        vendor,
        "general",
        4096,
        toConfig(profile)
      );

      setModels(list);
      setSource((current) => {
        if (list.some((m) => m.name === current)) return current;

        const first = list.find((m) => isFullPrecision(m.quantization));

        return first ? first.name : list[0]?.name ?? "";
      });
    } catch {
      setModels([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOllama, online, profile.id, profile.baseUrl, profile.apiKey, ramTotal, gpuMemory, vendor]);

  useEffect(() => {
    load();
  }, [load]);

  // Suggest a name until the user types their own.
  useEffect(() => {
    if (!nameEdited && source) setName(suggestName(source, target));
  }, [source, target, nameEdited]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<PullProgress>("quantize-progress", (e) => setProgress(e.payload)).then(
      (fn) => {
        if (disposed) fn();
        else unlisten = fn;
      }
    );

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const exists = models.some((m) => m.name === name.trim() || m.name === `${name.trim()}:latest`);
  const nameOk = isValidModelName(name) && !exists;
  const size = src ? estimateQuantizedSizeGb(src.parameters, target) : null;

  const start = async () => {
    if (running || !sourceOk || !nameOk) return;

    setRunning(true);
    setError(null);
    setDone(null);
    setProgress(null);
    logger.info("quantize", `${source} -> ${name.trim()} (${target.id})`);

    try {
      await quantizeModel(toConfig(profile), source, name.trim(), target.id);
      setDone(name.trim());
      logger.info("quantize", `Created ${name.trim()}`);
      notifyDone("Quantize finished", `${name.trim()} is ready.`);
      await load();
    } catch (e) {
      const message = errorMessage(e);

      setError(message);
      logger.error("quantize", message);
    } finally {
      setRunning(false);
    }
  };

  if (!isOllama) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-xl font-semibold">Quantize</h2>
        <p className="mt-2 text-sm text-gray-400">
          Quantizing is only available with Ollama. Switch to an Ollama server in
          Settings.
        </p>
      </div>
    );
  }

  const percent =
    progress && progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-xl font-semibold">Quantize a model</h2>
        <p className="mt-1 text-sm text-gray-400">
          Makes a smaller copy of a model that uses less memory and runs faster,
          with some loss of quality. Ollama can only quantize from a 16-bit or
          32-bit model, so download one first (for example{" "}
          <span className="font-mono">llama3.2:3b-instruct-fp16</span>). Then use
          Quality and Benchmarks to compare the copy with the original.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-400">Source model</span>
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setNameEdited(false);
              }}
              disabled={running}
              className="w-full rounded-lg bg-gray-800 p-2"
            >
              {models.length === 0 && <option value="">No models</option>}
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.quantization ?? "unknown"}
                  {m.size_gb > 0 ? `, ${m.size_gb.toFixed(1)} GB` : ""})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-400">Target level</span>
            <select
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value);
                setNameEdited(false);
              }}
              disabled={running}
              className="w-full rounded-lg bg-gray-800 p-2"
            >
              {QUANT_TARGETS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gray-500">{target.note}</span>
          </label>

          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-xs text-gray-400">New model name</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameEdited(true);
              }}
              disabled={running}
              className="w-full rounded-lg bg-gray-800 p-2 font-mono"
            />
          </label>
        </div>

        {src && !sourceOk && (
          <p className="mt-3 rounded-lg bg-yellow-950 p-3 text-sm text-yellow-300">
            {source} is already {src.quantization ?? "quantized"}, so it cannot be
            quantized again. Pick a 16-bit or 32-bit model, or download one first.
          </p>
        )}

        {name && !isValidModelName(name) && (
          <p className="mt-3 text-sm text-red-400">
            Use letters, numbers, dots, dashes and one optional :tag.
          </p>
        )}
        {exists && (
          <p className="mt-3 text-sm text-red-400">A model with that name already exists.</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={start}
            disabled={running || !sourceOk || !nameOk}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            <Minimize2 size={16} />
            {running ? "Quantizing..." : "Create quantized model"}
          </button>

          {size !== null && (
            <span className="text-sm text-gray-400">
              Expected size: about {size.toFixed(1)} GB. Needs free disk space for
              the copy.
            </span>
          )}
        </div>

        {running && (
          <div className="mt-4 text-sm text-gray-300">
            {progress?.status || "Starting..."}
            {percent > 0 && ` (${percent.toFixed(0)}%)`}
            <p className="mt-1 text-xs text-gray-500">
              This can take several minutes for larger models.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-300 break-words">
            {error}
          </p>
        )}

        {done && (
          <div className="mt-4 rounded-lg bg-green-950 p-3 text-sm text-green-300">
            Created <span className="font-mono">{done}</span>.{" "}
            <button
              className="underline"
              onClick={() => {
                setModel(done);
                setPage("quality");
              }}
            >
              Run a quality check on it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
