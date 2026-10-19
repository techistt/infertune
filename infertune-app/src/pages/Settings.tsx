import { useState } from "react";
import { Plus, ScanSearch } from "lucide-react";
import pkg from "../../package.json";
import { useSettingsStore } from "../store/settingsStore";
import { useHistoryStore } from "../store/historyStore";
import {
  PROVIDER_PRESETS,
  toConfig,
  type ProviderProfile,
} from "../types/provider";
import { checkProvider } from "../services/modelService";
import { logger } from "../store/logStore";
import DesktopPanel from "../components/DesktopPanel";

type TestState = "idle" | "testing" | "ok" | "fail";

const INTERVALS = [
  { ms: 1000, label: "1 second" },
  { ms: 2000, label: "2 seconds" },
  { ms: 5000, label: "5 seconds" },
];

export default function Settings() {
  const providers = useSettingsStore((s) => s.providers);
  const activeId = useSettingsStore((s) => s.activeProviderId);
  const pollIntervalMs = useSettingsStore((s) => s.pollIntervalMs);
  const addProvider = useSettingsStore((s) => s.addProvider);
  const updateProvider = useSettingsStore((s) => s.updateProvider);
  const removeProvider = useSettingsStore((s) => s.removeProvider);
  const setActiveProvider = useSettingsStore((s) => s.setActiveProvider);
  const setPollInterval = useSettingsStore((s) => s.setPollInterval);
  const resetSettings = useSettingsStore((s) => s.resetSettings);

  const sessionCount = useHistoryStore((s) => s.sessions.length);
  const benchmarkCount = useHistoryStore((s) => s.benchmarks.length);
  const clearSessions = useHistoryStore((s) => s.clearSessions);
  const clearBenchmarks = useHistoryStore((s) => s.clearBenchmarks);

  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [presetId, setPresetId] = useState(PROVIDER_PRESETS[1].id);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  const preset =
    PROVIDER_PRESETS.find((p) => p.id === presetId) ?? PROVIDER_PRESETS[0];

  const test = async (profile: ProviderProfile) => {
    setTests((t) => ({ ...t, [profile.id]: "testing" }));

    const ok = await checkProvider(toConfig(profile));

    setTests((t) => ({ ...t, [profile.id]: ok ? "ok" : "fail" }));
  };

  const addFromPreset = () => {
    const id = addProvider({
      name: preset.name,
      preset: preset.id,
      kind: preset.kind,
      baseUrl: preset.baseUrl,
      apiKey: "",
    });

    logger.info("settings", `Added server ${preset.name}`);
    setActiveProvider(id);
  };

  const scan = async () => {
    setScanning(true);
    setScanMessage("");

    const known = new Set(
      useSettingsStore
        .getState()
        .providers.map((p) => p.baseUrl.replace(/\/+$/, "").toLowerCase())
    );

    const checks = await Promise.all(
      PROVIDER_PRESETS.filter((p) => p.id !== "custom").map(async (p) => {
        const online = await checkProvider({
          kind: p.kind,
          baseUrl: p.baseUrl,
          apiKey: "",
        });

        return { p, online };
      })
    );

    let added = 0;
    const found: string[] = [];

    for (const { p, online } of checks) {
      if (!online) continue;

      found.push(p.name);

      if (known.has(p.baseUrl.toLowerCase())) continue;

      known.add(p.baseUrl.toLowerCase());
      addProvider({
        name: p.name,
        preset: p.id,
        kind: p.kind,
        baseUrl: p.baseUrl,
        apiKey: "",
      });
      added += 1;
    }

    setScanMessage(
      found.length === 0
        ? "No running servers found on the default ports."
        : `Found: ${found.join(", ")}. Added ${added} new.`
    );
    logger.info("settings", `Scan finished: ${found.join(", ") || "nothing found"}`);
    setScanning(false);
  };

  return (
    <div className="space-y-5 max-w-5xl">

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">AI servers</h2>
            <p className="text-sm text-gray-400 mt-1">
              Choose which local server InferTune talks to. Anything that
              exposes an OpenAI-compatible API works.
            </p>
          </div>

          <button
            onClick={scan}
            disabled={scanning}
            className="flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 hover:bg-gray-600 disabled:opacity-50"
          >
            <ScanSearch size={16} />
            {scanning ? "Scanning..." : "Scan for running servers"}
          </button>
        </div>

        {scanMessage && (
          <p className="mt-3 text-sm text-gray-300">{scanMessage}</p>
        )}

        <div className="mt-5 space-y-3">
          {providers.map((p) => {
            const isActive = p.id === activeId;
            const state = tests[p.id] ?? "idle";

            return (
              <div
                key={p.id}
                className={`rounded-lg border p-4 ${
                  isActive
                    ? "border-blue-600 bg-blue-950/20"
                    : "border-gray-800 bg-gray-800/40"
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Name</label>
                    <input
                      value={p.name}
                      onChange={(e) =>
                        updateProvider(p.id, { name: e.target.value })
                      }
                      className="w-full rounded-lg bg-gray-800 p-2 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Address
                    </label>
                    <input
                      value={p.baseUrl}
                      onChange={(e) =>
                        updateProvider(p.id, { baseUrl: e.target.value.trim() })
                      }
                      placeholder="http://localhost:1234"
                      className="w-full rounded-lg bg-gray-800 p-2 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Type
                    </label>
                    <select
                      value={p.kind}
                      onChange={(e) =>
                        updateProvider(p.id, {
                          kind: e.target.value as ProviderProfile["kind"],
                        })
                      }
                      className="w-full rounded-lg bg-gray-800 p-2"
                    >
                      <option value="ollama">Ollama (native API)</option>
                      <option value="openai">OpenAI-compatible</option>
                    </select>
                  </div>

                  {p.kind === "openai" && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        API key (optional)
                      </label>
                      <input
                        type="password"
                        value={p.apiKey}
                        onChange={(e) =>
                          updateProvider(p.id, { apiKey: e.target.value })
                        }
                        placeholder="Leave empty for local servers"
                        className="w-full rounded-lg bg-gray-800 p-2 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {isActive ? (
                    <span className="rounded bg-blue-900/60 px-2 py-1 text-xs text-blue-300">
                      In use
                    </span>
                  ) : (
                    <button
                      onClick={() => setActiveProvider(p.id)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 hover:bg-blue-700"
                    >
                      Use this server
                    </button>
                  )}

                  <button
                    onClick={() => test(p)}
                    disabled={state === "testing"}
                    className="rounded-lg bg-gray-700 px-3 py-1.5 hover:bg-gray-600 disabled:opacity-50"
                  >
                    {state === "testing" ? "Testing..." : "Test connection"}
                  </button>

                  {state === "ok" && (
                    <span className="text-sm text-green-400">Connected</span>
                  )}
                  {state === "fail" && (
                    <span className="text-sm text-red-400">Not reachable</span>
                  )}

                  {providers.length > 1 && (
                    <div className="ml-auto">
                      {confirm === p.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              removeProvider(p.id);
                              setConfirm(null);
                            }}
                            className="rounded-lg bg-red-600 px-3 py-1.5 hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirm(null)}
                            className="rounded-lg bg-gray-700 px-3 py-1.5 hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirm(p.id)}
                          className="rounded-lg bg-gray-800 px-3 py-1.5 text-gray-300 hover:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg bg-gray-800/60 p-4">
          <p className="mb-2 text-sm font-medium">Add a server</p>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              className="rounded-lg bg-gray-800 p-2"
            >
              {PROVIDER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              onClick={addFromPreset}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 hover:bg-blue-700"
            >
              <Plus size={16} /> Add
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-400">
            {preset.baseUrl} · {preset.note}
          </p>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          API keys are stored on this computer only, in the app's local storage.
        </p>
      </section>

      <DesktopPanel />

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-xl font-semibold">Monitoring</h2>

        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm text-gray-300">Refresh hardware stats every</label>
          <select
            value={pollIntervalMs}
            onChange={(e) => setPollInterval(Number(e.target.value))}
            className="rounded-lg bg-gray-800 p-2"
          >
            {INTERVALS.map((i) => (
              <option key={i.ms} value={i.ms}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-xl font-semibold">Data</h2>

        <div className="mt-4 flex flex-wrap gap-3">
          <DangerButton
            id="sessions"
            confirm={confirm}
            setConfirm={setConfirm}
            label={`Clear ${sessionCount} session${sessionCount === 1 ? "" : "s"}`}
            disabled={sessionCount === 0}
            onConfirm={clearSessions}
          />

          <DangerButton
            id="benchmarks"
            confirm={confirm}
            setConfirm={setConfirm}
            label={`Clear ${benchmarkCount} benchmark${benchmarkCount === 1 ? "" : "s"}`}
            disabled={benchmarkCount === 0}
            onConfirm={clearBenchmarks}
          />

          <DangerButton
            id="reset"
            confirm={confirm}
            setConfirm={setConfirm}
            label="Reset settings"
            onConfirm={resetSettings}
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-xl font-semibold">About</h2>
        <p className="mt-2 text-sm text-gray-300">
          InferTune {pkg.version} · hardware-aware tuning studio for local LLMs.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Everything runs on your computer. Nothing is sent anywhere except to
          the servers you configure above.
        </p>
      </section>

    </div>
  );
}

function DangerButton({
  id,
  label,
  confirm,
  setConfirm,
  onConfirm,
  disabled,
}: {
  id: string;
  label: string;
  confirm: string | null;
  setConfirm: (id: string | null) => void;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  if (confirm === id) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => {
            onConfirm();
            setConfirm(null);
          }}
          className="rounded-lg bg-red-600 px-3 py-2 hover:bg-red-700"
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirm(null)}
          className="rounded-lg bg-gray-700 px-3 py-2 hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(id)}
      disabled={disabled}
      className="rounded-lg bg-gray-800 px-3 py-2 text-gray-300 hover:text-red-400 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
