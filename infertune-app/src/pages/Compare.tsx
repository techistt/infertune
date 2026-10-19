import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { getActiveProfile, useActiveProfile } from "../store/settingsStore";
import { useHistoryStore, newRecordId } from "../store/historyStore";
import { toConfig } from "../types/provider";
import { listModels } from "../services/modelService";
import { generateText } from "../services/llmService";
import { logger, errorMessage } from "../store/logStore";
import { formatDuration, tokensPerSecond } from "../utils/format";
import { withHint } from "../utils/hints";
import ContextSelect from "../components/ContextSelect";
import VramWarning from "../components/VramWarning";

interface Outcome {
  model: string;
  status: "waiting" | "running" | "done" | "error";
  text: string;
  tokens: number;
  timeMs: number;
  speed: number;
  error?: string;
}

const MAX_MODELS = 4;

export default function Compare() {
  const profile = useActiveProfile();

  const online = useAppStore((s) => s.providerOnline);
  const contextLength = useAppStore((s) => s.contextLength);
  const setContextLength = useAppStore((s) => s.setContextLength);

  const [available, setAvailable] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful AI assistant.");
  const [prompt, setPrompt] = useState("");
  const [maxTokens, setMaxTokens] = useState(300);

  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  const cancelRef = useRef(false);

  const loadModels = useCallback(async () => {
    try {
      const list = await listModels(toConfig(profile));
      const names = list.map((m) => m.name);

      setAvailable(names);
      setSelected((current) => current.filter((n) => names.includes(n)));
    } catch {
      setAvailable([]);
      setSelected([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, profile.kind, profile.baseUrl, profile.apiKey, online]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const toggle = (name: string) =>
    setSelected((current) => {
      if (current.includes(name)) return current.filter((n) => n !== name);
      if (current.length >= MAX_MODELS) return current;
      return [...current, name];
    });

  const update = (model: string, patch: Partial<Outcome>) =>
    setOutcomes((all) =>
      all.map((o) => (o.model === model ? { ...o, ...patch } : o))
    );

  const run = async () => {
    if (running || selected.length < 2 || !prompt.trim()) return;

    const active = getActiveProfile();
    const provider = toConfig(active);
    const state = useAppStore.getState();

    cancelRef.current = false;
    setRunning(true);
    setOutcomes(
      selected.map((model) => ({
        model,
        status: "waiting",
        text: "",
        tokens: 0,
        timeMs: 0,
        speed: 0,
      }))
    );

    logger.info("compare", `Comparing ${selected.join(", ")}`);

    // One at a time: models share the same GPU memory.
    for (const model of selected) {
      if (cancelRef.current) break;

      update(model, { status: "running" });

      try {
        const result = await generateText(
          {
            model,
            systemPrompt,
            userPrompt: prompt,
            temperature: state.temperature,
            topP: state.topP,
            topK: state.topK,
            maxTokens,
            seed: state.seed,
            contextLength: state.contextLength,
          },
          provider
        );

        const speed = tokensPerSecond(result.tokens, result.generationTime);

        update(model, {
          status: "done",
          text: result.text,
          tokens: result.tokens,
          timeMs: result.generationTime,
          speed,
        });

        useHistoryStore.getState().addSession({
          id: newRecordId(),
          createdAt: Date.now(),
          providerName: active.name,
          model,
          systemPrompt,
          userPrompt: prompt,
          response: result.text,
          temperature: state.temperature,
          topP: state.topP,
          topK: state.topK,
          maxTokens,
          seed: state.seed,
          contextLength: state.contextLength,
          tokens: result.tokens,
          generationTime: result.generationTime,
          tokensPerSecond: speed,
        });
      } catch (e) {
        const message = errorMessage(e);

        update(model, { status: "error", error: withHint(message) });
        logger.error("compare", `${model}: ${message}`);
      }
    }

    setRunning(false);
  };

  const fastest = outcomes
    .filter((o) => o.status === "done")
    .reduce((max, o) => Math.max(max, o.speed), 0);

  return (
    <div className="space-y-5">

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-xl font-semibold">Compare models</h2>
        <p className="text-sm text-gray-400 mt-1">
          Send the same prompt to 2–{MAX_MODELS} models and read the answers
          side by side. Models run one after another, using your Playground
          temperature, top-p, top-k and seed.
        </p>

        <div className="mt-4">
          <VramWarning model={selected[0] ?? ""} context={contextLength} />
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div>
            <p className="mb-2 text-sm font-medium">
              Models ({selected.length}/{MAX_MODELS})
            </p>

            {available.length > 0 ? (
              <div className="max-h-56 overflow-y-auto rounded-lg bg-gray-800 p-2 space-y-1">
                {available.map((name) => {
                  const checked = selected.includes(name);

                  return (
                    <label
                      key={name}
                      className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={running || (!checked && selected.length >= MAX_MODELS)}
                        onChange={() => toggle(name)}
                      />
                      <span className="break-all text-sm">{name}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg bg-gray-800 p-4 text-sm text-gray-400">
                {online
                  ? "No models found on this server."
                  : `${profile.name} is offline.`}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium">System prompt</label>
              <input
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                disabled={running}
                className="w-full rounded-lg bg-gray-800 p-2 outline-none"
              />
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium">Prompt</label>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={running}
                placeholder="Ask something to compare how each model answers..."
                className="w-full rounded-lg bg-gray-800 p-2 resize-none outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-sm font-medium">Max tokens</label>
                <input
                  type="number"
                  min={16}
                  value={maxTokens}
                  onChange={(e) =>
                    setMaxTokens(Math.max(16, Number(e.target.value) || 16))
                  }
                  disabled={running}
                  className="w-full rounded-lg bg-gray-800 p-2"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Context</label>
                <ContextSelect
                  value={contextLength}
                  onChange={setContextLength}
                  className="w-full rounded-lg bg-gray-800 p-2"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          {running ? (
            <button
              onClick={() => {
                cancelRef.current = true;
              }}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 hover:bg-red-700"
            >
              <Square size={16} /> Stop after current model
            </button>
          ) : (
            <button
              onClick={run}
              disabled={selected.length < 2 || !prompt.trim() || !online}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={16} /> Compare
            </button>
          )}
        </div>
      </div>

      {outcomes.length > 0 && (
        <div
          className={`grid grid-cols-1 gap-5 ${
            outcomes.length >= 3 ? "xl:grid-cols-3" : "lg:grid-cols-2"
          }`}
        >
          {outcomes.map((o) => (
            <div
              key={o.model}
              className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold break-all">{o.model}</h3>

                {o.status === "done" && o.speed === fastest && outcomes.length > 1 && (
                  <span className="rounded bg-green-900/60 px-2 py-0.5 text-xs text-green-300 whitespace-nowrap">
                    Fastest
                  </span>
                )}
              </div>

              {o.status === "done" && (
                <p className="mt-1 text-sm text-gray-400">
                  {o.speed.toFixed(1)} tok/s · {o.tokens} tokens ·{" "}
                  {formatDuration(o.timeMs)}
                </p>
              )}

              <div className="mt-3 flex-1 rounded-lg bg-gray-800 p-3 text-sm whitespace-pre-wrap break-words min-h-[8rem] max-h-96 overflow-y-auto">
                {o.status === "waiting" && (
                  <span className="text-gray-500">Waiting...</span>
                )}
                {o.status === "running" && (
                  <span className="text-gray-400">Generating...</span>
                )}
                {o.status === "error" && (
                  <span className="text-red-300">{o.error}</span>
                )}
                {o.status === "done" && (o.text || "(empty response)")}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
