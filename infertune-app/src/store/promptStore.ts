import { create } from "zustand";
import { persist } from "zustand/middleware";
import { samePrompt, type SavedPrompt } from "../utils/prompts";

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const MAX_PROMPTS = 200;

interface PromptState {
  prompts: SavedPrompt[];

  savePrompt: (name: string, systemPrompt: string, userPrompt: string) => void;
  deletePrompt: (id: string) => void;
  /** Adds prompts that are not already saved; returns how many were added. */
  importPrompts: (list: SavedPrompt[]) => number;
}

export const usePromptStore = create<PromptState>()(
  persist(
    (set, get) => ({
      prompts: [],

      savePrompt: (name, systemPrompt, userPrompt) =>
        set((state) => {
          const entry: SavedPrompt = {
            id: newId(),
            name: name.trim().slice(0, 80),
            systemPrompt,
            userPrompt,
            createdAt: Date.now(),
          };

          // Saving under an existing name replaces that prompt.
          const others = state.prompts.filter((p) => p.name !== entry.name);

          return { prompts: [entry, ...others].slice(0, MAX_PROMPTS) };
        }),

      deletePrompt: (id) =>
        set((state) => ({ prompts: state.prompts.filter((p) => p.id !== id) })),

      importPrompts: (list) => {
        const existing = get().prompts;
        const fresh: SavedPrompt[] = [];

        for (const item of list) {
          const duplicate =
            existing.some((p) => samePrompt(p, item)) ||
            fresh.some((p) => samePrompt(p, item));

          if (!duplicate) fresh.push({ ...item, id: newId() });
        }

        if (fresh.length > 0) {
          set((state) => ({
            prompts: [...fresh, ...state.prompts].slice(0, MAX_PROMPTS),
          }));
        }

        return fresh.length;
      },
    }),
    { name: "infertune-prompts", version: 1 }
  )
);
