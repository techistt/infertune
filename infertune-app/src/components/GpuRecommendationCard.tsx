import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";


interface Recommendation {

    recommended_gpu: number;
    gpu_name: string;
    vendor: string;
    backend: string;
    vram_total: number;
    vram_used: number;
    score: number;
    reason: string;

}


export default function GpuRecommendationCard() {

    const [recommendation, setRecommendation]
        = useState<Recommendation | null>(null);



    useEffect(() => {


        const load = async () => {

            try {

                const result =
                    await invoke<Recommendation>(
                        "recommend_gpu"
                    );


                setRecommendation(result);


            }
            catch (error) {

                console.error(
                    "GPU recommendation failed:",
                    error
                );

            }

        };


        load();


    }, []);



    return (

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">


            <h2 className="text-lg font-semibold mb-4">
                GPU Recommendation
            </h2>


            {
                recommendation ? (

                    <div className="space-y-2">


                        <p>
                            <span className="text-gray-400">
                                GPU:
                            </span>

                            {" "}
                            {recommendation.gpu_name}
                        </p>


                        <p>
                            <span className="text-gray-400">
                                Vendor:
                            </span>

                            {" "}
                            {recommendation.vendor}
                        </p>


                        <p>
                            <span className="text-gray-400">
                                Backend:
                            </span>

                            {" "}
                            {recommendation.backend}
                        </p>

                        <p>
                            <span className="text-gray-400">
                                VRAM:
                            </span>

                            {" "}

                            {(recommendation.vram_used / 1024 / 1024 / 1024).toFixed(1)}
                            /
                            {(recommendation.vram_total / 1024 / 1024 / 1024).toFixed(1)}
                            GB
                        </p>


                        <p>
                            <span className="text-gray-400">
                                Score:
                            </span>

                            {" "}
                            {recommendation.score}/100
                        </p>


                        <p className="text-sm text-gray-400">
                            {recommendation.reason}
                        </p>


                    </div>


                ) : (

                    <p className="text-gray-400">
                        Analyzing GPUs...
                    </p>

                )
            }


        </div>

    );

}