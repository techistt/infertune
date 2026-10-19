import { create } from "zustand";

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  time: number;
  level: LogLevel;
  source: string;
  message: string;
}

const MAX_LOGS = 500;
let counter = 0;

interface LogState {
  entries: LogEntry[];
  add: (level: LogLevel, source: string, message: string) => void;
  clear: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],

  add: (level, source, message) =>
    set((state) => ({
      entries: [
        ...state.entries,
        { id: ++counter, time: Date.now(), level, source, message },
      ].slice(-MAX_LOGS),
    })),

  clear: () => set({ entries: [] }),
}));

/** Use anywhere (components, services, hooks) to write to the Logs page. */
export const logger = {
  info: (source: string, message: string) =>
    useLogStore.getState().add("info", source, message),

  warn: (source: string, message: string) =>
    useLogStore.getState().add("warn", source, message),

  error: (source: string, message: string) =>
    useLogStore.getState().add("error", source, message),
};

export function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
