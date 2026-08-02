import { useAppStore } from "../store/useAppStore";

export default function PromptEditor() {
 const {
  systemPrompt,
  userPrompt,
  setSystemPrompt,
  setUserPrompt,
} = useAppStore();

  const clearPrompts = () => {
  setSystemPrompt("You are a helpful AI assistant.");
  setUserPrompt("");
};

  const generateResponse = () => {
  const state = useAppStore.getState();

  console.clear();

  console.log("========== InferTune ==========");
  console.log("Model:", state.model);
  console.log("Temperature:", state.temperature);
  console.log("Top P:", state.topP);
  console.log("Top K:", state.topK);
  console.log("Max Tokens:", state.maxTokens);
  console.log("Seed:", state.seed);

  console.log("System Prompt:");
  console.log(state.systemPrompt);

  console.log("User Prompt:");
  console.log(state.userPrompt);
};

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 h-full">
      <h2 className="text-xl font-semibold mb-5">
        Prompt Editor
      </h2>

      <div className="space-y-5">

        <div>
          <label className="block mb-2 font-medium">
            System Prompt
          </label>

          <textarea
            rows={6}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full rounded-lg bg-gray-800 p-3 resize-none outline-none"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium">
            User Prompt
          </label>

          <textarea
            rows={8}
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Ask anything..."
            className="w-full rounded-lg bg-gray-800 p-3 resize-none outline-none"
          />
        </div>

        <div className="flex gap-3">

          <button
            onClick={generateResponse}
            className="flex-1 rounded-lg bg-blue-600 py-2 hover:bg-blue-700 transition"
          >
            Generate
          </button>

          <button
            onClick={clearPrompts}
            className="flex-1 rounded-lg bg-gray-700 py-2 hover:bg-gray-600 transition"
          >
            Clear
          </button>

        </div>

      </div>
    </div>
  );
}