import { invoke } from "@tauri-apps/api/core";
import type { GpuStats, HardwareStats } from "../store/useAppStore";
import { bytesToGb } from "../utils/format";

export interface SamplerResult {
  cpu: number;
  ramGb: number;
  gpu: number;
  vramGb: number;
  tempC: number;
  avgPowerW: number;
  peakPowerW: number;
}

/**
 * Samples CPU / RAM / GPU / VRAM / temperature / power while something runs
 * and keeps the peaks (and the average power). Call stop() for the result.
 */
export function startSampler(gpuId: number, intervalMs = 700) {
  const peak = { cpu: 0, ramGb: 0, gpu: 0, vramGb: 0, tempC: 0, peakPowerW: 0 };
  let powerSum = 0;
  let powerSamples = 0;
  let busy = false;

  const sample = async () => {
    if (busy) return;
    busy = true;

    try {
      const system = await invoke<HardwareStats>("get_system_stats");
      const gpu = await invoke<GpuStats>("get_gpu_stats", { id: gpuId });

      peak.cpu = Math.max(peak.cpu, system.cpu_usage);
      peak.ramGb = Math.max(peak.ramGb, bytesToGb(system.ram_used));
      peak.gpu = Math.max(peak.gpu, gpu.usage);
      peak.vramGb = Math.max(peak.vramGb, bytesToGb(gpu.memory_used));
      peak.tempC = Math.max(peak.tempC, gpu.temperature);

      if (gpu.power_watts > 0) {
        peak.peakPowerW = Math.max(peak.peakPowerW, gpu.power_watts);
        powerSum += gpu.power_watts;
        powerSamples += 1;
      }
    } catch {
      // A missed sample is fine.
    } finally {
      busy = false;
    }
  };

  sample();
  const timer = setInterval(sample, intervalMs);

  return {
    stop: (): SamplerResult => {
      clearInterval(timer);

      return {
        ...peak,
        avgPowerW: powerSamples > 0 ? powerSum / powerSamples : 0,
      };
    },
  };
}
