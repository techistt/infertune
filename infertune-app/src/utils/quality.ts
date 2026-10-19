export type QualityCategory =
  | "math"
  | "logic"
  | "knowledge"
  | "instructions"
  | "code";

export const CATEGORY_LABEL: Record<QualityCategory, string> = {
  math: "Math",
  logic: "Logic",
  knowledge: "Knowledge",
  instructions: "Instructions",
  code: "Code",
};

export interface QualityQuestion {
  id: string;
  category: QualityCategory;
  prompt: string;
  /** The correct answer, shown next to the model's answer. */
  expected: string;
  /** True when the model's reply is correct. */
  check: (answer: string) => boolean;
}

/** The last number in the text, or null. Handles "1,234" and "-5". */
export function lastNumber(text: string): number | null {
  const matches = text.replace(/(\d),(\d{3})/g, "$1$2").match(/-?\d+(?:\.\d+)?/g);

  if (!matches) return null;

  return Number(matches[matches.length - 1]);
}

/**
 * Which of the given words appears last in the text (case-insensitive).
 * Models that think out loud usually state the final answer last.
 */
export function lastWordOf(text: string, words: string[]): string | null {
  let best: { word: string; index: number } | null = null;

  for (const word of words) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (!best || match.index > best.index) {
        best = { word: word.toLowerCase(), index: match.index };
      }
    }
  }

  return best ? best.word : null;
}

/** Strips quotes, backticks, bold markers and end punctuation. */
function plain(text: string): string {
  return text
    .trim()
    .replace(/^[\s"'`*_]+|[\s"'`*_.!]+$/g, "")
    .trim();
}

export const QUALITY_QUESTIONS: QualityQuestion[] = [
  {
    id: "math-1",
    category: "math",
    prompt: "What is 17 × 24? Reply with just the number.",
    expected: "408",
    check: (a) => lastNumber(a) === 408,
  },
  {
    id: "math-2",
    category: "math",
    prompt:
      "A jacket costs $80 and is on sale for 25% off. What is the sale price in dollars? Reply with just the number.",
    expected: "60",
    check: (a) => lastNumber(a) === 60,
  },
  {
    id: "logic-1",
    category: "logic",
    prompt:
      "Tom is taller than Sam. Sam is taller than Lee. Who is the shortest? Reply with one name.",
    expected: "Lee",
    check: (a) => lastWordOf(a, ["Tom", "Sam", "Lee"]) === "lee",
  },
  {
    id: "logic-2",
    category: "logic",
    prompt:
      "All bloops are razzies. All razzies are lazzies. Are all bloops definitely lazzies? Answer yes or no.",
    expected: "yes",
    check: (a) => lastWordOf(a, ["yes", "no"]) === "yes",
  },
  {
    id: "logic-3",
    category: "logic",
    prompt:
      "I have 3 apples. I eat 1 and then buy 4 more. How many apples do I have? Reply with just the number.",
    expected: "6",
    check: (a) => lastNumber(a) === 6,
  },
  {
    id: "know-1",
    category: "knowledge",
    prompt: "What is the capital city of Australia? Reply with one word.",
    expected: "Canberra",
    check: (a) => /canberra/i.test(a) && !/sydney[\s\S]*$/i.test(a.slice(a.search(/canberra/i) + 8)),
  },
  {
    id: "know-2",
    category: "knowledge",
    prompt: "What is the chemical symbol for gold? Reply with just the symbol.",
    expected: "Au",
    check: (a) => /\bAu\b/.test(a),
  },
  {
    id: "know-3",
    category: "knowledge",
    prompt: "Which planet is known as the Red Planet? Reply with one word.",
    expected: "Mars",
    check: (a) => /\bmars\b/i.test(a),
  },
  {
    id: "inst-1",
    category: "instructions",
    prompt: "Reply with exactly the word BANANA in capital letters and nothing else.",
    expected: "BANANA",
    check: (a) => plain(a) === "BANANA",
  },
  {
    id: "inst-2",
    category: "instructions",
    prompt:
      "List exactly three colors separated by commas, with no other text.",
    expected: "three comma-separated colors",
    check: (a) => {
      const text = plain(a);
      const parts = text.split(",").map((p) => p.trim());

      return (
        !text.includes("\n") &&
        parts.length === 3 &&
        parts.every((p) => /^[A-Za-z][A-Za-z -]{1,20}$/.test(p))
      );
    },
  },
  {
    id: "code-1",
    category: "code",
    prompt:
      "What number does this Python code print? Reply with just the number.\n\nprint(len([x for x in range(10) if x % 3 == 0]))",
    expected: "4",
    check: (a) => lastNumber(a) === 4,
  },
  {
    id: "code-2",
    category: "code",
    prompt:
      "What is the time complexity of binary search? Reply in Big-O notation only.",
    expected: "O(log n)",
    check: (a) => /O\s*\(\s*log\s*(?:\(\s*)?n\s*\)?\s*\)/i.test(a),
  },
];

export interface GradedAnswer {
  id: string;
  category: QualityCategory;
  correct: boolean;
  answer: string;
}

export interface CategoryScore {
  category: QualityCategory;
  correct: number;
  total: number;
}

export interface QualityScore {
  correct: number;
  total: number;
  /** 0 to 100 */
  percent: number;
  byCategory: CategoryScore[];
}

/** Marks one answer right or wrong. Empty answers are always wrong. */
export function grade(question: QualityQuestion, answer: string): boolean {
  if (!answer.trim()) return false;

  try {
    return question.check(answer);
  } catch {
    return false;
  }
}

export function scoreAnswers(answers: GradedAnswer[]): QualityScore {
  const categories = new Map<QualityCategory, CategoryScore>();
  let correct = 0;

  for (const a of answers) {
    const entry = categories.get(a.category) ?? {
      category: a.category,
      correct: 0,
      total: 0,
    };

    entry.total += 1;

    if (a.correct) {
      entry.correct += 1;
      correct += 1;
    }

    categories.set(a.category, entry);
  }

  const total = answers.length;

  return {
    correct,
    total,
    percent: total > 0 ? (correct / total) * 100 : 0,
    byCategory: Array.from(categories.values()),
  };
}

/** Removes <think>...</think> blocks that reasoning models put before the answer. */
export function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*<\/think>/i, "")
    .trim();
}

/** Short, single-line version of an answer for tables. */
export function snippet(answer: string, max = 140): string {
  const flat = answer.replace(/\s+/g, " ").trim();

  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
