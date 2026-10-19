import { useMemo, useState } from "react";
import { useLogStore, type LogLevel } from "../store/logStore";
import { formatTime } from "../utils/format";

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: "text-blue-300",
  warn: "text-yellow-300",
  error: "text-red-400",
};

const FILTERS: Array<LogLevel | "all"> = ["all", "info", "warn", "error"];

export default function Logs() {
  const entries = useLogStore((s) => s.entries);
  const clear = useLogStore((s) => s.clear);

  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return entries
      .filter((e) => level === "all" || e.level === level)
      .filter(
        (e) =>
          !q ||
          e.message.toLowerCase().includes(q) ||
          e.source.toLowerCase().includes(q)
      )
      .slice()
      .reverse();
  }, [entries, level, query]);

  const copy = async () => {
    const text = visible
      .slice()
      .reverse()
      .map(
        (e) =>
          `${new Date(e.time).toISOString()} [${e.level.toUpperCase()}] ${e.source}: ${e.message}`
      )
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable.
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col lg:h-[calc(100vh-8rem)]">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold mr-2">Logs</h2>

        <div className="flex rounded-lg bg-gray-800 p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setLevel(f)}
              className={`rounded-md px-3 py-1 text-sm capitalize ${
                level === f ? "bg-blue-600" : "text-gray-300 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="flex-1 min-w-[10rem] rounded-lg bg-gray-800 p-2 outline-none"
        />

        <button
          onClick={copy}
          disabled={visible.length === 0}
          className="rounded-lg bg-gray-700 px-3 py-2 hover:bg-gray-600 disabled:opacity-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>

        <button
          onClick={clear}
          disabled={entries.length === 0}
          className="rounded-lg bg-gray-800 px-3 py-2 text-gray-300 hover:text-red-400 disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg bg-gray-950 p-3 font-mono text-sm">
        {visible.length === 0 ? (
          <p className="py-6 text-center text-gray-500 font-sans">
            {entries.length === 0
              ? "No log entries yet."
              : "No entries match the filter."}
          </p>
        ) : (
          visible.map((e) => (
            <div key={e.id} className="flex gap-3 py-0.5">
              <span className="text-gray-500 whitespace-nowrap">
                {formatTime(e.time)}
              </span>
              <span
                className={`w-12 uppercase whitespace-nowrap ${LEVEL_CLASS[e.level]}`}
              >
                {e.level}
              </span>
              <span className="text-gray-400 whitespace-nowrap">{e.source}</span>
              <span className="break-words min-w-0">{e.message}</span>
            </div>
          ))
        )}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Logs are kept in memory for this session only (last 500 entries).
      </p>
    </div>
  );
}
