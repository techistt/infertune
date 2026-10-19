import { create } from "zustand";

interface HardwareStats {
  cpu_usage: number;
  ram_used: number;
  ram_total: number;
}

interface GpuStats {
  name: string;
  vendor: string;
  usage: number;
  backend: string;
  memory_used: number;
  memory_total: number;
  temperature: number;
}

interface ModelRanking {
  name: string;
  family: string;
  purpose: string;
  size_gb: number;
  score: number;
  reasons: string[];
}

interface AppState {
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  seed: number;
  contextLength: number;

  systemPrompt: string;
  userPrompt: string;

  response: string;
  tokens: number;
  generationTime: number;
  tokensPerSecond: number;

  selectedGpu: number;
  selectedGpuName: string;
  selectedGpuVendor: string;

  setModel: (value: string) => void;
  setTemperature: (value: number) => void;
  setTopP: (value: number) => void;
  setTopK: (value: number) => void;
  setMaxTokens: (value: number) => void;
  setSeed: (value: number) => void;
  setContextLength: (value: number) => void;

  setSystemPrompt: (value: string) => void;
  setUserPrompt: (value: string) => void;

  setResponse: (value: string) => void;

  setMetrics: (
    tokens: number,
    generationTime: number
  ) => void;

  setSelectedGpu: (id: number) => void;

  setSelectedGpuInfo: (
    name: string,
    vendor: string
  ) => void;

  hardware: HardwareStats;

  gpuStats: GpuStats;

  setHardware: (
    stats: HardwareStats
  ) => void;

  setGpuStats: (
    stats: GpuStats
  ) => void;

  rankings: ModelRanking[];

  setRankings: (
    models: ModelRanking[]
  ) => void;
}

export const useAppStore = create<AppState>((set) => ({
  model: "hermes3:latest",
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxTokens: 1024,
  seed: 42,
  contextLength: 4096,

  systemPrompt: "You are a helpful AI assistant.",
  userPrompt: "",

  response: "",
  tokens: 0,
  generationTime: 0,
  tokensPerSecond: 0,

  selectedGpu: 0,

  selectedGpuName: "",
  selectedGpuVendor: "",

  hardware: {
    cpu_usage: 0,
    ram_used: 0,
    ram_total: 0,
  },

  gpuStats: {
    name: "Unknown",
    vendor: "Unknown",
    backend: "Unknown",
    usage: 0,
    memory_used: 0,
    memory_total: 0,
    temperature: 0,
  },

  rankings: [],

  setModel: (model) => set({ model }),
  setTemperature: (temperature) => set({ temperature }),
  setTopP: (topP) => set({ topP }),
  setTopK: (topK) => set({ topK }),
  setMaxTokens: (maxTokens) => set({ maxTokens }),
  setSeed: (seed) => set({ seed }),
  setContextLength: (contextLength) => set({ contextLength }),

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

  setSelectedGpu: (id) =>
    set({
      selectedGpu: id
    }),

  setSelectedGpuInfo: (name, vendor) =>
    set({
      selectedGpuName: name,
      selectedGpuVendor: vendor
    }),

  setHardware: (stats) =>
    set({
      hardware: stats
    }),


  setGpuStats: (stats) =>
    set({
      gpuStats: stats
    }),

  setRankings: (models) =>
    set({
      rankings: models
    }),

}));
