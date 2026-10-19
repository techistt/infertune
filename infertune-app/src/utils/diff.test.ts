import { describe, expect, it } from "vitest";
import { diffWords, MAX_DIFF_WORDS, similarity } from "./diff";

const only = (parts: ReturnType<typeof diffWords>, kind: string) =>
  (parts ?? []).filter((p) => p.kind === kind).map((p) => p.text.trim());

describe("diffWords", () => {
  it("reports identical text as one unchanged part", () => {
    expect(diffWords("same text", "same text")).toEqual([
      { kind: "same", text: "same text" },
    ]);
  });

  it("marks replaced words", () => {
    const parts = diffWords("the quick brown fox", "the slow brown fox");

    expect(only(parts, "del")).toEqual(["quick"]);
    expect(only(parts, "add")).toEqual(["slow"]);
  });

  it("marks inserted and removed words", () => {
    expect(only(diffWords("a b c", "a b c d"), "add")).toEqual(["d"]);
    expect(only(diffWords("a b c d", "a b c"), "del")).toEqual(["d"]);
  });

  it("can rebuild both texts exactly", () => {
    const a = "Hello there,\nGeneral Kenobi!";
    const b = "Hello there,\nGeneral Grievous!";
    const parts = diffWords(a, b)!;

    expect(parts.filter((p) => p.kind !== "add").map((p) => p.text).join("")).toBe(a);
    expect(parts.filter((p) => p.kind !== "del").map((p) => p.text).join("")).toBe(b);
  });

  it("handles empty texts", () => {
    expect(diffWords("", "")).toEqual([]);
    expect(only(diffWords("", "new"), "add")).toEqual(["new"]);
  });

  it("gives up on huge texts instead of freezing", () => {
    const huge = "word ".repeat(MAX_DIFF_WORDS * 2 + 10);

    expect(diffWords(huge, "x")).toBeNull();
  });
});

describe("similarity", () => {
  it("is 1 for identical texts and 0 for unrelated ones", () => {
    expect(similarity(diffWords("a b c", "a b c")!)).toBe(1);
    expect(similarity(diffWords("a b c", "x y z")!)).toBe(0);
  });

  it("is between 0 and 1 for partial overlap", () => {
    const value = similarity(diffWords("a b c d", "a b x y")!);

    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
  });
});
