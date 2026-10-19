import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuestionSet } from "../utils/quality";

interface QuestionSetState {
  sets: QuestionSet[];

  /** Adds a new set, or replaces the one with the same id. */
  saveSet: (set: QuestionSet) => void;
  deleteSet: (id: string) => void;
}

export const MAX_SETS = 30;

export const useQuestionSetStore = create<QuestionSetState>()(
  persist(
    (set) => ({
      sets: [],

      saveSet: (incoming) =>
        set((state) => {
          const exists = state.sets.some((s) => s.id === incoming.id);

          return {
            sets: exists
              ? state.sets.map((s) => (s.id === incoming.id ? incoming : s))
              : [incoming, ...state.sets].slice(0, MAX_SETS),
          };
        }),

      deleteSet: (id) =>
        set((state) => ({ sets: state.sets.filter((s) => s.id !== id) })),
    }),
    { name: "infertune-question-sets", version: 1 }
  )
);
