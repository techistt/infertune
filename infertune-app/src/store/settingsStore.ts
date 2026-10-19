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

export const DEFAULT_API_PORT = 11500;

/** A usable TCP port; anything else falls back to the default. */
export function clampPort(port: number): number {
  const n = Math.round(port);

  return Number.isFinite(n) && n >= 1024 && n <= 65535 ? n : DEFAULT_API_PORT;
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface SettingsState {
  providers: ProviderProfile[];
  activeProviderId: string;
  pollIntervalMs: number;
  /** Desktop notification when long jobs finish (window not focused). */
  notificationsEnabled: boolean;
  /** Closing the window hides it to the tray instead of quitting. */
  closeToTray: boolean;
  apiPort: number;
  /** Optional bearer token required by the local API server. */
  apiToken: string;

  addProvider: (profile: Omit<ProviderProfile, "id">) => string;
  updateProvider: (id: string, patch: Partial<Omit<ProviderProfile, "id">>) => void;
  removeProvider: (id: string) => void;
  setActiveProvider: (id: string) => void;
  setPollInterval: (ms: number) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setCloseToTray: (enabled: boolean) => void;
  setApiPort: (port: number) => void;
  setApiToken: (token: string) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      providers: [DEFAULT_PROVIDER],
      activeProviderId: DEFAULT_PROVIDER.id,
      pollIntervalMs: 2000,
      notificationsEnabled: true,
      closeToTray: false,
      apiPort: DEFAULT_API_PORT,
      apiToken: "",

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

      setNotificationsEnabled: (notificationsEnabled) =>
        set({ notificationsEnabled }),

      setCloseToTray: (closeToTray) => set({ closeToTray }),

      setApiPort: (apiPort) => set({ apiPort: clampPort(apiPort) }),

      setApiToken: (apiToken) => set({ apiToken }),

      resetSettings: () =>
        set({
          providers: [DEFAULT_PROVIDER],
          activeProviderId: DEFAULT_PROVIDER.id,
          pollIntervalMs: 2000,
          notificationsEnabled: true,
          closeToTray: false,
          apiPort: DEFAULT_API_PORT,
          apiToken: "",
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
