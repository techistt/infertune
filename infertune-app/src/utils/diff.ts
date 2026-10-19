export type DiffKind = "same" | "add" | "del";

export interface DiffPart {
  kind: DiffKind;
  text: string;
}

/** Longest input (in words) that is compared; bigger texts skip the diff. */
export const MAX_DIFF_WORDS = 1500;

function tokenize(text: string): string[] {
  // Keep whitespace as its own tokens so the text can be rebuilt exactly.
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

/**
 * Word-level difference between two texts. Returns null when either text is
 * too long to compare quickly.
 *
 * `del` parts only exist in `a`, `add` parts only in `b`, `same` in both.
 */
export function diffWords(a: string, b: string): DiffPart[] | null {
  const x = tokenize(a);
  const y = tokenize(b);

  if (x.length > MAX_DIFF_WORDS * 2 || y.length > MAX_DIFF_WORDS * 2) {
    return null;
  }

  const rows = x.length + 1;
  const cols = y.length + 1;

  // lcs[i][j] = length of the longest common subsequence of x[i..] and y[j..]
  const lcs = new Uint16Array(rows * cols);

  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      lcs[i * cols + j] =
        x[i] === y[j]
          ? lcs[(i + 1) * cols + j + 1] + 1
          : Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + j + 1]);
    }
  }

  const parts: DiffPart[] = [];

  const push = (kind: DiffKind, text: string) => {
    const last = parts[parts.length - 1];

    if (last && last.kind === kind) {
      last.text += text;
    } else {
      parts.push({ kind, text });
    }
  };

  let i = 0;
  let j = 0;

  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      push("same", x[i]);
      i++;
      j++;
    } else if (lcs[(i + 1) * cols + j] >= lcs[i * cols + j + 1]) {
      push("del", x[i]);
      i++;
    } else {
      push("add", y[j]);
      j++;
    }
  }

  while (i < x.length) push("del", x[i++]);
  while (j < y.length) push("add", y[j++]);

  return parts;
}

/** Share of the combined text that both versions have in common (0 to 1). */
export function similarity(parts: DiffPart[]): number {
  let same = 0;
  let total = 0;

  for (const part of parts) {
    const words = part.text.split(/\s+/).filter(Boolean).length;
    total += words;
    if (part.kind === "same") same += words;
  }

  // "same" words are counted once but exist in both texts.
  const both = same * 2;
  const all = total + same;

  return all === 0 ? 1 : both / all;
}
