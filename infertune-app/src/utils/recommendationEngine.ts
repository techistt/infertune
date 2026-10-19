interface RecommendationInput {

    gpuName: string;

    gpuVendor: string;

    vramGB: number;

    ramGB: number;

    model: string;

}

interface Recommendation {

    profile: string;

    temperature: number;

    maxTokens: number;

    contextSize: number;

    gpuOffload: string;

    reason: string;

}



export function generateRecommendation(
    input: RecommendationInput
): Recommendation {


    let recommendation: Recommendation = {

        profile: "Balanced",

        temperature: 0.7,

        maxTokens: 2048,

        contextSize: 4096,

        gpuOffload: "Auto",

        reason:
            "Balanced configuration.",

    };



    const model =
        input.model.toLowerCase();


    let modelClass = "small";


    if (
        model.includes("qwen") ||
        model.includes("coder") ||
        model.includes("70b") ||
        model.includes("34b")
    ) {

        modelClass = "large";

    }


    else if (
        model.includes("gemma") ||
        model.includes("13b") ||
        model.includes("14b")
    ) {

        modelClass = "medium";

    }



    if (
        input.gpuVendor === "NVIDIA"
    ) {

        recommendation.profile =
            "CUDA Optimized";

        recommendation.gpuOffload =
            "CUDA";

        recommendation.reason =
            "NVIDIA GPU detected. CUDA acceleration recommended.";

    }

    if (input.vramGB < 6) {

        recommendation.profile =
            "Memory Saver";

        recommendation.maxTokens =
            1024;

        recommendation.contextSize =
            2048;

        recommendation.reason =
            "Low VRAM detected. Reduced context and token limits recommended.";

    }


    else if (input.vramGB < 10) {

        recommendation.profile =
            "Balanced";

        recommendation.maxTokens =
            4096;

        recommendation.contextSize =
            4096;

        recommendation.reason =
            "Medium VRAM detected. Balanced performance settings.";

    }

    if (modelClass === "large") {

        recommendation.profile =
            "Large Model Safe Mode";


        recommendation.maxTokens =
            Math.min(
                recommendation.maxTokens,
                2048
            );


        recommendation.contextSize =
            2048;


        recommendation.reason =
            "Large model detected. Reduced context prevents memory pressure.";

    }



    if (modelClass === "medium") {

        recommendation.profile =
            "Medium Model Balanced";


        recommendation.contextSize =
            4096;


        recommendation.reason =
            "Medium model detected. Balanced context settings applied.";

    }


    else {

        recommendation.profile =
            "Performance";

        recommendation.maxTokens =
            8192;

        recommendation.contextSize =
            8192;

        recommendation.reason =
            "High VRAM detected. Performance settings enabled.";

    }


    if (
        input.ramGB < 16
    ) {

        recommendation.profile =
            "Memory Saver";

        recommendation.maxTokens =
            1024;

        recommendation.contextSize =
            2048;

        recommendation.reason =
            "Low system RAM detected.";

    }



    return recommendation;

}