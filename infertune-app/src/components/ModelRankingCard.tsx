import { useAppStore } from "../store/useAppStore";


export default function ModelRankingCard() {

    const {
        rankings
    } = useAppStore();


    return (

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 h-full overflow-hidden">

            <h2 className="text-lg font-semibold mb-4">
                Model Rankings
            </h2>


            {
                rankings.length > 0 ? (

                    <div className="space-y-3 overflow-y-auto max-h-96">

                        {
                            rankings.map((model, index) => (

                                <div
                                    key={model.name}
                                    className="rounded-lg border border-gray-700 p-3"
                                >

                                    <div className="flex justify-between">

                                        <p className="font-semibold">
                                            #{index + 1} {model.name}
                                        </p>


                                        <p>
                                            {model.score}
                                        </p>

                                    </div>


                                    <p className="text-sm text-gray-400">
                                        {model.family} • {model.purpose}
                                    </p>


                                    <p className="text-sm">
                                        {model.size_gb.toFixed(2)} GB
                                    </p>


                                    <div className="mt-2 text-sm text-gray-400">

                                        {
                                            model.reasons.map(
                                                (reason, i) => (
                                                    <p key={i}>
                                                        ✓ {reason}
                                                    </p>
                                                )
                                            )
                                        }

                                    </div>


                                </div>

                            ))
                        }

                    </div>

                ) : (

                    <p className="text-gray-400">
                        No rankings available
                    </p>

                )
            }


        </div>

    );
}