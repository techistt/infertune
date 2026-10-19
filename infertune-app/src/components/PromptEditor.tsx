import { useAppStore } from "../store/useAppStore";
import { generateText } from "../services/llmService";

export default function PromptEditor() {
  const {
    systemPrompt,
    userPrompt,
    setSystemPrompt,
    setUserPrompt,
    setResponse,
    setMetrics,
  } = useAppStore();

  const clearPrompts = () => {
    setSystemPrompt("You are a helpful AI assistant.");
    setUserPrompt("");
  };

  const generateResponse = async () => {

    const state = useAppStore.getState();

    const result = await generateText({
      model: state.model,

      systemPrompt: state.systemPrompt,
      userPrompt: state.userPrompt,

      temperature: state.temperature,
      topP: state.topP,
      topK: state.topK,

      maxTokens: state.maxTokens,
      seed: state.seed,
      contextLength: state.contextLength,
    });

    console.log("RECEIVED FROM RUST:", result);


    setResponse(result.text)

    setMetrics(
      result.tokens,
      result.generationTime
    )
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