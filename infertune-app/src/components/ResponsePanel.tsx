import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";

export default function ResponsePanel() {
  const {
    response,
    setResponse,
    tokens,
    generationTime,
    tokensPerSecond,
    conversationMode,
    conversation,
    setConversation,
    generating,
  } = useAppStore();

  const [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const showChat = conversationMode && conversation.length > 0;
  const isError = response.startsWith("Error:");

  // Follow the text as it streams in.
  useEffect(() => {
    const el = scroller.current;

    if (el && generating) {
      el.scrollTop = el.scrollHeight;
    }
  }, [response, conversation, generating]);

  const copyText = showChat
    ? conversation
        .map((t) => `${t.role === "user" ? "You" : "Assistant"}: ${t.content}`)
        .join("\n\n")
    : response;

  const copyResponse = async () => {
    if (!copyText) return;

    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable; nothing else to do.
    }
  };

  const clearResponse = () => {
    setResponse("");

    if (conversationMode) {
      setConversation([]);
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 h-full min-h-0 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold">
          {showChat ? "Conversation" : "Response"}
        </h2>

        <div className="flex gap-2">
          <button
            onClick={copyResponse}
            className="rounded-lg bg-gray-700 px-3 py-2 hover:bg-gray-600 transition"
          >
            {copied ? "Copied" : "Copy"}
          </button>

          <button
            onClick={clearResponse}
            disabled={generating}
            className="rounded-lg bg-red-600 px-3 py-2 hover:bg-red-700 transition disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="flex-1 min-h-0 rounded-lg bg-gray-800 p-4 overflow-y-auto"
      >
        {showChat ? (
          <div className="space-y-4">
            {conversation.map((turn, index) => (
              <div
                key={index}
                className={turn.role === "user" ? "flex justify-end" : "flex"}
              >
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 whitespace-pre-wrap break-words ${
                    turn.role === "user" ? "bg-blue-700/60" : "bg-gray-700"
                  }`}
                >
                  {turn.content ||
                    (generating && index === conversation.length - 1 ? (
                      <span className="text-gray-400">Thinking...</span>
                    ) : (
                      ""
                    ))}
                </div>
              </div>
            ))}

            {isError && (
              <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300 whitespace-pre-wrap break-words">
                {response}
              </p>
            )}
          </div>
        ) : response ? (
          <div
            className={`whitespace-pre-wrap break-words ${
              isError ? "text-red-300" : ""
            }`}
          >
            {response}
            {generating && <span className="animate-pulse"> ▍</span>}
          </div>
        ) : (
          <p className="text-gray-500 text-center mt-12">
            {generating ? "Waiting for the model..." : "No response generated yet."}
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
