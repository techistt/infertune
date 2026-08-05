import { Cpu, MemoryStick, Monitor, Thermometer } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

interface SystemStats {
    cpu_usage: number;
    ram_used: number;
    ram_total: number;
}


interface GpuStats {
    name: string;
    vendor: string;
    backend: string;
    usage: number;
    memory_used: number;
    memory_total: number;
    temperature: number;
}


export default function HardwareMonitor() {

    const {
        hardware,
        gpuStats,
        setHardware,
        setGpuStats,
        selectedGpu
    } = useAppStore();


    useEffect(() => {

        const update = async () => {

            try {

                const system =
                    await invoke<SystemStats>(
                        "get_system_stats"
                    );


                const graphics =
                    await invoke<GpuStats>(
                        "get_gpu_stats",
                        {
                            id: selectedGpu
                        }
                    );


                setHardware(system);
                setGpuStats(graphics);


            } catch (error) {

                console.error(
                    "Hardware monitor error:",
                    error
                );

            }

        };


        update();


        const interval =
            setInterval(update, 2000);


        return () =>
            clearInterval(interval);


    }, [selectedGpu]);


    const ramGB =
        (hardware.ram_used / 1024 / 1024 / 1024)
            .toFixed(1);


    const totalRamGB =
        (hardware.ram_total / 1024 / 1024 / 1024)
            .toFixed(1);


    return (

        <div className="space-y-4">

            <div className="flex items-center gap-3">
                <Cpu size={18} />

                <span>
                    CPU {hardware.cpu_usage.toFixed(1)}%
                </span>
            </div>


            <div className="flex items-center gap-3">
                <MemoryStick size={18} />

                <span>
                    RAM {ramGB}/{totalRamGB} GB
                </span>
            </div>


            <div className="border-t border-gray-800 pt-3">


                <div className="flex items-center gap-3">
                    <Monitor size={18} />

                    <span>
                        {gpuStats.name.replace(
                            "NVIDIA GeForce ",
                            ""
                        )}
                    </span>

                </div>


                <p className="text-sm text-gray-400 mt-2">
                    GPU Load: {gpuStats.usage}%
                </p>

                <p className="text-sm text-gray-400">
                    Backend: {gpuStats.backend}
                </p>


                <p className="text-sm text-gray-400">
                    VRAM:
                    {" "}
                    {(gpuStats.memory_used / 1024 / 1024 / 1024).toFixed(1)}
                    /
                    {(gpuStats.memory_total / 1024 / 1024 / 1024).toFixed(1)}
                    GB
                </p>


                <p className="text-sm text-gray-400 flex items-center gap-2">
                    <Thermometer size={16} />
                    {gpuStats.temperature}°C
                </p>


            </div>


        </div>

    );

}