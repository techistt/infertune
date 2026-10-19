import { useCallback, useEffect, useState } from "react";
import { useSettingsStore, getActiveProfile } from "../store/settingsStore";
import { toConfig } from "../types/provider";
import {
  getApiStatus,
  startApiServer,
  stopApiServer,
  type ApiStatus,
} from "../services/apiService";
import { logger, errorMessage } from "../store/logStore";

/** 32 random hex characters. */
function newToken(): string {
  const bytes = new Uint8Array(16);

  crypto.getRandomValues(bytes);

  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function DesktopPanel() {
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const closeToTray = useSettingsStore((s) => s.closeToTray);
  const apiPort = useSettingsStore((s) => s.apiPort);
  const apiToken = useSettingsStore((s) => s.apiToken);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
  const setCloseToTray = useSettingsStore((s) => s.setCloseToTray);
  const setApiPort = useSettingsStore((s) => s.setApiPort);
  const setApiToken = useSettingsStore((s) => s.setApiToken);

  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portText, setPortText] = useState(String(apiPort));

  // A token is on by default so websites cannot use the server.
  useEffect(() => {
    if (!useSettingsStore.getState().apiToken) setApiToken(newToken());
  }, [setApiToken]);

  const refresh = useCallback(async () => setStatus(await getApiStatus()), []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000);

    return () => clearInterval(timer);
  }, [refresh]);

  const toggle = async () => {
    setBusy(true);
    setError(null);

    try {
      if (status) {
        await stopApiServer();
        logger.info("api", "Local API server stopped");
      } else {
        const started = await startApiServer(
          toConfig(getActiveProfile()),
          apiPort,
          apiToken
        );

        logger.info("api", `Local API server listening on 127.0.0.1:${started.port}`);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const address = status ? `http://127.0.0.1:${status.port}/v1` : `http://127.0.0.1:${apiPort}/v1`;

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="text-xl font-semibold">Desktop</h2>

      <div className="mt-3 space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
          />
          Notify me when a benchmark, quality check or auto-tune finishes (only
          while the window is in the background)
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={closeToTray}
            onChange={(e) => setCloseToTray(e.target.checked)}
          />
          Closing the window keeps InferTune running in the tray
        </label>
      </div>

      <h3 className="mt-6 text-lg font-semibold">Local API server</h3>
      <p className="mt-1 text-sm text-gray-400">
        Lets other apps on this computer (editors, scripts, chat UIs) use your
        active server through one OpenAI-compatible address. It only accepts
        connections from this computer.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-gray-400">Port</span>
          <input
            value={portText}
            disabled={!!status}
            onChange={(e) => setPortText(e.target.value)}
            onBlur={() => {
              setApiPort(Number(portText));
              setPortText(String(useSettingsStore.getState().apiPort));
            }}
            className="w-28 rounded-lg bg-gray-800 p-2 disabled:opacity-60"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs text-gray-400">
            Access token
          </span>
          <input
            value={apiToken}
            disabled={!!status}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="none"
            className="w-64 rounded-lg bg-gray-800 p-2 font-mono text-sm disabled:opacity-60"
          />
        </label>

        <button
          onClick={() => setApiToken(newToken())}
          disabled={!!status}
          className="rounded-lg bg-gray-700 px-3 py-2 text-sm hover:bg-gray-600 disabled:opacity-50"
        >
          New token
        </button>

        <button
          onClick={toggle}
          disabled={busy}
          className={`rounded-lg px-4 py-2 disabled:opacity-50 ${
            status ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {status ? "Stop server" : "Start server"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-950 p-3 text-sm text-red-300 break-words">
          {error}
        </p>
      )}

      <div className="mt-4 rounded-lg bg-gray-800 p-3 text-sm">
        <div className="text-gray-400">
          {status
            ? `Running · ${status.requests} request${status.requests === 1 ? "" : "s"} served`
            : "Stopped"}
        </div>
        <div className="mt-1 font-mono break-all">Base URL: {address}</div>
        <div className="mt-1 text-xs text-gray-500">
          Use any model name from your server and set the API key in the other app
          to this token. Without a token, requests from web pages are refused. It forwards to the server that is active when
          you press Start; stop and start again after switching servers.
        </div>
      </div>
    </section>
  );
}
