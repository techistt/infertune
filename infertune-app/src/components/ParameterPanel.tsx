import { useEffect, useState } from "react";
import { getModels, getModelContextLimit } from "../services/modelService";
import { useAppStore } from "../store/useAppStore";

export default function ParameterPanel() {
  const [models, setModels] = useState<string[]>([]);
  const [contextLimit, setContextLimit] = useState<number | null>(null);
  useEffect(() => {

    async function loadModels() {

      try {
        const result = await getModels();

        setModels(result);

        if (result.length > 0) {
          setModel(result[0]);
        }

      } catch (error) {
        console.error(
          "Failed to load models:",
          error
        );
      }
    }


    loadModels();

  }, []);
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

  // Offer only context sizes the selected model supports.
  useEffect(() => {
    let cancelled = false;

    getModelContextLimit(model).then((limit) => {
      if (cancelled) return;

      setContextLimit(limit);

      if (limit !== null && useAppStore.getState().contextLength > limit) {
        setContextLength(limit);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [model]);

  const contextOptions = [2048, 4096, 8192, 16384, 32768, 65536, 131072].filter(
    (n) => contextLimit === null || n <= contextLimit
  );

  // Make sure the current value is always selectable (e.g. a limit of 40960).
  if (!contextOptions.includes(contextLength)) {
    contextOptions.push(contextLength);
    contextOptions.sort((a, b) => a - b);
  }

  const resetValues = () => {
    setModel("hermes3:latest");
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
          <label className="block text-sm mb-2">Model</label>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg bg-gray-800 p-2"
          >
            {models.map((modelName) => (
              <option
                key={modelName}
                value={modelName}
              >
                {modelName}
              </option>
            ))}
          </select>
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

          <select
            value={contextLength}
            onChange={(e) => setContextLength(Number(e.target.value))}
            className="w-full rounded-lg bg-gray-800 p-2"
          >
            {contextOptions.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()} tokens
              </option>
            ))}
          </select>

          <p className="text-xs text-gray-400 mt-1">
            {contextLimit !== null
              ? `Model supports up to ${contextLimit.toLocaleString()} tokens. `
              : ""}
            Larger context uses more memory (KV cache).
          </p>
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

        <div className="flex gap-3 pt-2">
          <button
            className="flex-1 rounded-lg bg-blue-600 py-2 hover:bg-blue-700"
          >
            Apply
          </button>

          <button
            onClick={resetValues}
            className="flex-1 rounded-lg bg-gray-700 py-2 hover:bg-gray-600"
          >
            Reset
          </button>
        </div>

      </div>
    </div>
  );
}