import { Cpu, MemoryStick, Clock3, Monitor } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";


export default function Header() {

  const {
    model,
    hardware,
    gpuStats
  } = useAppStore();

  const [ollamaOnline, setOllamaOnline] = useState(false);

  useEffect(() => {

    const updateStats = async () => {

      try {

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
      2000
    );


    return () => clearInterval(interval);

  }, []);


  const ramPercentage =
    hardware.ram_total > 0
      ? ((hardware.ram_used / hardware.ram_total) * 100).toFixed(1)
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

          <span className="text-gray-500">
            {gpuStats.backend}
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