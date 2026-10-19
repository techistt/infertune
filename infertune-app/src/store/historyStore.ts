import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SessionRecord {
  id: string;
  createdAt: number;
  providerName: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  response: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  seed: number;
  contextLength: number;
  tokens: number;
  generationTime: number;
  tokensPerSecond: number;
}

export interface BenchmarkRun {
  tokens: number;
  timeMs: number;
  tokensPerSecond: number;
}

export interface BenchmarkResult {
  id: string;
  createdAt: number;
  providerName: string;
  model: string;
  promptName: string;
  contextLength: number;
  maxTokens: number;
  runs: BenchmarkRun[];
  avgTokensPerSecond: number;
  avgTimeMs: number;
  avgTokens: number;
  peakCpu: number;
  peakRamGb: number;
  peakGpu: number;
  peakVramGb: number;
}

const MAX_SESSIONS = 200;
const MAX_BENCHMARKS = 100;

export function newRecordId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface HistoryState {
  sessions: SessionRecord[];
  benchmarks: BenchmarkResult[];

  addSession: (session: SessionRecord) => void;
  deleteSession: (id: string) => void;
  clearSessions: () => void;

  addBenchmark: (result: BenchmarkResult) => void;
  deleteBenchmark: (id: string) => void;
  clearBenchmarks: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      sessions: [],
      benchmarks: [],

      addSession: (session) =>
        set((state) => ({
          sessions: [session, ...state.sessions].slice(0, MAX_SESSIONS),
        })),

      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
        })),

      clearSessions: () => set({ sessions: [] }),

      addBenchmark: (result) =>
        set((state) => ({
          benchmarks: [result, ...state.benchmarks].slice(0, MAX_BENCHMARKS),
        })),

      deleteBenchmark: (id) =>
        set((state) => ({
          benchmarks: state.benchmarks.filter((b) => b.id !== id),
        })),

      clearBenchmarks: () => set({ benchmarks: [] }),
    }),
    { name: "infertune-history", version: 1 }
  )
);
