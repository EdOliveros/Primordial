/**
 * SpeciesTracker handles clustering of cells into groups based on DNA similarity.
 */
export interface Species {
    id: number;
    representativeDNA: Float32Array;
    population: number;
    color: { r: number, g: number, b: number };
}

export class SpeciesTracker {
    public speciesList: Species[] = [];
    private nextId: number = 1;
    private readonly SIMILARITY_THRESHOLD = 0.05; // 95% similarity

    /**
     * Identifies the species for a given genome. 
     * If no existing species is close enough, it may create a new one.
     */
    identify(genome: Float32Array): number {
        let bestMatch = -1;
        let minDiff = Infinity;

        for (let i = 0; i < this.speciesList.length; i++) {
            const diff = this.calculateDifference(genome, this.speciesList[i].representativeDNA);
            if (diff < minDiff) {
                minDiff = diff;
                bestMatch = i;
            }
        }

        if (bestMatch !== -1 && minDiff < this.SIMILARITY_THRESHOLD) {
            this.speciesList[bestMatch].population++;
            return this.speciesList[bestMatch].id;
        }

        // Potential new species
        const newId = this.nextId++;
        this.speciesList.push({
            id: newId,
            representativeDNA: new Float32Array(genome),
            population: 1,
            color: this.dnaToColor(genome)
        });
        return newId;
    }

    private calculateDifference(dna1: Float32Array, dna2: Float32Array): number {
        let sumSq = 0;
        for (let i = 0; i < 8; i++) {
            sumSq += Math.pow(dna1[i] - dna2[i], 2);
        }
        // Normalized Euclidean distance
        return Math.sqrt(sumSq) / Math.sqrt(8);
    }

    private dnaToColor(dna: Float32Array) {
        // Rojo=Agresividad (dna[1]), Verde=Fotosíntesis (dna[2]), Azul=Defensa (dna[4])
        return {
            r: Math.floor(dna[1] * 255),
            g: Math.floor(dna[2] * 255),
            b: Math.floor(dna[4] * 255)
        };
    }

    resetCounts() {
        for (const s of this.speciesList) {
            s.population = 0;
        }
    }

    /**
     * Removes extinct species to keep the list efficient.
     */
    prune() {
        this.speciesList = this.speciesList.filter(s => s.population > 0);
    }

    getAliveSpecies() {
        // speciesList is already pruned to only those with population > 0
        return this.speciesList.map(s => ({
            id: s.id,
            name: `Species-${s.id}` // Generic name for now
        }));
    }
}
