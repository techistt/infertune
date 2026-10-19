import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getModelContextLimit, listModels } from "../services/modelService";
import { useAppStore } from "../store/useAppStore";
import { useActiveProfile } from "../store/settingsStore";
import { toConfig } from "../types/provider";
import { logger, errorMessage } from "../store/logStore";
import ContextSelect from "./ContextSelect";
import { useModelMemory } from "../hooks/useModelMemory";

export default function ParameterPanel() {
  const [models, setModels] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contextLimit, setContextLimit] = useState<number | null>(null);

  const profile = useActiveProfile();
  const gpuTotal = useAppStore((s) => s.gpuStats.memory_total);

  const {
    model,
    temperature,
    topP,
    topK,
    maxTokens,
    seed,
    contextLength,

    setModel,
    setTemperature,
    setTopP,
    setTopK,
    setMaxTokens,
    setSeed,
    setContextLength,
  } = useAppStore();

  const { suggested } = useModelMemory(model);

  const loadModels = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await listModels(toConfig(profile));
      const names = result.map((m) => m.name);

      setModels(names);

      // Keep the current selection when it still exists on this server.
      const current = useAppStore.getState().model;

      if (names.length > 0 && !names.includes(current)) {
        setModel(names[0]);
      }
    } catch (error) {
      setModels([]);
      setLoadError(errorMessage(error));
      logger.warn("models", `Could not list models: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, profile.kind, profile.baseUrl, profile.apiKey]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Offer only context sizes the selected model supports (Ollama reports this).
  useEffect(() => {
    let cancelled = false;

    if (!model) {
      setContextLimit(null);
      return;
    }

    getModelContextLimit(model, toConfig(profile)).then((limit) => {
      if (cancelled) return;

      setContextLimit(limit);

      if (limit !== null && useAppStore.getState().contextLength > limit) {
        setContextLength(limit);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, profile.id, profile.baseUrl]);

  const resetValues = () => {
    setTemperature(0.7);
    setTopP(0.9);
    setTopK(40);
    setMaxTokens(1024);
    setSeed(42);
    setContextLength(4096);
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="text-xl font-semibold mb-5">
        Parameters
      </h2>

      <div className="space-y-5">

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm">
              Model <span className="text-gray-500">({profile.name})</span>
            </label>

            <button
              onClick={loadModels}
              disabled={loading}
              title="Reload models"
              className="text-gray-400 hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={models.length === 0}
            className="w-full rounded-lg bg-gray-800 p-2"
          >
            {models.length === 0 && (
              <option value="">
                {loading ? "Loading..." : "No models available"}
              </option>
            )}

            {models.map((modelName) => (
              <option
                key={modelName}
                value={modelName}
              >
                {modelName}
              </option>
            ))}
          </select>

          {loadError && (
            <p className="mt-2 text-xs text-red-400 break-words">
              {loadError}
            </p>
          )}
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label>Temperature</label>
            <span>{temperature.toFixed(2)}</span>
          </div>

          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label>Top P</label>
            <span>{topP.toFixed(2)}</span>
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={topP}
            onChange={(e) => setTopP(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-2">Top K</label>

          <input
            type="number"
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="w-full rounded-lg bg-gray-800 p-2"
          />
        </div>

        <div>
          <label className="block mb-2">Max Tokens</label>

          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            className="w-full rounded-lg bg-gray-800 p-2"
          />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label>Context Length</label>
            <span>{contextLength.toLocaleString()}</span>
          </div>

          <ContextSelect
            value={contextLength}
            onChange={setContextLength}
            limit={contextLimit}
          />

          <p className="text-xs text-gray-400 mt-1">
            {contextLimit !== null
              ? `Model supports up to ${contextLimit.toLocaleString()} tokens. `
              : ""}
            Larger context uses more memory (KV cache).
            {!profile.kind.startsWith("ollama") &&
              " This server fixes its context size when it starts, so this only affects estimates."}
          </p>

          {gpuTotal > 0 && model && (
            <p className="text-xs mt-2 text-gray-300">
              {suggested !== null ? (
                suggested === contextLength ? (
                  <>Best fit for your GPU: {suggested.toLocaleString()} tokens.</>
                ) : (
                  <>
                    Largest context that fits your GPU:{" "}
                    {suggested.toLocaleString()} tokens.{" "}
                    <button
                      onClick={() => setContextLength(suggested)}
                      className="text-blue-400 hover:underline"
                    >
                      Use it
                    </button>
                  </>
                )
              ) : (
                <>This model does not fully fit your GPU at any size, so part of it will run on the CPU.</>
              )}
            </p>
          )}
        </div>

        <div>
          <label className="block mb-2">Seed</label>

          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className="w-full rounded-lg bg-gray-800 p-2"
          />
        </div>

        <div className="pt-2">
          <button
            onClick={resetValues}
            className="w-full rounded-lg bg-gray-700 py-2 hover:bg-gray-600"
          >
            Reset
          </button>
        </div>

      </div>
    </div>
  );
}
