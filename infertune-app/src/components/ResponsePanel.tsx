import { useAppStore } from "../store/useAppStore";

export default function ResponsePanel() {
  const {
    response,
    setResponse,
    tokens,
    generationTime,
    tokensPerSecond
  } = useAppStore();

  const copyResponse = async () => {
    if (!response) return;
    await navigator.clipboard.writeText(response);
  };

  const clearResponse = () => {
    setResponse("");
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 h-full min-h-0 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold">
          Response
        </h2>

        <div className="flex gap-2">
          <button
            onClick={copyResponse}
            className="rounded-lg bg-gray-700 px-3 py-2 hover:bg-gray-600 transition"
          >
            Copy
          </button>

          <button
            onClick={clearResponse}
            className="rounded-lg bg-red-600 px-3 py-2 hover:bg-red-700 transition"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-lg bg-gray-800 p-4 overflow-y-auto whitespace-pre-wrap">
        {response ? (
          response
        ) : (
          <p className="text-gray-500 text-center mt-12">
            No response generated yet.
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-between text-sm text-gray-400 border-t border-gray-800 pt-3">
        <span>
          Tokens: {tokens}
        </span>

        <span>
          Time: {generationTime} ms
        </span>

        <span>
          Speed: {tokensPerSecond} tok/s
        </span>
      </div>
    </div>
  );
}