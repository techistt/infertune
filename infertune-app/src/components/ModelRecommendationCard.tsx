import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";
import { useActiveProfile } from "../store/settingsStore";
import { toConfig } from "../types/provider";
import { getModelRankings } from "../services/modelService";
import { logger, errorMessage } from "../store/logStore";

interface Recommendation {
    recommended_model: string;
    category: string;
    reason: string;
    score: number;
}


export default function ModelRecommendationCard() {

    const gpuMemory = useAppStore((s) => s.gpuStats.memory_total);
    const vendor = useAppStore((s) => s.gpuStats.vendor);
    const ramTotal = useAppStore((s) => s.hardware.ram_total);
    const contextLength = useAppStore((s) => s.contextLength);
    const setRankings = useAppStore((s) => s.setRankings);
    const setModel = useAppStore((s) => s.setModel);
    const setPage = useAppStore((s) => s.setPage);

    const profile = useActiveProfile();

    const [recommendation, setRecommendation]
        = useState<Recommendation | null>(null);


    // Only the values that really change the answer are dependencies, so the
    // list is not recomputed on every hardware poll.
    useEffect(() => {

        let cancelled = false;

        const loadRecommendation = async () => {

            const provider = toConfig(profile);

            try {

                const result =
                    await invoke<Recommendation>(
                        "recommend_model",
                        {
                            ramTotal,
                            gpuMemory,
                            vendor,
                            task: "chat",
                            context: contextLength,
                            provider
                        }
                    );

                const rankingResult =
                    await getModelRankings(
                        ramTotal,
                        gpuMemory,
                        vendor,
                        "chat",
                        contextLength,
                        provider
                    );

                if (!cancelled) {
                    setRecommendation(result);
                    setRankings(rankingResult);
                }

            }
            catch (error) {
                logger.error("recommendation", errorMessage(error));
            }

        };

        loadRecommendation();

        return () => {
            cancelled = true;
        };

    }, [
        ramTotal,
        gpuMemory,
        vendor,
        contextLength,
        profile.id,
        profile.kind,
        profile.baseUrl,
        profile.apiKey
    ]);


    const hasModel =
        recommendation !== null &&
        recommendation.recommended_model !== "None";

    return (

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 h-full overflow-hidden">

            <h2 className="text-lg font-semibold mb-4">
                Model Recommendation
            </h2>

            {
                recommendation ? (

                    <div className="space-y-3">

                        <div>
                            <p className="text-gray-400 text-sm">
                                Recommended Model
                            </p>

                            <p className="text-lg font-semibold break-all">
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

                            <p className="whitespace-pre-line text-sm">
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

                        {
                            hasModel && (
                                <button
                                    onClick={() => {
                                        setModel(recommendation.recommended_model);
                                        setPage("playground");
                                    }}
                                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm hover:bg-blue-700 transition"
                                >
                                    Use in Playground
                                </button>
                            )
                        }

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
