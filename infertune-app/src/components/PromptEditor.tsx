import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useHistoryStore, newRecordId } from "../store/historyStore";
import { getActiveProfile } from "../store/settingsStore";
import { toConfig } from "../types/provider";
import { logger, errorMessage } from "../store/logStore";
import { generateText } from "../services/llmService";
import { tokensPerSecond } from "../utils/format";
import { withHint } from "../utils/hints";
import VramWarning from "./VramWarning";

export default function PromptEditor() {
  const {
    systemPrompt,
    userPrompt,
    model,
    setSystemPrompt,
    setUserPrompt,
    setResponse,
    setMetrics,
  } = useAppStore();

  const [busy, setBusy] = useState(false);

  const clearPrompts = () => {
    setSystemPrompt("You are a helpful AI assistant.");
    setUserPrompt("");
  };

  const generateResponse = async () => {

    const state = useAppStore.getState();

    if (busy || !state.userPrompt.trim()) return;

    if (!state.model) {
      setResponse("No model selected. Pick one in the Parameters panel.");
      return;
    }

    const profile = getActiveProfile();

    setBusy(true);
    setResponse("");

    logger.info(
      "generate",
      `${profile.name} / ${state.model}: started (context ${state.contextLength}, max ${state.maxTokens} tokens)`
    );

    try {
      const result = await generateText(
        {
          model: state.model,

          systemPrompt: state.systemPrompt,
          userPrompt: state.userPrompt,

          temperature: state.temperature,
          topP: state.topP,
          topK: state.topK,

          maxTokens: state.maxTokens,
          seed: state.seed,
          contextLength: state.contextLength,
        },
        toConfig(profile)
      );

      setResponse(result.text);

      setMetrics(
        result.tokens,
        result.generationTime
      );

      const speed = tokensPerSecond(result.tokens, result.generationTime);

      logger.info(
        "generate",
        `${state.model}: ${result.tokens} tokens in ${result.generationTime} ms (${speed} tok/s)`
      );

      useHistoryStore.getState().addSession({
        id: newRecordId(),
        createdAt: Date.now(),
        providerName: profile.name,
        model: state.model,
        systemPrompt: state.systemPrompt,
        userPrompt: state.userPrompt,
        response: result.text,
        temperature: state.temperature,
        topP: state.topP,
        topK: state.topK,
        maxTokens: state.maxTokens,
        seed: state.seed,
        contextLength: state.contextLength,
        tokens: result.tokens,
        generationTime: result.generationTime,
        tokensPerSecond: speed,
      });
    } catch (error) {
      const message = errorMessage(error);

      setResponse(`Error: ${withHint(message)}`);
      setMetrics(0, 0);
      logger.error("generate", message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 h-full">
      <h2 className="text-xl font-semibold mb-5">
        Prompt Editor
      </h2>

      <div className="space-y-5">

        <VramWarning model={model} />

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
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                generateResponse();
              }
            }}
            placeholder="Ask anything... (Ctrl+Enter to generate)"
            className="w-full rounded-lg bg-gray-800 p-3 resize-none outline-none"
          />
        </div>

        <div className="flex gap-3">

          <button
            onClick={generateResponse}
            disabled={busy || !userPrompt.trim() || !model}
            className="flex-1 rounded-lg bg-blue-600 py-2 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Generating..." : "Generate"}
          </button>

          <button
            onClick={clearPrompts}
            disabled={busy}
            className="flex-1 rounded-lg bg-gray-700 py-2 hover:bg-gray-600 transition disabled:opacity-50"
          >
            Clear
          </button>

        </div>

      </div>
    </div>
  );
}
