import { describe, expect, it } from "vitest";
import { CATALOG, discover, sameModel } from "./discovery";

const GB = 1024 ** 3;

describe("model discovery", () => {
  it("matches names with and without :latest", () => {
    expect(sameModel("llama3:latest", "llama3")).toBe(true);
    expect(sameModel("llama3.2:3b", "llama3.2:1b")).toBe(false);
  });

  it("flags installed models and sorts by fit", () => {
    const list = discover(["llama3.2:3b"], 6 * GB, 16 * GB);

    expect(list).toHaveLength(CATALOG.length);
    expect(list.find((m) => m.name === "llama3.2:3b")?.installed).toBe(true);
    expect(list.find((m) => m.name === "llama3.2:1b")?.installed).toBe(false);

    const order = { gpu: 0, partial: 1, cpu: 2, toolarge: 3 } as const;
    for (let i = 1; i < list.length; i++) {
      expect(order[list[i].fit]).toBeGreaterThanOrEqual(order[list[i - 1].fit]);
    }
  });

  it("marks big models too large on tiny machines", () => {
    const list = discover([], 0, 4 * GB);

    expect(list.find((m) => m.name === "qwen2.5:14b")?.fit).toBe("toolarge");
    expect(list.find((m) => m.name === "llama3.2:1b")?.fit).toBe("cpu");
  });
});
