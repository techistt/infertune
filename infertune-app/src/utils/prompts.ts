export interface SavedPrompt {
  id: string;
  name: string;
  systemPrompt: string;
  userPrompt: string;
  createdAt: number;
}

export interface PromptTemplate {
  name: string;
  systemPrompt: string;
  userPrompt: string;
}

/** Starting points shown in the prompt library. */
export const BUILT_IN_PROMPTS: PromptTemplate[] = [
  {
    name: "Code reviewer",
    systemPrompt:
      "You are a careful senior engineer. Review the code for bugs, unclear naming and missing edge cases. Be specific and suggest fixes.",
    userPrompt: "Review this code:\n\n",
  },
  {
    name: "Summarizer",
    systemPrompt:
      "You summarize text accurately and briefly. Keep every important fact; leave out filler.",
    userPrompt: "Summarize the following in three bullet points:\n\n",
  },
  {
    name: "Explain simply",
    systemPrompt:
      "You explain things in plain language for a curious beginner, using short sentences and one concrete example.",
    userPrompt: "Explain: ",
  },
  {
    name: "Translator",
    systemPrompt:
      "You are a professional translator. Reply with the translation only.",
    userPrompt: "Translate to Spanish:\n\n",
  },
  {
    name: "Brainstorm",
    systemPrompt:
      "You are a creative partner. Offer varied, concrete ideas rather than generic advice.",
    userPrompt: "Give me 10 ideas for: ",
  },
];

export function serializePrompts(prompts: SavedPrompt[]): string {
  return JSON.stringify({ app: "InferTune", version: 1, prompts }, null, 2);
}

/**
 * Reads a prompt file written by serializePrompts (or a bare array).
 * Invalid entries are skipped; invalid files throw a readable error.
 */
export function parsePromptFile(text: string): SavedPrompt[] {
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }

  const list = Array.isArray(data)
    ? data
    : (data as { prompts?: unknown } | null)?.prompts;

  if (!Array.isArray(list)) {
    throw new Error("No prompts found in that file.");
  }

  const result: SavedPrompt[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;

    const { name, systemPrompt, userPrompt } = item as Record<string, unknown>;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof userPrompt !== "string"
    ) {
      continue;
    }

    result.push({
      id: "",
      name: name.trim().slice(0, 80),
      systemPrompt: typeof systemPrompt === "string" ? systemPrompt : "",
      userPrompt,
      createdAt: Date.now(),
    });
  }

  if (result.length === 0) {
    throw new Error("No usable prompts found in that file.");
  }

  return result;
}

/** True when two prompts have the same name and text. */
export function samePrompt(
  a: Pick<SavedPrompt, "name" | "systemPrompt" | "userPrompt">,
  b: Pick<SavedPrompt, "name" | "systemPrompt" | "userPrompt">
): boolean {
  return (
    a.name === b.name &&
    a.systemPrompt === b.systemPrompt &&
    a.userPrompt === b.userPrompt
  );
}
