import { Cpu, MemoryStick, Monitor, Thermometer } from "lucide-react";
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


export default function HardwareMonitor() {

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

        const update = async () => {

            try {

                const system =
                    await invoke<SystemStats>(
                        "get_system_stats"
                    );


                const graphics =
                    await invoke<GpuStats>(
                        "get_gpu_stats"
                    );


                setStats(system);
                setGpu(graphics);


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


    }, []);


    const ramGB =
        (stats.ram_used / 1024 / 1024 / 1024)
            .toFixed(1);


    const totalRamGB =
        (stats.ram_total / 1024 / 1024 / 1024)
            .toFixed(1);


    return (

        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-4">

            <h3 className="font-semibold text-lg">
                Hardware Monitor
            </h3>


            <div className="flex items-center gap-3">
                <Cpu size={18} />

                <span>
                    CPU {stats.cpu_usage.toFixed(1)}%
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
                        {gpu.name.replace(
                            "NVIDIA GeForce ",
                            ""
                        )}
                    </span>

                </div>


                <p className="text-sm text-gray-400 mt-2">
                    GPU Load: {gpu.usage}%
                </p>


                <p className="text-sm text-gray-400">
                    VRAM:
                    {" "}
                    {(gpu.memory_used / 1024 / 1024 / 1024).toFixed(1)}
                    /
                    {(gpu.memory_total / 1024 / 1024 / 1024).toFixed(1)}
                    GB
                </p>


                <p className="text-sm text-gray-400 flex items-center gap-2">
                    <Thermometer size={16} />
                    {gpu.temperature}°C
                </p>


            </div>


        </div>

    );

}