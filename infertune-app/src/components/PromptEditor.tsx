import { useAppStore } from "../store/useAppStore";
import { useHistoryStore, newRecordId } from "../store/historyStore";
import { getActiveProfile } from "../store/settingsStore";
import { toConfig } from "../types/provider";
import { logger, errorMessage } from "../store/logStore";
import { streamText, type StreamingGeneration } from "../services/llmService";
import { tokensPerSecond } from "../utils/format";
import { withHint } from "../utils/hints";
import VramWarning from "./VramWarning";
import PromptLibrary from "./PromptLibrary";

// The running request outlives this component, so leaving the Playground
// page does not lose it (and Stop still works when you come back).
let activeJob: StreamingGeneration | null = null;

function replaceLastTurn(content: string) {
  useAppStore.setState((s) => ({
    conversation: s.conversation.map((turn, index, all) =>
      index === all.length - 1 ? { ...turn, content } : turn
    ),
  }));
}

export default function PromptEditor() {
  const {
    systemPrompt,
    userPrompt,
    model,
    conversationMode,
    conversation,
    generating,
    setSystemPrompt,
    setUserPrompt,
    setResponse,
    setMetrics,
    setConversation,
    setConversationMode,
  } = useAppStore();

  const clearPrompts = () => {
    setSystemPrompt("You are a helpful AI assistant.");
    setUserPrompt("");
  };

  const stop = () => {
    activeJob?.cancel();
  };

  const generateResponse = async () => {
    const state = useAppStore.getState();

    if (state.generating || !state.userPrompt.trim()) return;

    if (!state.model) {
      setResponse("No model selected. Pick one in the Parameters panel.");
      return;
    }

    const profile = getActiveProfile();
    const chatMode = state.conversationMode;
    const history = chatMode ? state.conversation : [];
    const prompt = state.userPrompt;

    state.setGenerating(true);
    setResponse("");

    if (chatMode) {
      setConversation([
        ...history,
        { role: "user", content: prompt },
        { role: "assistant", content: "" },
      ]);
      setUserPrompt("");
    }

    logger.info(
      "generate",
      `${profile.name} / ${state.model}: started (context ${state.contextLength}, max ${state.maxTokens} tokens${chatMode ? `, ${history.length} earlier turns` : ""})`
    );

    let streamed = "";

    const job = streamText(
      {
        model: state.model,

        systemPrompt: state.systemPrompt,
        userPrompt: prompt,
        history,

        temperature: state.temperature,
        topP: state.topP,
        topK: state.topK,

        maxTokens: state.maxTokens,
        seed: state.seed,
        contextLength: state.contextLength,
        numGpu: state.numGpu,
      },
      (delta) => {
        streamed += delta;

        if (chatMode) {
          replaceLastTurn(streamed);
        } else {
          setResponse(streamed);
        }
      },
      toConfig(profile)
    );

    activeJob = job;

    try {
      const result = await job.promise;

      if (chatMode) {
        replaceLastTurn(result.text);
      } else {
        setResponse(result.text);
      }

      setMetrics(result.tokens, result.generationTime);

      const speed = tokensPerSecond(result.tokens, result.generationTime);

      logger.info(
        "generate",
        `${state.model}: ${result.tokens} tokens in ${result.generationTime} ms (${speed} tok/s)${result.cancelled ? " [stopped]" : ""}`
      );

      if (result.text.trim()) {
        useHistoryStore.getState().addSession({
          id: newRecordId(),
          createdAt: Date.now(),
          providerName: profile.name,
          model: state.model,
          systemPrompt: state.systemPrompt,
          userPrompt: prompt,
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
      }
    } catch (error) {
      const message = errorMessage(error);

      if (chatMode) {
        // Drop the failed exchange and give the message back for a retry.
        setConversation(history);
        setUserPrompt(prompt);
      }

      setResponse(`Error: ${withHint(message)}`);
      setMetrics(0, 0);
      logger.error("generate", message);
    } finally {
      activeJob = null;
      useAppStore.getState().setGenerating(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 h-full overflow-y-auto">
      <h2 className="text-xl font-semibold mb-5">
        Prompt Editor
      </h2>

      <div className="space-y-5">

        <VramWarning model={model} />

        <PromptLibrary />

        <div>
          <label className="block mb-2 font-medium">
            System Prompt
          </label>

          <textarea
            rows={4}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full rounded-lg bg-gray-800 p-3 resize-none outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-medium">
              {conversationMode ? "Message" : "User Prompt"}
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={conversationMode}
                disabled={generating}
                onChange={(e) => setConversationMode(e.target.checked)}
              />
              Conversation mode
            </label>
          </div>

          <textarea
            rows={7}
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                generateResponse();
              }
            }}
            placeholder="Ask anything... (Ctrl+Enter to send)"
            className="w-full rounded-lg bg-gray-800 p-3 resize-none outline-none"
          />

          {conversationMode && (
            <p className="mt-2 text-xs text-gray-400">
              Earlier messages are sent with each new one
              {conversation.length > 0 &&
                ` (${Math.ceil(conversation.length / 2)} so far)`}
              . Long chats use more context memory.
            </p>
          )}
        </div>

        <div className="flex gap-3">

          {generating ? (
            <button
              onClick={stop}
              className="flex-1 rounded-lg bg-red-600 py-2 hover:bg-red-700 transition"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={generateResponse}
              disabled={!userPrompt.trim() || !model}
              className="flex-1 rounded-lg bg-blue-600 py-2 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {conversationMode ? "Send" : "Generate"}
            </button>
          )}

          {conversationMode ? (
            <button
              onClick={() => {
                setConversation([]);
                setResponse("");
              }}
              disabled={generating || conversation.length === 0}
              className="flex-1 rounded-lg bg-gray-700 py-2 hover:bg-gray-600 transition disabled:opacity-50"
            >
              New chat
            </button>
          ) : (
            <button
              onClick={clearPrompts}
              disabled={generating}
              className="flex-1 rounded-lg bg-gray-700 py-2 hover:bg-gray-600 transition disabled:opacity-50"
            >
              Clear
            </button>
          )}

        </div>

      </div>
    </div>
  );
}
