import { beforeEach, describe, expect, it } from "vitest";
import { usePromptStore } from "./promptStore";

const item = (name: string, user = "u") => ({
  id: "",
  name,
  systemPrompt: "s",
  userPrompt: user,
  createdAt: 1,
});

describe("prompt store", () => {
  beforeEach(() => usePromptStore.setState({ prompts: [] }));

  it("saves newest first", () => {
    usePromptStore.getState().savePrompt("A", "s", "u");
    usePromptStore.getState().savePrompt("B", "s", "u");

    expect(usePromptStore.getState().prompts.map((p) => p.name)).toEqual(["B", "A"]);
  });

  it("replaces a prompt saved under the same name", () => {
    usePromptStore.getState().savePrompt("A", "s", "old");
    usePromptStore.getState().savePrompt("A", "s", "new");

    const prompts = usePromptStore.getState().prompts;
    expect(prompts).toHaveLength(1);
    expect(prompts[0].userPrompt).toBe("new");
  });

  it("deletes by id", () => {
    usePromptStore.getState().savePrompt("A", "s", "u");
    const [p] = usePromptStore.getState().prompts;

    usePromptStore.getState().deletePrompt(p.id);
    expect(usePromptStore.getState().prompts).toHaveLength(0);
  });

  it("imports only prompts that are new", () => {
    usePromptStore.getState().savePrompt("A", "s", "u");

    const added = usePromptStore
      .getState()
      .importPrompts([item("A"), item("B"), item("B"), item("C", "other")]);

    expect(added).toBe(2);
    expect(usePromptStore.getState().prompts).toHaveLength(3);
    // Imported prompts get fresh ids.
    expect(new Set(usePromptStore.getState().prompts.map((p) => p.id)).size).toBe(3);
  });
});
