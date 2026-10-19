export interface GenerateRequest {
    model: string;

    systemPrompt: string;
    userPrompt: string;

    temperature: number;
    topP: number;
    topK: number;

    maxTokens: number;
    seed: number;
    contextLength: number;
}


export interface GenerateResponse {
    text: string;
    tokens: number;
    generationTime: number;
}