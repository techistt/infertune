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
  /** Highest GPU temperature seen, in °C (missing in older results). */
  peakTempC?: number;
  /** Average and highest GPU power draw in watts (NVIDIA only). */
  avgPowerW?: number;
  peakPowerW?: number;
}

export interface QualityRun {
  id: string;
  createdAt: number;
  providerName: string;
  model: string;
  correct: number;
  total: number;
  percent: number;
  byCategory: { category: string; correct: number; total: number }[];
  answers: {
    id: string;
    category: string;
    prompt: string;
    expected: string;
    answer: string;
    correct: boolean;
  }[];
  avgTokensPerSecond: number;
}

const MAX_QUALITY = 50;
const MAX_SESSIONS = 200;
const MAX_BENCHMARKS = 100;

export function newRecordId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface HistoryState {
  sessions: SessionRecord[];
  benchmarks: BenchmarkResult[];
  qualityRuns: QualityRun[];

  addSession: (session: SessionRecord) => void;
  deleteSession: (id: string) => void;
  clearSessions: () => void;

  addBenchmark: (result: BenchmarkResult) => void;
  deleteBenchmark: (id: string) => void;
  clearBenchmarks: () => void;

  addQualityRun: (run: QualityRun) => void;
  deleteQualityRun: (id: string) => void;
  clearQualityRuns: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      sessions: [],
      benchmarks: [],
      qualityRuns: [],

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

      addQualityRun: (run) =>
        set((state) => ({
          qualityRuns: [run, ...(state.qualityRuns ?? [])].slice(0, MAX_QUALITY),
        })),

      deleteQualityRun: (id) =>
        set((state) => ({
          qualityRuns: (state.qualityRuns ?? []).filter((r) => r.id !== id),
        })),

      clearQualityRuns: () => set({ qualityRuns: [] }),
    }),
    { name: "infertune-history", version: 1 }
  )
);
