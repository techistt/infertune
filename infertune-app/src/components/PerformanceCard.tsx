import { useAppStore } from "../store/useAppStore";

export default function PerformanceCard() {
  const {
    model,
    tokens,
    generationTime,
    tokensPerSecond,
  } = useAppStore();

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 h-full overflow-hidden">
      <h2 className="text-lg font-semibold mb-3">
        Performance
      </h2>

      <div className="space-y-2 text-sm">

        <div className="flex justify-between">
          <span className="text-gray-400">
            Model
          </span>

          <span>
            {model}
          </span>
        </div>


        <div className="flex justify-between">
          <span className="text-gray-400">
            Tokens Generated
          </span>

          <span>
            {tokens}
          </span>
        </div>


        <div className="flex justify-between">
          <span className="text-gray-400">
            Generation Time
          </span>

          <span>
            {generationTime} ms
          </span>
        </div>


        <div className="flex justify-between">
          <span className="text-gray-400">
            Speed
          </span>

          <span className="text-green-400">
            {tokensPerSecond} tokens/s
          </span>
        </div>

      </div>

    </div>
  );
}