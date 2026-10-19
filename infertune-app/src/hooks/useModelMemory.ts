import { useEffect, useState } from "react";
import { getModelContextLimit, getModelRankings } from "../services/modelService";
import { useAppStore } from "../store/useAppStore";
import { useActiveProfile } from "../store/settingsStore";
import { toConfig } from "../types/provider";
import {
  buildMemoryModel,
  suggestContext,
  type MemoryModel,
} from "../utils/memory";
import { bytesToGb } from "../utils/format";

const PROBE_A = 4096;
const PROBE_B = 8192;

export interface ModelMemory {
  memory: MemoryModel | null;
  /** Largest context supported by the model, when the server reports it. */
  limit: number | null;
  /** Largest context that still fits fully on the GPU. */
  suggested: number | null;
}

/**
 * Memory needs of one model as a function of context length.
 * Asks the backend for two estimates and extrapolates between them.
 */
export function useModelMemory(model: string): ModelMemory {
  const profile = useActiveProfile();
  const online = useAppStore((s) => s.providerOnline);
  const ramTotal = useAppStore((s) => s.hardware.ram_total);
  const gpuTotal = useAppStore((s) => s.gpuStats.memory_total);
  const vendor = useAppStore((s) => s.gpuStats.vendor);

  const [state, setState] = useState<ModelMemory>({
    memory: null,
    limit: null,
    suggested: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (!model || !online) {
      setState({ memory: null, limit: null, suggested: null });
      return;
    }

    const provider = toConfig(profile);

    (async () => {
      try {
        const [a, b, limit] = await Promise.all([
          getModelRankings(ramTotal, gpuTotal, vendor, "general", PROBE_A, provider),
          getModelRankings(ramTotal, gpuTotal, vendor, "general", PROBE_B, provider),
          getModelContextLimit(model, provider),
        ]);

        const at4k = a.find((m) => m.name === model);
        const at8k = b.find((m) => m.name === model);

        if (cancelled) return;

        if (!at4k || !at8k) {
          setState({ memory: null, limit, suggested: null });
          return;
        }

        const memory = buildMemoryModel(
          { context: PROBE_A, vramGb: at4k.estimated_vram_gb, ramGb: at4k.estimated_ram_gb },
          { context: PROBE_B, vramGb: at8k.estimated_vram_gb, ramGb: at8k.estimated_ram_gb }
        );

        setState({
          memory,
          limit,
          suggested: suggestContext(memory, bytesToGb(gpuTotal), limit),
        });
      } catch {
        if (!cancelled) setState({ memory: null, limit: null, suggested: null });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-run only when the model, server or hardware really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    model,
    online,
    profile.id,
    profile.kind,
    profile.baseUrl,
    profile.apiKey,
    ramTotal,
    gpuTotal,
    vendor,
  ]);

  return state;
}
