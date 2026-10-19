import { Cpu, MemoryStick, Monitor, Server } from "lucide-react";
import { useAppStore, type Page } from "../store/useAppStore";
import { useActiveProfile } from "../store/settingsStore";

const TITLES: Record<Page, string> = {
  dashboard: "Dashboard",
  playground: "Playground",
  models: "Models",
  benchmarks: "Benchmarks",
  compare: "Compare",
  sessions: "Sessions",
  logs: "Logs",
  settings: "Settings",
};

export default function Header() {
  const page = useAppStore((s) => s.page);
  const model = useAppStore((s) => s.model);
  const hardware = useAppStore((s) => s.hardware);
  const gpuStats = useAppStore((s) => s.gpuStats);
  const online = useAppStore((s) => s.providerOnline);
  const setPage = useAppStore((s) => s.setPage);

  const provider = useActiveProfile();

  const ramPercentage =
    hardware.ram_total > 0
      ? ((hardware.ram_used / hardware.ram_total) * 100).toFixed(1)
      : "0";

  return (
    <header className="h-16 shrink-0 border-b border-gray-800 bg-gray-900 px-6 flex items-center justify-between gap-4">

      <div className="min-w-0">
        <h2 className="text-lg font-semibold">
          {TITLES[page]}
        </h2>

        <p className="text-sm text-gray-400 truncate">
          Active model: {model || "none selected"}
        </p>
      </div>


      <div className="flex items-center gap-6 text-sm text-gray-300">

        <div className="flex items-center gap-2">
          <Cpu size={18} />
          <span>
            CPU {hardware.cpu_usage.toFixed(1)}%
          </span>
        </div>


        <div className="flex items-center gap-2">
          <MemoryStick size={18} />
          <span>
            RAM {ramPercentage}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Monitor size={18} />

          <span>
            GPU {gpuStats.usage}%
          </span>

          <span className="text-gray-500">
            {gpuStats.temperature}°C
          </span>

          <span className="text-gray-500 hidden xl:inline">
            {gpuStats.backend}
          </span>
        </div>

        <button
          onClick={() => setPage("settings")}
          title="Change server in Settings"
          className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-800 transition"
        >
          <Server size={18} />

          <span
            className={`inline-block h-2 w-2 rounded-full ${
              online ? "bg-green-500" : "bg-red-500"
            }`}
          />

          <span>
            {provider.name} {online ? "online" : "offline"}
          </span>
        </button>

      </div>

    </header>
  );
}
