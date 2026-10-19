import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PROVIDER,
  getActiveProfile,
  useSettingsStore,
} from "./settingsStore";
import { newRecordId, useHistoryStore, type SessionRecord } from "./historyStore";
import { errorMessage, logger, useLogStore } from "./logStore";

const server = {
  name: "LM Studio",
  preset: "lmstudio",
  kind: "openai" as const,
  baseUrl: "http://localhost:1234",
  apiKey: "",
};

describe("settings store", () => {
  beforeEach(() => useSettingsStore.getState().resetSettings());

  it("starts with Ollama active", () => {
    expect(getActiveProfile().id).toBe(DEFAULT_PROVIDER.id);
  });

  it("adds a server and can switch to it", () => {
    const id = useSettingsStore.getState().addProvider(server);
    useSettingsStore.getState().setActiveProvider(id);

    expect(getActiveProfile().name).toBe("LM Studio");
    expect(useSettingsStore.getState().providers).toHaveLength(2);
  });

  it("falls back to another server when the active one is removed", () => {
    const id = useSettingsStore.getState().addProvider(server);
    useSettingsStore.getState().setActiveProvider(id);
    useSettingsStore.getState().removeProvider(id);

    expect(getActiveProfile().id).toBe(DEFAULT_PROVIDER.id);
  });

  it("never removes the last server", () => {
    useSettingsStore.getState().removeProvider(DEFAULT_PROVIDER.id);

    expect(useSettingsStore.getState().providers).toHaveLength(1);
  });

  it("updates a server in place", () => {
    useSettingsStore
      .getState()
      .updateProvider(DEFAULT_PROVIDER.id, { baseUrl: "http://localhost:9" });

    expect(getActiveProfile().baseUrl).toBe("http://localhost:9");
  });
});

function session(id: string): SessionRecord {
  return {
    id,
    createdAt: Date.now(),
    providerName: "Ollama",
    model: "m",
    systemPrompt: "",
    userPrompt: "p",
    response: "r",
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxTokens: 100,
    seed: 1,
    contextLength: 4096,
    tokens: 10,
    generationTime: 1000,
    tokensPerSecond: 10,
  };
}

describe("history store", () => {
  beforeEach(() => {
    useHistoryStore.getState().clearSessions();
    useHistoryStore.getState().clearBenchmarks();
  });

  it("puts the newest session first and deletes by id", () => {
    useHistoryStore.getState().addSession(session("a"));
    useHistoryStore.getState().addSession(session("b"));

    expect(useHistoryStore.getState().sessions.map((s) => s.id)).toEqual(["b", "a"]);

    useHistoryStore.getState().deleteSession("b");
    expect(useHistoryStore.getState().sessions.map((s) => s.id)).toEqual(["a"]);
  });

  it("keeps at most 200 sessions", () => {
    for (let i = 0; i < 205; i++) {
      useHistoryStore.getState().addSession(session(String(i)));
    }

    const sessions = useHistoryStore.getState().sessions;
    expect(sessions).toHaveLength(200);
    expect(sessions[0].id).toBe("204");
  });

  it("generates distinct record ids", () => {
    const ids = new Set(Array.from({ length: 50 }, newRecordId));
    expect(ids.size).toBe(50);
  });
});

describe("log store", () => {
  beforeEach(() => useLogStore.getState().clear());

  it("records entries with level and source", () => {
    logger.error("generate", "boom");

    const [entry] = useLogStore.getState().entries;
    expect(entry).toMatchObject({ level: "error", source: "generate", message: "boom" });
  });

  it("keeps the last 500 entries", () => {
    for (let i = 0; i < 510; i++) logger.info("t", String(i));

    const entries = useLogStore.getState().entries;
    expect(entries).toHaveLength(500);
    expect(entries[0].message).toBe("10");
  });

  it("turns any error value into text", () => {
    expect(errorMessage("text")).toBe("text");
    expect(errorMessage(new Error("e"))).toBe("e");
    expect(errorMessage({ a: 1 })).toBe('{"a":1}');
  });
});

describe("desktop preferences", () => {
  beforeEach(() => useSettingsStore.getState().resetSettings());

  it("has safe defaults", () => {
    const s = useSettingsStore.getState();

    expect(s.notificationsEnabled).toBe(true);
    expect(s.closeToTray).toBe(false);
    expect(s.apiPort).toBe(11500);
    expect(s.apiToken).toBe("");
  });

  it("keeps the API port in a usable range", () => {
    useSettingsStore.getState().setApiPort(8080);
    expect(useSettingsStore.getState().apiPort).toBe(8080);

    useSettingsStore.getState().setApiPort(80);
    expect(useSettingsStore.getState().apiPort).toBe(11500);

    useSettingsStore.getState().setApiPort(Number.NaN);
    expect(useSettingsStore.getState().apiPort).toBe(11500);

    useSettingsStore.getState().setApiPort(70000);
    expect(useSettingsStore.getState().apiPort).toBe(11500);
  });
});

describe("quality history", () => {
  beforeEach(() => useHistoryStore.getState().clearQualityRuns());

  const run = (id: string) => ({
    id,
    createdAt: 1,
    providerName: "Ollama",
    model: "m",
    correct: 9,
    total: 12,
    percent: 75,
    byCategory: [],
    answers: [],
    avgTokensPerSecond: 10,
  });

  it("adds newest first, deletes and clears", () => {
    const h = useHistoryStore.getState();

    h.addQualityRun(run("a"));
    h.addQualityRun(run("b"));
    expect(useHistoryStore.getState().qualityRuns.map((r) => r.id)).toEqual(["b", "a"]);

    h.deleteQualityRun("b");
    expect(useHistoryStore.getState().qualityRuns).toHaveLength(1);

    h.clearQualityRuns();
    expect(useHistoryStore.getState().qualityRuns).toEqual([]);
  });

  it("keeps at most 50 runs", () => {
    const h = useHistoryStore.getState();

    for (let i = 0; i < 60; i++) h.addQualityRun(run(String(i)));

    expect(useHistoryStore.getState().qualityRuns).toHaveLength(50);
  });
});
