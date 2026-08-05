import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";


interface GPU {
    id: number;
    name: string;
    vendor: string;
}


export default function GpuSelector() {

    const [gpus, setGpus] = useState<GPU[]>([]);

    const {
        selectedGpu,
        setSelectedGpu,
        setSelectedGpuInfo
    } = useAppStore();


    useEffect(() => {

        invoke<GPU[]>("get_all_gpus")
            .then((data) => {

                setGpus(data);

                if (data.length > 0) {

                    setSelectedGpu(data[0].id);

                    setSelectedGpuInfo(
                        data[0].name,
                        data[0].vendor
                    );

                }

            });

    }, []);



    return (

        <div className="bg-gray-900 rounded-xl p-4">

            <h3 className="font-semibold mb-3">
                GPU Selection
            </h3>


            {
                gpus.map((gpu) => (

                    <button
                        key={gpu.id}
                        onClick={() => {
                            setSelectedGpu(gpu.id);

                            setSelectedGpuInfo(
                                gpu.name,
                                gpu.vendor
                            );
                        }}
                        className={
                            `w-full text-left p-3 rounded-lg mb-2
                        ${selectedGpu === gpu.id
                                ? "bg-blue-600"
                                : "bg-gray-800"
                            }`
                        }
                    >

                        <div>
                            {gpu.name}
                        </div>

                        <div className="text-sm text-gray-400">
                            {gpu.vendor}
                        </div>


                    </button>

                ))
            }


        </div>

    );

}