import { create } from "zustand";


export interface ModelRanking {
    name: string;
    family: string;
    purpose: string;
    size_gb: number;
    score: number;
    reasons: string[];
}


interface ModelState {

    rankings: ModelRanking[];

    setRankings: (models: ModelRanking[]) => void;

    clearRankings: () => void;
}


export const useModelStore = create<ModelState>((set) => ({

    rankings: [],


    setRankings: (models) =>
        set({
            rankings: models
        }),


    clearRankings: () =>
        set({
            rankings: []
        }),

}));