import { useMemo } from "react";
import type { SessionRecord } from "../store/historyStore";
import { diffWords, similarity, type DiffPart } from "../utils/diff";
import { formatDateTime, formatDuration } from "../utils/format";

interface SessionCompareProps {
  a: SessionRecord;
  b: SessionRecord;
}

interface Row {
  label: string;
  a: string;
  b: string;
}

function rows(a: SessionRecord, b: SessionRecord): Row[] {
  return [
    { label: "Model", a: a.model, b: b.model },
    { label: "Server", a: a.providerName, b: b.providerName },
    { label: "Speed", a: `${a.tokensPerSecond.toFixed(1)} tok/s`, b: `${b.tokensPerSecond.toFixed(1)} tok/s` },
    { label: "Tokens", a: String(a.tokens), b: String(b.tokens) },
    { label: "Time", a: formatDuration(a.generationTime), b: formatDuration(b.generationTime) },
    { label: "Context", a: a.contextLength.toLocaleString(), b: b.contextLength.toLocaleString() },
    { label: "Temperature", a: String(a.temperature), b: String(b.temperature) },
    { label: "Top P", a: String(a.topP), b: String(b.topP) },
    { label: "Top K", a: String(a.topK), b: String(b.topK) },
    { label: "Max tokens", a: String(a.maxTokens), b: String(b.maxTokens) },
    { label: "Seed", a: String(a.seed), b: String(b.seed) },
  ];
}

function Highlighted({ parts, show }: { parts: DiffPart[]; show: "del" | "add" }) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === "same") return <span key={index}>{part.text}</span>;
        if (part.kind !== show) return null;

        return (
          <mark
            key={index}
            className={
              show === "del"
                ? "rounded bg-red-900/60 text-red-100"
                : "rounded bg-green-900/60 text-green-100"
            }
          >
            {part.text}
          </mark>
        );
      })}
    </>
  );
}

export default function SessionCompare({ a, b }: SessionCompareProps) {
  const parts = useMemo(() => diffWords(a.response, b.response), [a, b]);
  const same = a.userPrompt === b.userPrompt && a.systemPrompt === b.systemPrompt;

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="py-2 pr-4 font-medium w-32"></th>
              <th className="py-2 pr-4 font-medium">
                A <span className="text-gray-600">· {formatDateTime(a.createdAt)}</span>
              </th>
              <th className="py-2 font-medium">
                B <span className="text-gray-600">· {formatDateTime(b.createdAt)}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows(a, b).map((row) => {
              const differs = row.a !== row.b;

              return (
                <tr key={row.label} className="border-b border-gray-800/60">
                  <td className="py-2 pr-4 text-gray-400">{row.label}</td>
                  <td className={`py-2 pr-4 break-all ${differs ? "text-yellow-300" : ""}`}>{row.a}</td>
                  <td className={`py-2 break-all ${differs ? "text-yellow-300" : ""}`}>{row.b}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-gray-500">Yellow rows differ between the two sessions.</p>
      </div>

      {same ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-300">Prompt (same in both)</h3>
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-gray-800 p-3 text-sm font-sans">
            {a.userPrompt}
          </pre>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div>
            <h3 className="mb-2 text-sm font-medium text-yellow-300">Prompt A (differs)</h3>
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-gray-800 p-3 text-sm font-sans">
              {a.userPrompt}
            </pre>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-yellow-300">Prompt B (differs)</h3>
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-gray-800 p-3 text-sm font-sans">
              {b.userPrompt}
            </pre>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-gray-300">Responses</h3>
          {parts && (
            <span className="text-xs text-gray-400">
              {Math.round(similarity(parts) * 100)}% of the words match
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-gray-800 p-3 text-sm font-sans">
            {parts ? <Highlighted parts={parts} show="del" /> : a.response || "(empty)"}
          </pre>
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-gray-800 p-3 text-sm font-sans">
            {parts ? <Highlighted parts={parts} show="add" /> : b.response || "(empty)"}
          </pre>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          {parts
            ? "Red words appear only in A, green words only in B."
            : "These responses are too long to highlight the differences."}
        </p>
      </div>
    </div>
  );
}
