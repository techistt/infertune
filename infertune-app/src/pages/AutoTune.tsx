import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Check } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { getActiveProfile, useActiveProfile } from "../store/settingsStore";
import { toConfig } from "../types/provider";
import {
  getModelDetails,
  getModelContextLimit,
  listModels,
} from "../services/modelService";
import { generateText } from "../services/llmService";
import { startSampler, type SamplerResult } from "../services/sampler";
import { logger, errorMessage } from "../store/logStore";
import { tokensPerSecond } from "../utils/format";
import { withHint } from "../utils/hints";
import { notifyDone } from "../services/notify";
import {
  planConfigs,
  summarize,
  type TuneConfig,
  type TuneResult,
} from "../utils/autotune";

const PROMPT =
  "Explain in a short paragraph how a computer's memory differs from its storage.";

export default function AutoTune() {
  const profile = useActiveProfile();
  const online = useAppStore((s) => s.providerOnline);
  const activeModel = useAppStore((s) => s.model);
  const setActiveModel = useAppStore((s) => s.setModel);
  const setContextLength = useAppStore((s) => s.setContextLength);
  const setNumGpu = useAppStore((s) => s.setNumGpu);
  const setPage = useAppStore((s) => s.setPage);

  const [available, setAvailable] = useState<string[]>([]);
  const [model, setModel] = useState(activeModel);
  const [results, setResults] = useState<TuneResult[]>([]);
  const [plan, setPlan] = useState<TuneConfig[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const cancelRef = useRef(false);
  const isOllama = profile.kind === "ollama";

  const loadModels = useCallback(async () => {
    try {
      const names = (await listModels(toConfig(profile))).map((m) => m.name);

      setAvailable(names);
      setModel((current) => (names.includes(current) ? current : names[0] ?? ""));
    } catch {
      setAvailable([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, profile.kind, profile.baseUrl, profile.apiKey, online]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const start = async () => {
    if (running || !model) return;

    const active = getActiveProfile();
    const provider = toConfig(active);
    const gpuId = useAppStore.getState().selectedGpu;

    cancelRef.current = false;
    setRunning(true);
    setError(null);
    setResults([]);
    setApplied(null);
    setStatus("Reading model details...");

    const [limit, details] = await Promise.all([
      getModelContextLimit(model, provider),
      getModelDetails(model, provider),
    ]);

    const configs = planConfigs({
      contextLimit: limit,
      layers: details?.layers ?? null,
      supportsLayers: active.kind === "ollama",
      baseContext: 4096,
    });

    setPlan(configs);
    logger.info("autotune", `Started on ${model}: ${configs.length} setting(s)`);

    const collected: TuneResult[] = [];

    for (const config of configs) {
      if (cancelRef.current) break;

      const base = {
        model,
        systemPrompt: "You are a helpful AI assistant.",
        userPrompt: PROMPT,
        temperature: 0,
        topP: 1,
        topK: 40,
        seed: 42,
        contextLength: config.contextLength,
        numGpu: config.numGpu,
      };

      setStatus(`${config.label}: loading...`);

      let result: TuneResult;

      try {
        // Warm-up so model loading time is not counted.
        await generateText({ ...base, maxTokens: 8 }, provider);

        setStatus(`${config.label}: measuring...`);

        const sampler = startSampler(gpuId);
        const speeds: number[] = [];
        let peak: SamplerResult;

        try {
          for (let i = 0; i < 2; i++) {
            if (cancelRef.current) break;

            const r = await generateText({ ...base, maxTokens: 100 }, provider);

            speeds.push(tokensPerSecond(r.tokens, r.generationTime));
          }
        } finally {
          peak = sampler.stop();
        }

        result = {
          config,
          ok: speeds.length > 0,
          tokensPerSecond:
            speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
          peakVramGb: peak.vramGb,
          peakRamGb: peak.ramGb,
          peakTempC: peak.tempC,
          avgPowerW: peak.avgPowerW,
        };
      } catch (e) {
        const message = errorMessage(e);

        setError(withHint(`${config.label}: ${message}`));
        logger.error("autotune", `${config.label}: ${message}`);

        result = {
          config,
          ok: false,
          error: message,
          tokensPerSecond: 0,
          peakVramGb: 0,
          peakRamGb: 0,
          peakTempC: 0,
          avgPowerW: 0,
        };
      }

      collected.push(result);
      setResults([...collected]);
    }

    setStatus(cancelRef.current ? "Stopped" : "Finished");
    setRunning(false);

    if (!cancelRef.current) {
      const best = summarize(collected).fastest;

      notifyDone(
        "Auto-tune finished",
        best
          ? `${model}: best is ${best.config.label} (${best.tokensPerSecond.toFixed(1)} tok/s)`
          : `${model}: no setting worked`
      );
    }
  };

  const summary = summarize(results);

  const apply = (r: TuneResult) => {
    setActiveModel(model);
    setContextLength(r.config.contextLength);
    setNumGpu(r.config.numGpu);
    setApplied(r.config.id);
    logger.info("autotune", `Applied: ${r.config.label}`);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-xl font-semibold">Auto-tune</h2>
        <p className="mt-1 text-sm text-gray-400">
          Tries several context sizes
          {isOllama ? " and GPU layer splits" : ""} on one model, measures the
          speed of each and shows the best. Settings that fail (for example,
          out of memory) are marked instead of stopping the sweep.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label className="mb-1 block text-xs text-gray-400">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={running}
              className="w-full rounded-lg bg-gray-800 p-2"
            >
              {available.length === 0 && <option value="">No models</option>}
              {available.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {running ? (
            <button
              onClick={() => (cancelRef.current = true)}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 hover:bg-red-700"
            >
              <Square size={16} /> Stop
            </button>
          ) : (
            <button
              onClick={start}
              disabled={!model}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <Play size={16} /> Start sweep
            </button>
          )}
        </div>

        {status && <p className="mt-3 text-sm text-gray-300">{status}</p>}

        {error && (
          <p className="mt-3 rounded-lg bg-red-950 p-3 text-sm text-red-300 break-words">
            {error}
          </p>
        )}
      </div>

      {plan.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-3 text-xl font-semibold">Results</h2>

          {(summary.fastest || summary.balanced) && (
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              {summary.fastest && (
                <div className="rounded-lg border border-green-800 bg-green-950/40 p-3 text-sm">
                  <div className="text-xs text-green-400">Fastest</div>
                  <div className="font-medium">{summary.fastest.config.label}</div>
                  <div className="text-gray-300">
                    {summary.fastest.tokensPerSecond.toFixed(1)} tok/s
                  </div>
                  <button
                    onClick={() => apply(summary.fastest!)}
                    className="mt-2 rounded bg-green-700 px-3 py-1 hover:bg-green-600"
                  >
                    Use these settings
                  </button>
                </div>
              )}

              {summary.balanced && summary.balanced !== summary.fastest && (
                <div className="rounded-lg border border-blue-800 bg-blue-950/40 p-3 text-sm">
                  <div className="text-xs text-blue-400">
                    Balanced (largest context within 85% of top speed)
                  </div>
                  <div className="font-medium">{summary.balanced.config.label}</div>
                  <div className="text-gray-300">
                    {summary.balanced.tokensPerSecond.toFixed(1)} tok/s
                  </div>
                  <button
                    onClick={() => apply(summary.balanced!)}
                    className="mt-2 rounded bg-blue-700 px-3 py-1 hover:bg-blue-600"
                  >
                    Use these settings
                  </button>
                </div>
              )}
            </div>
          )}

          {applied && (
            <p className="mb-3 flex items-center gap-2 text-sm text-green-400">
              <Check size={16} /> Applied. The Playground now uses these settings.{" "}
              <button
                onClick={() => setPage("playground")}
                className="underline hover:text-green-300"
              >
                Open Playground
              </button>
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="py-2 pr-4 font-medium">Setting</th>
                  <th className="py-2 pr-4 font-medium">Speed</th>
                  <th className="py-2 pr-4 font-medium">Peak VRAM</th>
                  <th className="py-2 pr-4 font-medium">Peak RAM</th>
                  <th className="py-2 font-medium">GPU temp / power</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((config) => {
                  const r = results.find((x) => x.config.id === config.id);

                  return (
                    <tr key={config.id} className="border-b border-gray-800/60">
                      <td className="py-2 pr-4">{config.label}</td>
                      {!r ? (
                        <td colSpan={4} className="py-2 text-gray-500">
                          {running ? "waiting..." : "not run"}
                        </td>
                      ) : !r.ok ? (
                        <td colSpan={4} className="py-2 text-red-400">
                          Failed{r.error ? `: ${r.error.slice(0, 120)}` : ""}
                        </td>
                      ) : (
                        <>
                          <td className="py-2 pr-4 font-medium">
                            {r.tokensPerSecond.toFixed(1)} tok/s
                          </td>
                          <td className="py-2 pr-4">{r.peakVramGb.toFixed(1)} GB</td>
                          <td className="py-2 pr-4">{r.peakRamGb.toFixed(1)} GB</td>
                          <td className="py-2">
                            {r.peakTempC > 0 ? `${r.peakTempC.toFixed(0)} °C` : "-"}
                            {r.avgPowerW > 0 ? ` · ${r.avgPowerW.toFixed(0)} W` : ""}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Each setting is measured with two short generations after a warm-up.
            Bigger contexts use more memory even when speed looks the same.
          </p>
        </div>
      )}
    </div>
  );
}
