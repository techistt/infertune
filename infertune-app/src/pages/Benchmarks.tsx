import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Play, Square, Trash2 } from "lucide-react";
import {
  useAppStore,
  type GpuStats,
  type HardwareStats,
} from "../store/useAppStore";
import { getActiveProfile, useActiveProfile } from "../store/settingsStore";
import {
  useHistoryStore,
  newRecordId,
  type BenchmarkResult,
  type BenchmarkRun,
} from "../store/historyStore";
import { toConfig } from "../types/provider";
import { listModels } from "../services/modelService";
import { generateText } from "../services/llmService";
import { logger, errorMessage } from "../store/logStore";
import {
  bytesToGb,
  formatDateTime,
  formatDuration,
  tokensPerSecond,
} from "../utils/format";
import ContextSelect from "../components/ContextSelect";
import Bar from "../components/Bar";
import VramWarning from "../components/VramWarning";
import SpeedChart from "../components/SpeedChart";
import { buildCsv, buildMarkdown } from "../utils/export";
import { withHint } from "../utils/hints";

const PROMPTS = [
  {
    id: "qa",
    name: "Short Q&A",
    text: "Explain in three sentences why the sky is blue.",
  },
  {
    id: "code",
    name: "Code generation",
    text: "Write a Python function that checks whether a string is a palindrome, with a short docstring and two usage examples.",
  },
  {
    id: "reasoning",
    name: "Reasoning",
    text: "A train leaves a station at 3pm travelling at 60 km/h. A second train leaves the same station at 4pm travelling at 90 km/h on the same track. At what time does the second train catch up? Show your steps.",
  },
  {
    id: "summary",
    name: "Summarisation",
    text: "Summarise the following in two sentences: Running language models locally keeps your data on your own computer, removes per-request costs and works offline. The trade-off is that the model must fit in your graphics card or system memory, and larger models run slower on modest hardware. Tools that estimate memory needs and measure speed help you pick a model that is practical for your machine.",
  },
  { id: "custom", name: "Custom prompt", text: "" },
];

/** Samples CPU / RAM / GPU / VRAM while a model generates and keeps the peaks. */
function startSampler(gpuId: number) {
  const peak = { cpu: 0, ramGb: 0, gpu: 0, vramGb: 0 };
  let busy = false;

  const sample = async () => {
    if (busy) return;
    busy = true;

    try {
      const system = await invoke<HardwareStats>("get_system_stats");
      const gpu = await invoke<GpuStats>("get_gpu_stats", { id: gpuId });

      peak.cpu = Math.max(peak.cpu, system.cpu_usage);
      peak.ramGb = Math.max(peak.ramGb, bytesToGb(system.ram_used));
      peak.gpu = Math.max(peak.gpu, gpu.usage);
      peak.vramGb = Math.max(peak.vramGb, bytesToGb(gpu.memory_used));
    } catch {
      // A missed sample is fine.
    } finally {
      busy = false;
    }
  };

  sample();
  const timer = setInterval(sample, 700);

  return {
    stop: () => {
      clearInterval(timer);
      return peak;
    },
  };
}

function average(values: number[]): number {
  return values.length > 0
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0;
}

