import { Cpu, MemoryStick, Clock3, Monitor } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";


interface SystemStats {
  cpu_usage: number;
  ram_used: number;
  ram_total: number;
}

interface GpuStats {
  name: string;
  vendor: string;
  usage: number;
  memory_used: number;
  memory_total: number;
  temperature: number;
}

export default function Header() {

  const {
    model,
    selectedGpu
  } = useAppStore();

  const [ollamaOnline, setOllamaOnline] = useState(false);

  const [stats, setStats] = useState<SystemStats>({
    cpu_usage: 0,
    ram_used: 0,
    ram_total: 0,
  });

  const [gpu, setGpu] = useState<GpuStats>({
    name: "Unknown",
    vendor: "Unknown",
    usage: 0,
    memory_used: 0,
    memory_total: 0,
    temperature: 0,
  });


  useEffect(() => {

    const updateStats = async () => {

      try {

        const data = await invoke<SystemStats>(
          "get_system_stats"
        );

        setStats(data);


        const gpuData = await invoke<GpuStats>(
          "get_gpu_stats",
          {
            id: selectedGpu
          }
        );

        setGpu(gpuData);


        const ollamaStatus = await invoke<boolean>(
          "check_ollama_status"
        );

        setOllamaOnline(ollamaStatus);


      } catch (error) {

        console.error(
          "Monitoring update failed:",
          error
        );

      }

    };

    updateStats();

    const interval = setInterval(
      updateStats,
      3000
    );


    return () => clearInterval(interval);

  }, [selectedGpu]);


  const ramPercentage =
    stats.ram_total > 0
      ? ((stats.ram_used / stats.ram_total) * 100).toFixed(1)
      : "0";


  return (
    <header className="h-16 border-b border-gray-800 bg-gray-900 px-6 flex items-center justify-between">

      <div>
        <h2 className="text-lg font-semibold">
          Dashboard
        </h2>

        <p className="text-sm text-gray-400">
          Active Model: {model}
        </p>
      </div>


      <div className="flex items-center gap-6 text-sm text-gray-300">

        <div className="flex items-center gap-2">
          <Cpu size={18} />
          <span>
            CPU {stats.cpu_usage.toFixed(1)}%
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
            GPU {gpu.usage}%
          </span>

          <span className="text-gray-500">
            {gpu.temperature}°C
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Clock3 size={18} />

          <span>
            {ollamaOnline
              ? "Ollama Online"
              : "Ollama Offline"}
          </span>

        </div>

      </div>

    </header>
  );
}