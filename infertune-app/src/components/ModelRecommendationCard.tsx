import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";
import { getModelRankings } from "../services/modelService";

interface Recommendation {

    recommended_model: string;
    category: string;
    reason: string;
    score: number;

}


export default function ModelRecommendationCard() {

    const {
        gpuStats,
        hardware,
        contextLength
    } = useAppStore();


    const [recommendation, setRecommendation]
        = useState<Recommendation | null>(null);

    const { setRankings } = useAppStore();



    useEffect(() => {


        const loadRecommendation = async () => {


            try {


                const result =
                    await invoke<Recommendation>(
                        "recommend_model",
                        {

                            ramTotal:
                                hardware.ram_total,


                            gpuMemory:
                                gpuStats.memory_total,


                            vendor:
                                gpuStats.vendor,

                            task: "chat",

                            context: contextLength

                        }
                    );


                setRecommendation(result);

                const rankingResult =
                    await getModelRankings(
                        hardware.ram_total,
                        gpuStats.memory_total,
                        gpuStats.vendor,
                        "chat",
                        contextLength
                    );


                setRankings(rankingResult);

               

            }
            catch (error) {

                console.error(
                    "Recommendation error:",
                    error
                );

            }

        };


        loadRecommendation();


    }, [
        hardware.ram_total,
        gpuStats.memory_total,
        gpuStats.vendor,
        contextLength
    ]);



    return (

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 h-full overflow-hidden">


            <h2 className="text-lg font-semibold mb-4">
                Model Recommendations
            </h2>



            {
                recommendation ? (

                    <div className="space-y-3">


                        <div>

                            <p className="text-gray-400 text-sm">
                                Recommended Model
                            </p>


                            <p className="text-lg font-semibold">
                                {recommendation.recommended_model}
                            </p>

                        </div>



                        <div>

                            <p className="text-gray-400 text-sm">
                                Category
                            </p>


                            <p>
                                {recommendation.category}
                            </p>

                        </div>



                        <div>

                            <p className="text-gray-400 text-sm">
                                Reason
                            </p>


                            <p>
                                {recommendation.reason}
                            </p>

                        </div>



                        <div>

                            <p className="text-gray-400 text-sm">
                                Score
                            </p>


                            <p>
                                {recommendation.score} pts
                            </p>

                        </div>



                    </div>

                ) : (

                    <p className="text-gray-400">
                        Analyzing hardware...
                    </p>

                )
            }



        </div>

    );

}