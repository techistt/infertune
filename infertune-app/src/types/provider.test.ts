import { describe, expect, it } from "vitest";
import { PROVIDER_PRESETS, toConfig } from "./provider";

describe("provider presets", () => {
  it("has unique ids and names", () => {
    const ids = PROVIDER_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only Ollama uses the native API", () => {
    for (const p of PROVIDER_PRESETS) {
      expect(p.kind).toBe(p.id === "ollama" ? "ollama" : "openai");
    }
  });

  it("uses well-formed local addresses", () => {
    for (const p of PROVIDER_PRESETS) {
      expect(p.baseUrl).toMatch(/^http:\/\/localhost:\d+$/);
    }
  });

  it("default ports of scannable servers do not collide", () => {
    const scannable = PROVIDER_PRESETS.filter((p) => p.id !== "custom");
    const urls = scannable.map((p) => p.baseUrl);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("toConfig", () => {
  it("keeps only what the backend needs", () => {
    const config = toConfig({
      id: "x",
      name: "Test",
      preset: "custom",
      kind: "openai",
      baseUrl: "http://localhost:1",
      apiKey: "k",
    });

    expect(config).toEqual({
      kind: "openai",
      baseUrl: "http://localhost:1",
      apiKey: "k",
    });
  });
});
