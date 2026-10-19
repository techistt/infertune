import { describe, expect, it } from "vitest";
import {
  QUALITY_QUESTIONS,
  grade,
  lastNumber,
  lastWordOf,
  scoreAnswers,
  snippet,
  stripThinking,
} from "./quality";

const q = (id: string) => QUALITY_QUESTIONS.find((x) => x.id === id)!;

describe("quality grading", () => {
  it("reads the last number", () => {
    expect(lastNumber("17 x 24 = 408")).toBe(408);
    expect(lastNumber("about 1,234 total")).toBe(1234);
    expect(lastNumber("no digits")).toBeNull();
  });

  it("finds the last of several words", () => {
    expect(lastWordOf("Tom is tall, Sam is mid, so Lee", ["Tom", "Sam", "Lee"])).toBe("lee");
    expect(lastWordOf("nothing", ["yes"])).toBeNull();
  });

  it("grades numeric and word answers", () => {
    expect(grade(q("math-1"), "408")).toBe(true);
    expect(grade(q("math-1"), "17*24 is 418")).toBe(false);
    expect(grade(q("logic-1"), "Lee.")).toBe(true);
    expect(grade(q("logic-2"), "Yes, by transitivity")).toBe(true);
    expect(grade(q("know-1"), "Canberra")).toBe(true);
    expect(grade(q("know-2"), "Au")).toBe(true);
    expect(grade(q("know-3"), "mars")).toBe(true);
    expect(grade(q("code-2"), "O(log n)")).toBe(true);
    expect(grade(q("code-2"), "O(n)")).toBe(false);
  });

  it("is strict about instruction following", () => {
    expect(grade(q("inst-1"), "BANANA")).toBe(true);
    expect(grade(q("inst-1"), "**BANANA**")).toBe(true);
    expect(grade(q("inst-1"), "Sure! BANANA")).toBe(false);
    expect(grade(q("inst-2"), "red, green, blue")).toBe(true);
    expect(grade(q("inst-2"), "red, green")).toBe(false);
  });

  it("treats empty answers as wrong", () => {
    expect(grade(q("math-1"), "  ")).toBe(false);
  });

  it("removes thinking blocks", () => {
    expect(stripThinking("<think>hmm 5</think>408")).toBe("408");
    expect(stripThinking("unfinished </think> 7")).toBe("7");
  });

  it("scores by category", () => {
    const s = scoreAnswers([
      { id: "a", category: "math", correct: true, answer: "" },
      { id: "b", category: "math", correct: false, answer: "" },
      { id: "c", category: "code", correct: true, answer: "" },
    ]);

    expect(s.correct).toBe(2);
    expect(s.percent).toBeCloseTo(66.67, 1);
    expect(s.byCategory.find((c) => c.category === "math")).toEqual({
      category: "math",
      correct: 1,
      total: 2,
    });
    expect(scoreAnswers([]).percent).toBe(0);
  });

  it("truncates snippets", () => {
    expect(snippet("a\n\nb")).toBe("a b");
    expect(snippet("x".repeat(200), 10)).toHaveLength(10);
  });
});
