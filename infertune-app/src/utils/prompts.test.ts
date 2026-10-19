import { describe, expect, it } from "vitest";
import {
  BUILT_IN_PROMPTS,
  parsePromptFile,
  samePrompt,
  serializePrompts,
  type SavedPrompt,
} from "./prompts";

const saved: SavedPrompt = {
  id: "1",
  name: "Summarizer",
  systemPrompt: "Be brief.",
  userPrompt: "Summarize:",
  createdAt: 1,
};

describe("prompt files", () => {
  it("round-trips through export and import", () => {
    const [back] = parsePromptFile(serializePrompts([saved]));

    expect(back.name).toBe("Summarizer");
    expect(back.systemPrompt).toBe("Be brief.");
    expect(back.userPrompt).toBe("Summarize:");
  });

  it("accepts a bare array", () => {
    const list = parsePromptFile(
      JSON.stringify([{ name: "A", userPrompt: "hello" }])
    );

    expect(list).toHaveLength(1);
    expect(list[0].systemPrompt).toBe("");
  });

  it("skips malformed entries but keeps good ones", () => {
    const list = parsePromptFile(
      JSON.stringify({
        prompts: [{ name: "", userPrompt: "x" }, 5, null, { name: "Ok", userPrompt: "y" }],
      })
    );

    expect(list.map((p) => p.name)).toEqual(["Ok"]);
  });

  it("explains bad files", () => {
    expect(() => parsePromptFile("not json")).toThrow(/valid JSON/);
    expect(() => parsePromptFile("{}")).toThrow(/No prompts/);
    expect(() => parsePromptFile("[]")).toThrow(/No usable prompts/);
  });

  it("limits very long names", () => {
    const [p] = parsePromptFile(
      JSON.stringify([{ name: "x".repeat(300), userPrompt: "y" }])
    );

    expect(p.name).toHaveLength(80);
  });
});

describe("samePrompt", () => {
  it("compares name and both texts", () => {
    expect(samePrompt(saved, { ...saved })).toBe(true);
    expect(samePrompt(saved, { ...saved, userPrompt: "other" })).toBe(false);
  });
});

describe("built-in templates", () => {
  it("have unique names and text", () => {
    const names = BUILT_IN_PROMPTS.map((t) => t.name);

    expect(new Set(names).size).toBe(names.length);
    for (const t of BUILT_IN_PROMPTS) {
      expect(t.systemPrompt.length).toBeGreaterThan(10);
      expect(t.userPrompt.length).toBeGreaterThan(0);
    }
  });
});
