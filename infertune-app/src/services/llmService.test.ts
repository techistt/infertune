import { describe, expect, it } from "vitest";
import { buildGenerateArgs } from "./llmService";

const provider = { kind: "ollama" as const, baseUrl: "http://localhost:11434", apiKey: "" };

const request = {
  model: "m",
  systemPrompt: "s",
  userPrompt: "u",
  temperature: 0.5,
  topP: 0.9,
  topK: 40,
  maxTokens: 100,
  seed: 1,
  contextLength: 4096,
};

describe("buildGenerateArgs", () => {
  it("defaults history to empty and GPU layers to automatic", () => {
    const args = buildGenerateArgs(request, provider);

    expect(args.history).toEqual([]);
    expect(args.numGpu).toBeNull();
    expect(args.provider).toBe(provider);
  });

  it("passes history and GPU layers through", () => {
    const args = buildGenerateArgs(
      {
        ...request,
        history: [{ role: "user", content: "hi" }],
        numGpu: 12,
      },
      provider
    );

    expect(args.history).toEqual([{ role: "user", content: "hi" }]);
    expect(args.numGpu).toBe(12);
  });

  it("keeps zero GPU layers (CPU only) instead of treating it as empty", () => {
    expect(buildGenerateArgs({ ...request, numGpu: 0 }, provider).numGpu).toBe(0);
  });
});