export default function Benchmarks() {
  const profile = useActiveProfile();

  const contextLength = useAppStore((s) => s.contextLength);
  const setContextLength = useAppStore((s) => s.setContextLength);
  const online = useAppStore((s) => s.providerOnline);

  const results = useHistoryStore((s) => s.benchmarks);
  const deleteBenchmark = useHistoryStore((s) => s.deleteBenchmark);
  const clearBenchmarks = useHistoryStore((s) => s.clearBenchmarks);

  const [available, setAvailable] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [promptId, setPromptId] = useState("qa");
  const [customPrompt, setCustomPrompt] = useState("");
  const [runs, setRuns] = useState(3);
  const [maxTokens, setMaxTokens] = useState(200);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [step, setStep] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState<"" | "csv" | "md">("");

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
    setSelected((current) =>
      current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name]
    );

  const preset = PROMPTS.find((p) => p.id === promptId) ?? PROMPTS[0];
  const promptText = promptId === "custom" ? customPrompt : preset.text;

  const runBenchmark = async () => {
    if (running || selected.length === 0 || !promptText.trim()) return;

    const active = getActiveProfile();
    const provider = toConfig(active);
    const gpuId = useAppStore.getState().selectedGpu;
    const context = useAppStore.getState().contextLength;

    cancelRef.current = false;
    setRunning(true);
    setError(null);
    setStep({ done: 0, total: selected.length * (runs + 1) });

    logger.info(
      "benchmark",
      `Started: ${selected.length} model(s), ${runs} run(s) each, prompt "${preset.name}"`
    );

    const base = {
      systemPrompt: "You are a helpful AI assistant.",
      userPrompt: promptText,
      // Temperature 0 and a fixed seed keep runs comparable.
      temperature: 0,
      topP: 1,
      topK: 40,
      seed: 42,
      contextLength: context,
    };

    let done = 0;

    for (const model of selected) {
      if (cancelRef.current) break;

      // Warm-up loads the model so the first measured run is not slower.
      setStatus(`${model}: loading model...`);

      try {
        await generateText({ ...base, model, maxTokens: 8 }, provider);
      } catch (e) {
        const message = `${model}: ${errorMessage(e)}`;
        setError(withHint(message));
        logger.error("benchmark", message);
        done += runs + 1;
        setStep((s) => ({ ...s, done }));
        continue;
      }

      done += 1;
      setStep((s) => ({ ...s, done }));

      const sampler = startSampler(gpuId);
      const measured: BenchmarkRun[] = [];

      for (let i = 1; i <= runs; i++) {
        if (cancelRef.current) break;

        setStatus(`${model}: run ${i} of ${runs}`);

        try {
          const result = await generateText(
            { ...base, model, maxTokens },
            provider
          );

          measured.push({
            tokens: result.tokens,
            timeMs: result.generationTime,
            tokensPerSecond: tokensPerSecond(result.tokens, result.generationTime),
          });
        } catch (e) {
          const message = `${model}: ${errorMessage(e)}`;
          setError(withHint(message));
          logger.error("benchmark", message);
          break;
        }

        done += 1;
        setStep((s) => ({ ...s, done }));
      }

      const peak = sampler.stop();

      // Account for runs that were skipped by an error or cancel.
      done = Math.max(done, 0);

      if (measured.length > 0) {
        const entry: BenchmarkResult = {
          id: newRecordId(),
          createdAt: Date.now(),
          providerName: active.name,
          model,
          promptName: preset.name,
          contextLength: context,
          maxTokens,
          runs: measured,
          avgTokensPerSecond: average(measured.map((r) => r.tokensPerSecond)),
          avgTimeMs: average(measured.map((r) => r.timeMs)),
          avgTokens: average(measured.map((r) => r.tokens)),
          peakCpu: peak.cpu,
          peakRamGb: peak.ramGb,
          peakGpu: peak.gpu,
          peakVramGb: peak.vramGb,
        };

        useHistoryStore.getState().addBenchmark(entry);

        logger.info(
          "benchmark",
          `${model}: ${entry.avgTokensPerSecond.toFixed(1)} tok/s average over ${measured.length} run(s)`
        );
      }
    }

    setStatus(cancelRef.current ? "Stopped" : "Finished");
    setRunning(false);
    logger.info("benchmark", cancelRef.current ? "Stopped by user" : "Finished");
  };

  const copyAs = async (kind: "csv" | "md") => {
    try {
      await navigator.clipboard.writeText(
        kind === "csv" ? buildCsv(results) : buildMarkdown(results)
      );
      setCopied(kind);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      // Clipboard unavailable.
    }
  };

  const best = results.reduce(
    (max, r) => Math.max(max, r.avgTokensPerSecond),
    0
  );

  const percent =
    step.total > 0 ? (step.done / step.total) * 100 : 0;

  return (
    <div className="space-y-5">

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-xl font-semibold">Run a benchmark</h2>
        <p className="text-sm text-gray-400 mt-1">
          Measures generation speed and the peak CPU, RAM, GPU and VRAM use of
          each selected model on {profile.name}. Each model is loaded first,
          then timed over several runs with fixed settings.
        </p>

        <div className="mt-4">
          <VramWarning model={selected[0] ?? ""} context={contextLength} />
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div>
            <p className="mb-2 text-sm font-medium">Models</p>

            {available.length > 0 ? (
              <div className="max-h-56 overflow-y-auto rounded-lg bg-gray-800 p-2 space-y-1">
                {available.map((name) => (
                  <label
                    key={name}
                    className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(name)}
                      onChange={() => toggle(name)}
                      disabled={running}
                    />
                    <span className="break-all text-sm">{name}</span>
                  </label>
                ))}
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
              <label className="block mb-1 text-sm font-medium">Prompt</label>
              <select
                value={promptId}
                onChange={(e) => setPromptId(e.target.value)}
                disabled={running}
                className="w-full rounded-lg bg-gray-800 p-2"
              >
                {PROMPTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {promptId === "custom" ? (
                <textarea
                  rows={3}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  disabled={running}
                  placeholder="Type the prompt to benchmark..."
                  className="mt-2 w-full rounded-lg bg-gray-800 p-2 resize-none outline-none"
                />
              ) : (
                <p className="mt-2 text-xs text-gray-500">{preset.text}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block mb-1 text-sm font-medium">Runs</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={runs}
                  onChange={(e) =>
                    setRuns(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                  }
                  disabled={running}
                  className="w-full rounded-lg bg-gray-800 p-2"
                />
              </div>

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

        <div className="mt-5 flex items-center gap-3">
          {running ? (
            <button
              onClick={() => {
                cancelRef.current = true;
                setStatus("Stopping after the current run...");
              }}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 hover:bg-red-700"
            >
              <Square size={16} /> Stop
            </button>
          ) : (
            <button
              onClick={runBenchmark}
              disabled={selected.length === 0 || !promptText.trim() || !online}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={16} /> Run benchmark
            </button>
          )}

          <span className="text-sm text-gray-400">{status}</span>
        </div>

        {(running || step.done > 0) && (
          <div className="mt-3">
            <Bar percent={percent} />
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-300 break-words">
            {error}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Results</h2>

          {results.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyAs("md")}
                className="rounded-lg bg-gray-700 px-3 py-2 hover:bg-gray-600"
              >
                {copied === "md" ? "Copied" : "Copy as Markdown"}
              </button>

              <button
                onClick={() => copyAs("csv")}
                className="rounded-lg bg-gray-700 px-3 py-2 hover:bg-gray-600"
              >
                {copied === "csv" ? "Copied" : "Copy as CSV"}
              </button>

              {confirmClear ? (
                <>
                  <button
                    onClick={() => {
                      clearBenchmarks();
                      setConfirmClear(false);
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
          )}
        </div>

        {results.length > 0 && (
          <div className="mt-5">
            <SpeedChart results={results} />
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          {results.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 font-medium">Speed</th>
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Tokens</th>
                  <th className="py-2 pr-4 font-medium">Peak CPU</th>
                  <th className="py-2 pr-4 font-medium">Peak RAM</th>
                  <th className="py-2 pr-4 font-medium">Peak GPU</th>
                  <th className="py-2 pr-4 font-medium">Peak VRAM</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>

              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-b border-gray-800/60 align-top">
                    <td className="py-3 pr-4">
                      <div className="font-medium break-all">{r.model}</div>
                      <div className="text-xs text-gray-500">
                        {r.providerName} · {r.promptName} · {r.contextLength.toLocaleString()} ctx ·{" "}
                        {r.runs.length} run{r.runs.length === 1 ? "" : "s"}
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatDateTime(r.createdAt)}
                      </div>
                    </td>

                    <td
                      className={`py-3 pr-4 whitespace-nowrap font-medium ${
                        r.avgTokensPerSecond === best && results.length > 1
                          ? "text-green-400"
                          : ""
                      }`}
                    >
                      {r.avgTokensPerSecond.toFixed(1)} tok/s
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatDuration(r.avgTimeMs)}
                    </td>
                    <td className="py-3 pr-4">{Math.round(r.avgTokens)}</td>
                    <td className="py-3 pr-4">{r.peakCpu.toFixed(0)}%</td>
                    <td className="py-3 pr-4">{r.peakRamGb.toFixed(1)} GB</td>
                    <td className="py-3 pr-4">{r.peakGpu.toFixed(0)}%</td>
                    <td className="py-3 pr-4">{r.peakVramGb.toFixed(1)} GB</td>

                    <td className="py-3">
                      <button
                        onClick={() => deleteBenchmark(r.id)}
                        title="Delete result"
                        className="rounded-lg bg-gray-800 p-2 text-gray-400 hover:text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-gray-500">
              No benchmarks yet. Pick one or more models above and run one.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
