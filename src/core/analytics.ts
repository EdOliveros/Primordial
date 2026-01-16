export interface PopulationSnap {
    timestamp: number;
    counts: Record<number, number>;
}

export class Analytics {
    public history: PopulationSnap[] = [];
    private readonly MAX_HISTORY = 200;

    record(counts: Record<number, number>) {
        this.history.push({
            timestamp: Date.now(),
            counts: { ...counts }
        });

        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }
    }

    /**
     * Estimates predator (High Aggressiveness) vs Prey (High Photosynthesis) balance.
     * This approximates the state for Lotka-Volterra logic.
     */
    getGlobalStats(engineCells: number, avgAgg: number) {
        return {
            totalPopulation: engineCells,
            predatorPressure: avgAgg,
            preyBase: 1.0 - avgAgg // Simplified inverse
        };
    }
}
