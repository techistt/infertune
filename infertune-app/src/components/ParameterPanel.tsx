import { useAppStore } from "../store/useAppStore";

export default function ParameterPanel() {
  const {
  model,
  temperature,
  topP,
  topK,
  maxTokens,
  seed,

  setModel,
  setTemperature,
  setTopP,
  setTopK,
  setMaxTokens,
  setSeed,
} = useAppStore();

  const resetValues = () => {
  setModel("Llama 3.1");
  setTemperature(0.7);
  setTopP(0.9);
  setTopK(40);
  setMaxTokens(1024);
  setSeed(42);
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
            <option>Llama 3.1</option>
            <option>Mistral</option>
            <option>DeepSeek</option>
            <option>Phi-3</option>
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