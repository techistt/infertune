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

import {
  makeCheck,
  parseSet,
  serializeSet,
  toQuestions,
  validateQuestion,
  type CustomQuestion,
} from "./quality";

const cq = (mode: CustomQuestion["mode"], expected: string): CustomQuestion => ({
  id: "x",
  prompt: "p",
  expected,
  mode,
});

describe("custom question sets", () => {
  it("checks each match mode", () => {
    expect(makeCheck(cq("contains", "Paris"))("It is paris, France")).toBe(true);
    expect(makeCheck(cq("contains", "Paris"))("London")).toBe(false);
    expect(makeCheck(cq("exact", "Yes"))('"yes."')).toBe(true);
    expect(makeCheck(cq("exact", "Yes"))("yes it is")).toBe(false);
    expect(makeCheck(cq("number", "1,000"))("total 1000")).toBe(true);
    expect(makeCheck(cq("number", "5"))("5 then 6")).toBe(false);
    expect(makeCheck(cq("regex", "^\\d{3}$"))("123")).toBe(true);
    expect(makeCheck(cq("regex", "^\\d{3}$"))("12")).toBe(false);
    // bad regex never matches and never throws
    expect(makeCheck(cq("regex", "("))("anything")).toBe(false);
  });

  it("validates questions", () => {
    expect(validateQuestion(cq("contains", "a"))).toBeNull();
    expect(validateQuestion({ ...cq("contains", "a"), prompt: " " })).toMatch(/empty/);
    expect(validateQuestion(cq("contains", ""))).toMatch(/empty/);
    expect(validateQuestion(cq("number", "abc"))).toMatch(/number/);
    expect(validateQuestion(cq("regex", "("))).toMatch(/regular/);
  });

  it("round-trips through export and import", () => {
    const set = { id: "s", name: "Mine", questions: [cq("contains", "a"), cq("number", "2")] };
    const parsed = parseSet(serializeSet(set));

    expect(parsed?.name).toBe("Mine");
    expect(parsed?.questions).toHaveLength(2);
    expect(parsed?.questions[1].mode).toBe("number");
  });

  it("rejects bad imports and skips bad questions", () => {
    expect(parseSet("not json")).toBeNull();
    expect(parseSet('{"questions":[]}')).toBeNull();
    const text = JSON.stringify({
      infertuneQuestionSet: 1,
      questions: [
        { prompt: "ok", expected: "a", mode: "contains" },
        { prompt: "", expected: "a", mode: "contains" },
        { prompt: "x", expected: "(", mode: "regex" },
        { prompt: "x", expected: "a", mode: "weird" },
      ],
    });

    expect(parseSet(text)?.questions).toHaveLength(1);
    expect(parseSet(text)?.name).toBe("Imported set");
  });

  it("turns a set into gradable questions", () => {
    const qs = toQuestions({ id: "s", name: "n", questions: [cq("contains", "yes")] });

    expect(qs[0].category).toBe("custom");
    expect(grade(qs[0], "Yes!")).toBe(true);
  });
});
