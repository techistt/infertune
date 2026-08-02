import { create } from "zustand";

interface AppState {
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  seed: number;

  systemPrompt: string;
  userPrompt: string;

  response: string;
  tokens: number;
  generationTime: number;
  tokensPerSecond: number;

  setModel: (value: string) => void;
  setTemperature: (value: number) => void;
  setTopP: (value: number) => void;
  setTopK: (value: number) => void;
  setMaxTokens: (value: number) => void;
  setSeed: (value: number) => void;

  setSystemPrompt: (value: string) => void;
  setUserPrompt: (value: string) => void;

  setResponse: (value: string) => void;

  setMetrics: (
    tokens: number,
    generationTime: number
  ) => void;
}

export const useAppStore = create<AppState>((set) => ({
  model: "hermes3:latest",
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxTokens: 1024,
  seed: 42,

  systemPrompt: "You are a helpful AI assistant.",
  userPrompt: "",

  response: "",
  tokens: 0,
  generationTime: 0,
  tokensPerSecond: 0,

  setModel: (model) => set({ model }),
  setTemperature: (temperature) => set({ temperature }),
  setTopP: (topP) => set({ topP }),
  setTopK: (topK) => set({ topK }),
  setMaxTokens: (maxTokens) => set({ maxTokens }),
  setSeed: (seed) => set({ seed }),

  setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
  setUserPrompt: (userPrompt) => set({ userPrompt }),

  setResponse: (response) => set({ response }),

  setMetrics: (
    tokens,
    generationTime
  ) =>
    set({
      tokens,
      generationTime,
      tokensPerSecond:
        generationTime > 0
          ? Number(
            (
              tokens /
              (generationTime / 1000)
            ).toFixed(2)
          )
          : 0,
    }),

}));
