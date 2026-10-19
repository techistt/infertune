import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { useAppStore, type ModelRanking } from "../store/useAppStore";
import { useActiveProfile } from "../store/settingsStore";
import { toConfig } from "../types/provider";
import {
  deleteModel,
  getModelRankings,
  pullModel,
  type PullProgress,
} from "../services/modelService";
import { logger, errorMessage } from "../store/logStore";
import { FIT_CLASS, FIT_LABEL, formatGb, modelFit } from "../utils/format";
import ContextSelect from "../components/ContextSelect";
import Bar from "../components/Bar";

const EXAMPLES = ["llama3.2:3b", "qwen2.5:7b", "mistral:7b", "gemma2:2b"];

export default function Models() {
  const profile = useActiveProfile();

  const ramTotal = useAppStore((s) => s.hardware.ram_total);
  const gpuMemory = useAppStore((s) => s.gpuStats.memory_total);
  const vendor = useAppStore((s) => s.gpuStats.vendor);
  const online = useAppStore((s) => s.providerOnline);
  const contextLength = useAppStore((s) => s.contextLength);
  const setContextLength = useAppStore((s) => s.setContextLength);
  const setModel = useAppStore((s) => s.setModel);
  const setPage = useAppStore((s) => s.setPage);
  const activeModel = useAppStore((s) => s.model);

  const [rows, setRows] = useState<ModelRanking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pullName, setPullName] = useState("");
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const isOllama = profile.kind === "ollama";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const list = await getModelRankings(
        ramTotal,
        gpuMemory,
        vendor,
        "general",
        contextLength,
        toConfig(profile)
      );

      setRows(list);
    } catch (e) {
      setRows([]);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ramTotal,
    gpuMemory,
    vendor,
    contextLength,
    profile.id,
    profile.kind,
    profile.baseUrl,
    profile.apiKey,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  // Download progress is streamed from the backend as events.
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<PullProgress>("pull-progress", (event) => {
      setProgress(event.payload);
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const startPull = async () => {
    const name = pullName.trim();

    if (!name || pulling) return;

    setPulling(true);
    setProgress(null);
    setError(null);
    logger.info("models", `Downloading ${name}`);

    try {
      await pullModel(toConfig(profile), name);
      logger.info("models", `Downloaded ${name}`);
      setPullName("");
      await load();
    } catch (e) {
      setError(`Download failed: ${errorMessage(e)}`);
      logger.error("models", `Download of ${name} failed: ${errorMessage(e)}`);
    } finally {
      setPulling(false);
      setProgress(null);
    }
  };

  const removeModel = async (name: string) => {
    setConfirmDelete(null);
    setError(null);

    try {
      await deleteModel(toConfig(profile), name);
      logger.info("models", `Removed ${name}`);

      if (useAppStore.getState().model === name) {
        setModel("");
      }

      await load();
    } catch (e) {
      setError(`Could not remove ${name}: ${errorMessage(e)}`);
      logger.error("models", `Remove of ${name} failed: ${errorMessage(e)}`);
    }
  };

  const percent =
    progress && progress.total > 0
      ? (progress.completed / progress.total) * 100
      : 0;

  return (
    <div className="space-y-5">

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Installed models</h2>
            <p className="text-sm text-gray-400 mt-1">
              {profile.name}
              {" · "}
              {online ? "online" : "offline"}
              {" · estimates for "}
              {gpuMemory > 0 ? `${formatGb(gpuMemory)} VRAM` : "no GPU memory"}
              {" and "}
              {formatGb(ramTotal)} RAM
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Context for estimates
              </label>
              <ContextSelect
                value={contextLength}
                onChange={setContextLength}
                className="rounded-lg bg-gray-800 p-2"
              />
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 hover:bg-gray-600 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-300 break-words">
            {error}
          </p>
        )}

        <div className="mt-5 overflow-x-auto">
          {rows.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 font-medium">Params</th>
                  <th className="py-2 pr-4 font-medium">Quant</th>
                  <th className="py-2 pr-4 font-medium">Size</th>
                  <th className="py-2 pr-4 font-medium">VRAM needed</th>
                  <th className="py-2 pr-4 font-medium">RAM needed</th>
                  <th className="py-2 pr-4 font-medium">Fit</th>
                  <th className="py-2 pr-4 font-medium">Score</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>

              <tbody>
                {rows.map((m) => {
                  const fit = modelFit(
                    m.estimated_vram_gb,
                    m.estimated_ram_gb,
                    gpuMemory,
                    ramTotal
                  );

                  return (
                    <tr key={m.name} className="border-b border-gray-800/60">
                      <td className="py-3 pr-4">
                        <div className="font-medium break-all">
                          {m.name}
                          {m.name === activeModel && (
                            <span className="ml-2 rounded bg-blue-900/60 px-1.5 py-0.5 text-xs text-blue-300">
                              active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {m.family} · {m.purpose}
                        </div>
                      </td>

                      <td className="py-3 pr-4">
                        {m.parameters !== null ? `${m.parameters}B` : "-"}
                      </td>

                      <td className="py-3 pr-4 uppercase">
                        {m.quantization ?? "-"}
                      </td>

                      <td className="py-3 pr-4">
                        {m.size_gb > 0 ? `${m.size_gb.toFixed(1)} GB` : "-"}
                      </td>

                      <td className="py-3 pr-4">
                        {m.estimated_vram_gb.toFixed(1)} GB
                      </td>

                      <td className="py-3 pr-4">
                        {m.estimated_ram_gb.toFixed(1)} GB
                      </td>

                      <td className="py-3 pr-4">
                        <span
                          className={`rounded px-2 py-1 text-xs whitespace-nowrap ${FIT_CLASS[fit]}`}
                        >
                          {FIT_LABEL[fit]}
                        </span>
                      </td>

                      <td className="py-3 pr-4">{m.score}</td>

                      <td className="py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setModel(m.name);
                              setPage("playground");
                            }}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 hover:bg-blue-700"
                          >
                            Use
                          </button>

                          {isOllama &&
                            (confirmDelete === m.name ? (
                              <>
                                <button
                                  onClick={() => removeModel(m.name)}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="rounded-lg bg-gray-700 px-3 py-1.5 hover:bg-gray-600"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(m.name)}
                                title="Remove model"
                                className="rounded-lg bg-gray-800 p-2 text-gray-400 hover:text-red-400"
                              >
                                <Trash2 size={16} />
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-gray-500">
              {loading
                ? "Loading models..."
                : online
                  ? "No models found on this server."
                  : `${profile.name} is offline. Start it, or choose another server in Settings.`}
            </p>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Memory figures are estimates: model weights plus the KV cache at the
          chosen context length plus runtime overhead.
          {!isOllama &&
            " This server does not report model details, so sizes are estimated from the model name."}
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-xl font-semibold mb-1">Download a model</h2>

        {isOllama ? (
          <>
            <p className="text-sm text-gray-400 mb-4">
              Enter a model name from the Ollama library.
            </p>

            <div className="flex flex-wrap gap-3">
              <input
                value={pullName}
                onChange={(e) => setPullName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") startPull();
                }}
                placeholder="e.g. llama3.2:3b"
                disabled={pulling}
                className="flex-1 min-w-[16rem] rounded-lg bg-gray-800 p-2 outline-none"
              />

              <button
                onClick={startPull}
                disabled={pulling || !pullName.trim()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
              >
                <Download size={16} />
                {pulling ? "Downloading..." : "Download"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              Examples:
              {EXAMPLES.map((name) => (
                <button
                  key={name}
                  onClick={() => setPullName(name)}
                  disabled={pulling}
                  className="rounded bg-gray-800 px-2 py-1 text-gray-300 hover:bg-gray-700"
                >
                  {name}
                </button>
              ))}
            </div>

            {pulling && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-300 mb-1">
                  <span>{progress?.status || "Starting..."}</span>
                  <span>
                    {progress && progress.total > 0
                      ? `${formatGb(progress.completed, 2)} / ${formatGb(progress.total, 2)} (${percent.toFixed(0)}%)`
                      : ""}
                  </span>
                </div>
                <Bar percent={percent} />
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">
            Downloading and removing models is only available for Ollama.
            With {profile.name}, load or switch models in the {profile.name} app
            itself; they will appear here after you press Refresh.
          </p>
        )}
      </div>

    </div>
  );
}
