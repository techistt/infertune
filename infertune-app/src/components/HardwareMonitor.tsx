import { Cpu, MemoryStick, Monitor, Thermometer } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { formatGb } from "../utils/format";
import Bar from "./Bar";

function percent(used: number, total: number): number {
  return total > 0 ? (used / total) * 100 : 0;
}

/** Live readout. The numbers come from the global polling hook. */
export default function HardwareMonitor() {
  const hardware = useAppStore((s) => s.hardware);
  const gpuStats = useAppStore((s) => s.gpuStats);

  const ramPercent = percent(hardware.ram_used, hardware.ram_total);
  const vramPercent = percent(gpuStats.memory_used, gpuStats.memory_total);

  return (
    <div className="space-y-4">

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-2">
            <Cpu size={18} /> CPU
          </span>
          <span>{hardware.cpu_usage.toFixed(1)}%</span>
        </div>
        <Bar percent={hardware.cpu_usage} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-2">
            <MemoryStick size={18} /> RAM
          </span>
          <span>
            {formatGb(hardware.ram_used)} / {formatGb(hardware.ram_total)}
          </span>
        </div>
        <Bar percent={ramPercent} />
      </div>

      <div className="border-t border-gray-800 pt-4 space-y-4">

        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 min-w-0">
            <Monitor size={18} className="shrink-0" />
            <span className="truncate">
              {gpuStats.name.replace("NVIDIA GeForce ", "")}
            </span>
          </span>

          <span className="flex items-center gap-1 text-sm text-gray-400 shrink-0">
            <Thermometer size={16} />
            {gpuStats.temperature}°C
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1 text-sm text-gray-300">
            <span>GPU load</span>
            <span>{gpuStats.usage}%</span>
          </div>
          <Bar percent={gpuStats.usage} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1 text-sm text-gray-300">
            <span>VRAM</span>
            <span>
              {formatGb(gpuStats.memory_used)} / {formatGb(gpuStats.memory_total)}
            </span>
          </div>
          <Bar percent={vramPercent} />
        </div>

        <p className="text-xs text-gray-500">
          {gpuStats.vendor} via {gpuStats.backend}
        </p>

      </div>

    </div>
  );
}
