import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useHistoryStore } from "../store/historyStore";
import { useAppStore } from "../store/useAppStore";
import { formatDateTime, formatDuration } from "../utils/format";
import SessionCompare from "../components/SessionCompare";

export default function Sessions() {
  const sessions = useHistoryStore((s) => s.sessions);
  const deleteSession = useHistoryStore((s) => s.deleteSession);
  const clearSessions = useHistoryStore((s) => s.clearSessions);
  const loadSession = useAppStore((s) => s.loadSession);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return sessions;

    return sessions.filter(
      (s) =>
        s.model.toLowerCase().includes(q) ||
        s.userPrompt.toLowerCase().includes(q) ||
        s.response.toLowerCase().includes(q)
    );
  }, [sessions, query]);

  const selected =
    sessions.find((s) => s.id === selectedId) ?? filtered[0] ?? null;

  const pickedSessions = picked
    .map((id) => sessions.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const clickSession = (id: string) => {
    if (!compareMode) {
      setSelectedId(id);
      return;
    }

    // Keep the two most recent picks.
    setPicked((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id].slice(-2)
    );
  };

  const copyJson = async () => {
    if (!selected) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(selected, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable.
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center text-gray-400">
        No sessions yet. Every generation you run in the Playground is saved
        here.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-5">

      <div className="col-span-12 lg:col-span-4 rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-col lg:h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-2 mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions..."
            className="flex-1 min-w-0 rounded-lg bg-gray-800 p-2 outline-none"
          />

          <button
            onClick={() => {
              setCompareMode((on) => !on);
              setPicked([]);
            }}
            aria-pressed={compareMode}
            className={`rounded-lg px-3 py-2 whitespace-nowrap ${
              compareMode ? "bg-blue-600" : "bg-gray-800 text-gray-300 hover:text-white"
            }`}
          >
            Compare
          </button>

          {confirmClear ? (
            <>
              <button
                onClick={() => {
                  clearSessions();
                  setConfirmClear(false);
                  setSelectedId(null);
                }}
                className="rounded-lg bg-red-600 px-3 py-2 hover:bg-red-700"
              >
                Delete all
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="rounded-lg bg-gray-700 px-3 py-2 hover:bg-gray-600"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="rounded-lg bg-gray-800 px-3 py-2 text-gray-300 hover:text-red-400"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              Nothing matches your search.
            </p>
          )}

          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => clickSession(s.id)}
              className={`w-full rounded-lg p-3 text-left ${
                (compareMode ? picked.includes(s.id) : selected?.id === s.id)
                  ? "bg-blue-900/40 border border-blue-700"
                  : "bg-gray-800 border border-transparent hover:bg-gray-700"
              }`}
            >
              <div className="flex justify-between gap-2 text-xs text-gray-400">
                <span className="truncate">{s.model}</span>
                <span className="whitespace-nowrap">
                  {formatDateTime(s.createdAt)}
                </span>
              </div>
              <div className="mt-1 text-sm line-clamp-2 break-words">
                {s.userPrompt}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="col-span-12 lg:col-span-8 rounded-xl border border-gray-800 bg-gray-900 p-5 lg:h-[calc(100vh-8rem)] overflow-y-auto">
        {compareMode ? (
          pickedSessions.length === 2 ? (
            <SessionCompare a={pickedSessions[0]} b={pickedSessions[1]} />
          ) : (
            <div className="py-12 text-center text-gray-400">
              <p className="font-medium text-gray-300">Compare two sessions</p>
              <p className="mt-2 text-sm">
                Click two sessions in the list ({pickedSessions.length} of 2
                picked). You will see the settings that differ and the
                differences between the responses.
              </p>
            </div>
          )
        ) : selected ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold break-all">
                  {selected.model}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  {selected.providerName} · {formatDateTime(selected.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadSession(selected)}
                  className="rounded-lg bg-blue-600 px-3 py-2 hover:bg-blue-700"
                >
                  Open in Playground
                </button>
                <button
                  onClick={copyJson}
                  className="rounded-lg bg-gray-700 px-3 py-2 hover:bg-gray-600"
                >
                  {copied ? "Copied" : "Copy JSON"}
                </button>
                <button
                  onClick={() => {
                    deleteSession(selected.id);
                    setSelectedId(null);
                  }}
                  title="Delete session"
                  className="rounded-lg bg-gray-800 p-2 text-gray-400 hover:text-red-400"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Speed" value={`${selected.tokensPerSecond.toFixed(1)} tok/s`} />
              <Stat label="Tokens" value={String(selected.tokens)} />
              <Stat label="Time" value={formatDuration(selected.generationTime)} />
              <Stat label="Context" value={selected.contextLength.toLocaleString()} />
              <Stat label="Temperature" value={String(selected.temperature)} />
              <Stat label="Top P" value={String(selected.topP)} />
              <Stat label="Top K" value={String(selected.topK)} />
              <Stat label="Max tokens" value={String(selected.maxTokens)} />
            </div>

            <Block title="System prompt" text={selected.systemPrompt} />
            <Block title="Prompt" text={selected.userPrompt} />
            <Block title="Response" text={selected.response} />
          </>
        ) : (
          <p className="text-gray-500">Select a session.</p>
        )}
      </div>

    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-800 p-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-sm font-medium text-gray-300">{title}</h3>
      <pre className="whitespace-pre-wrap break-words rounded-lg bg-gray-800 p-3 text-sm font-sans">
        {text || "(empty)"}
      </pre>
    </div>
  );
}
