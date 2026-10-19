import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  useAppStore,
  type GpuStats,
  type HardwareStats,
} from "../store/useAppStore";
import { useSettingsStore } from "../store/settingsStore";
import { logger, errorMessage } from "../store/logStore";

/**
 * Keeps CPU / RAM / GPU / VRAM numbers fresh for every page.
 * Mount once at the top of the app.
 */
export function useHardwarePolling() {
  const intervalMs = useSettingsStore((s) => s.pollIntervalMs);
  const selectedGpu = useAppStore((s) => s.selectedGpu);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let failures = 0;

    const tick = async () => {
      // Skip a beat instead of piling up requests if a probe is slow.
      if (busy) return;
      busy = true;

      try {
        const system = await invoke<HardwareStats>("get_system_stats");
        const graphics = await invoke<GpuStats>("get_gpu_stats", {
          id: selectedGpu,
        });

        if (!cancelled) {
          const { setHardware, setGpuStats } = useAppStore.getState();
          setHardware(system);
          setGpuStats(graphics);
          failures = 0;
        }
      } catch (error) {
        failures += 1;

        // Log the first failure only, so the log is not flooded.
        if (failures === 1) {
          logger.error("hardware", errorMessage(error));
        }
      } finally {
        busy = false;
      }
    };

    tick();

    const timer = setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs, selectedGpu]);
}
