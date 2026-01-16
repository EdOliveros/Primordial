/**
 * CellStorage implements a single contiguous Float32Array (AoS) 
 * for maximum CPU cache performance.
 * 
 * Layout per Cell (16 floats stride):
 * 0: x, 1: y, 2: vx, 3: vy
 * 4: energy, 5: archIdx, 6: age, 7: speciesId/metadata
 * 8-15: genome (8 genes)
 */
export class CellStorage {
    public readonly maxCells: number;
    public readonly stride = 16;

    // One giant buffer for all data
    public dataBuffer: Float32Array;

    // Specialized buffers that remain separate for specific needs (Uint types)
    public generations: Uint32Array;
    public isActive: Uint8Array;
    public visualColors: Float32Array;

    public activeCount: number = 0;
    private freeIndices: number[] = [];

    // Global Physics Params
    public friction: number = 0.98;
    public globalMutationRate: number = 1.0;

    constructor(maxCells: number) {
        this.maxCells = maxCells;
        this.dataBuffer = new Float32Array(maxCells * this.stride);
        this.generations = new Uint32Array(maxCells);
        this.isActive = new Uint8Array(maxCells);
        this.visualColors = new Float32Array(maxCells * 4);

        for (let i = 0; i < maxCells; i++) {
            this.freeIndices.push(maxCells - 1 - i);
        }
    }

    /**
     * Spawns a new cell with the given position and genome.
     */
    spawn(x: number, y: number, genome: number[] | Float32Array): number {
        if (this.freeIndices.length === 0) return -1;

        const idx = this.freeIndices.pop()!;
        const offset = idx * this.stride;

        this.dataBuffer[offset] = x;
        this.dataBuffer[offset + 1] = y;
        this.dataBuffer[offset + 2] = 0; // vx
        this.dataBuffer[offset + 3] = 0; // vy

        this.dataBuffer[offset + 4] = 100.0; // Energy
        this.dataBuffer[offset + 6] = 0.0;   // Age

        for (let i = 0; i < 8; i++) {
            this.dataBuffer[offset + 8 + i] = genome[i];
        }

        this.generations[idx] = 1;
        this.isActive[idx] = 1;
        this.activeCount++;

        // Calculate Visual Class Color
        const cIdx = idx * 4;
        const aggressiveness = genome[1];
        const photosynthesis = genome[2];
        const defense = genome[4];
        const speed = genome[0];

        let r = 0.4, g = 0.4, b = 0.4, glow = 0.0;
        let maxVal = 0.7;
        let type = "average";
        let archIdx = 0;

        if (aggressiveness > maxVal) { maxVal = aggressiveness; type = "predator"; archIdx = 1; }
        if (photosynthesis > maxVal) { maxVal = photosynthesis; type = "producer"; archIdx = 2; }
        if (defense > maxVal) { maxVal = defense; type = "tank"; archIdx = 3; }
        if (speed > maxVal) { maxVal = speed; type = "speedster"; archIdx = 4; }

        if (type === "predator") { r = 1.0; g = 0.0; b = 0.2; glow = 1.0; }
        else if (type === "producer") { r = 0.2; g = 1.0; b = 0.0; glow = 1.0; }
        else if (type === "tank") { r = 0.0; g = 0.8; b = 1.0; glow = 1.0; }
        else if (type === "speedster") { r = 1.0; g = 1.0; b = 1.0; glow = 1.0; }

        this.visualColors[cIdx] = r;
        this.visualColors[cIdx + 1] = g;
        this.visualColors[cIdx + 2] = b;
        this.visualColors[cIdx + 3] = glow;

        this.dataBuffer[offset + 5] = archIdx;

        return idx;
    }

    remove(idx: number) {
        if (idx < 0 || idx >= this.maxCells || this.isActive[idx] === 0) return;
        this.isActive[idx] = 0;
        this.freeIndices.push(idx);
        this.activeCount--;
    }

    getEnergy(idx: number): number { return this.dataBuffer[idx * this.stride + 4]; }
    setEnergy(idx: number, val: number) { this.dataBuffer[idx * this.stride + 4] = val; }
    getGenome(idx: number): Float32Array {
        return this.dataBuffer.subarray(idx * this.stride + 8, idx * this.stride + 16);
    }

    reproduce(parentIdx: number): number {
        const offset = parentIdx * this.stride;
        const parentGenome = this.getGenome(parentIdx);
        const childGenome = new Float32Array(8);
        const mutability = parentGenome[6];

        for (let i = 0; i < 8; i++) {
            const mutation = (Math.random() * 2 - 1) * mutability * 0.1 * this.globalMutationRate;
            childGenome[i] = Math.max(0, Math.min(1, parentGenome[i] + mutation));
        }

        const x = this.dataBuffer[offset] + (Math.random() * 10 - 5);
        const y = this.dataBuffer[offset + 1] + (Math.random() * 10 - 5);

        const childIdx = this.spawn(x, y, childGenome);
        if (childIdx !== -1) {
            this.generations[childIdx] = this.generations[parentIdx] + 1;
        }
        return childIdx;
    }

    getX(idx: number): number { return this.dataBuffer[idx * this.stride]; }
    getY(idx: number): number { return this.dataBuffer[idx * this.stride + 1]; }

    updatePositions(dt: number) {
        for (let i = 0; i < this.maxCells; i++) {
            if (this.isActive[i]) {
                const offset = i * this.stride;
                // Apply friction
                this.dataBuffer[offset + 2] *= this.friction;
                this.dataBuffer[offset + 3] *= this.friction;

                this.dataBuffer[offset] += this.dataBuffer[offset + 2] * dt;
                this.dataBuffer[offset + 1] += this.dataBuffer[offset + 3] * dt;
            }
        }
    }
}
