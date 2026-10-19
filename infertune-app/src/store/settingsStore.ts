import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProviderProfile } from "../types/provider";
import { toConfig } from "../types/provider";

export const DEFAULT_PROVIDER: ProviderProfile = {
  id: "ollama-default",
  name: "Ollama",
  preset: "ollama",
  kind: "ollama",
  baseUrl: "http://localhost:11434",
  apiKey: "",
};

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface SettingsState {
  providers: ProviderProfile[];
  activeProviderId: string;
  pollIntervalMs: number;

  addProvider: (profile: Omit<ProviderProfile, "id">) => string;
  updateProvider: (id: string, patch: Partial<Omit<ProviderProfile, "id">>) => void;
  removeProvider: (id: string) => void;
  setActiveProvider: (id: string) => void;
  setPollInterval: (ms: number) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      providers: [DEFAULT_PROVIDER],
      activeProviderId: DEFAULT_PROVIDER.id,
      pollIntervalMs: 2000,

      addProvider: (profile) => {
        const id = newId();

        set((state) => ({
          providers: [...state.providers, { ...profile, id }],
        }));

        return id;
      },

      updateProvider: (id, patch) =>
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        })),

      removeProvider: (id) => {
        const remaining = get().providers.filter((p) => p.id !== id);

        // Always keep at least one server configured.
        if (remaining.length === 0) {
          return;
        }

        set((state) => ({
          providers: remaining,
          activeProviderId:
            state.activeProviderId === id
              ? remaining[0].id
              : state.activeProviderId,
        }));
      },

      setActiveProvider: (id) => set({ activeProviderId: id }),

      setPollInterval: (pollIntervalMs) => set({ pollIntervalMs }),

      resetSettings: () =>
        set({
          providers: [DEFAULT_PROVIDER],
          activeProviderId: DEFAULT_PROVIDER.id,
          pollIntervalMs: 2000,
        }),
    }),
    { name: "infertune-settings", version: 1 }
  )
);

/** The server currently in use (always defined). */
export function getActiveProfile(): ProviderProfile {
  const { providers, activeProviderId } = useSettingsStore.getState();

  return (
    providers.find((p) => p.id === activeProviderId) ??
    providers[0] ??
    DEFAULT_PROVIDER
  );
}

export function getActiveConfig() {
  return toConfig(getActiveProfile());
}

/** React hook version of getActiveProfile. */
export function useActiveProfile(): ProviderProfile {
  const providers = useSettingsStore((s) => s.providers);
  const activeId = useSettingsStore((s) => s.activeProviderId);

  return providers.find((p) => p.id === activeId) ?? providers[0] ?? DEFAULT_PROVIDER;
}
