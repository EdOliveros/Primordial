/**
 * CellStorage implements a Struct-of-Arrays (SoA) data structure for high-performance
 * processing of massive numbers of cells.
 * 
 * Memory Layout (Float32Array):
 * - positions: [x1, y1, x2, y2, ...]
 * - velocities: [vx1, vy1, vx2, vy2, ...]
 * - genomes: [g1_1, g1_2, ... g1_8, g2_1, ...] (8 genes per cell)
 * - stats: [health1, age1, health2, age2, ...]
 */
export class CellStorage {
    public readonly maxCells: number;

    // Position Buffer (2 floats per cell: x, y)
    public positions: Float32Array;
    // Velocity Buffer (2 floats per cell: vx, vy)
    public velocities: Float32Array;
    // Genome Buffer (8 floats per cell: Speed, Aggressiveness, Photosynthesis, Size, Defense, Vision, Mutability, Lifespan)
    public genomes: Float32Array;
    // Stats Buffer (4 floats per cell: Health, Energy, Age, Metadata)
    public stats: Float32Array;
    // Generation Buffer (Uint32)
    public generations: Uint32Array;
    // Active Flag Buffer (1 byte per cell)
    public isActive: Uint8Array;
    // Visual Color Buffer (4 floats per cell: R, G, B, Glow)
    public visualColors: Float32Array;
    // Archetype Buffer (1 byte per cell: 0=Avg, 1=Pred, 2=Prod, 3=Tank, 4=Speed)
    public archetypes: Uint8Array;

    public activeCount: number = 0;
    private freeIndices: number[] = [];

    // Global Physics Params
    public friction: number = 0.98;
    public globalMutationRate: number = 1.0;

    constructor(maxCells: number) {
        this.maxCells = maxCells;
        this.positions = new Float32Array(maxCells * 2);
        this.velocities = new Float32Array(maxCells * 2);
        this.genomes = new Float32Array(maxCells * 8);
        this.stats = new Float32Array(maxCells * 4);
        this.generations = new Uint32Array(maxCells);
        this.isActive = new Uint8Array(maxCells);
        this.visualColors = new Float32Array(maxCells * 4);
        this.archetypes = new Uint8Array(maxCells);
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
        const pIdx = idx * 2;
        const gIdx = idx * 8;
        const sIdx = idx * 4;

        this.positions[pIdx] = x;
        this.positions[pIdx + 1] = y;
        this.velocities[pIdx] = 0;
        this.velocities[pIdx + 1] = 0;

        for (let i = 0; i < 8; i++) {
            this.genomes[gIdx + i] = genome[i];
        }

        this.stats[sIdx] = 100.0;     // Health
        this.stats[sIdx + 1] = 100.0; // Energy
        this.stats[sIdx + 2] = 0.0;   // Age
        this.stats[sIdx + 3] = 0.0;   // Metadata
        this.generations[idx] = 1;

        this.isActive[idx] = 1;
        this.activeCount++;

        // Calculate Visual Class Color
        const cIdx = idx * 4;
        const aggressiveness = genome[1];
        const photosynthesis = genome[2];
        const defense = genome[4];
        const speed = genome[0];

        // Default Gray
        let r = 0.4, g = 0.4, b = 0.4, glow = 0.0;

        // Determine dominant class (> 0.7)
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
        this.archetypes[idx] = archIdx;

        return idx;
    }

    remove(idx: number) {
        if (idx < 0 || idx >= this.maxCells || this.isActive[idx] === 0) return;
        this.isActive[idx] = 0;
        this.freeIndices.push(idx);
        this.activeCount--;
    }

    getEnergy(idx: number): number { return this.stats[idx * 4 + 1]; }
    setEnergy(idx: number, val: number) { this.stats[idx * 4 + 1] = val; }
    getGenome(idx: number): Float32Array { return this.genomes.subarray(idx * 8, idx * 8 + 8); }

    reproduce(parentIdx: number): number {
        const parentGenome = this.getGenome(parentIdx);
        const childGenome = new Float32Array(8);
        const mutability = parentGenome[6];

        for (let i = 0; i < 8; i++) {
            const mutation = (Math.random() * 2 - 1) * mutability * 0.1 * this.globalMutationRate;
            childGenome[i] = Math.max(0, Math.min(1, parentGenome[i] + mutation));
        }

        const x = this.getX(parentIdx) + (Math.random() * 10 - 5);
        const y = this.getY(parentIdx) + (Math.random() * 10 - 5);

        const childIdx = this.spawn(x, y, childGenome);
        if (childIdx !== -1) {
            this.generations[childIdx] = this.generations[parentIdx] + 1;
        }
        return childIdx;
    }

    /**
     * Efficiently get the X position of a cell.
     */
    getX(idx: number): number { return this.positions[idx * 2]; }
    /**
     * Efficiently get the Y position of a cell.
     */
    getY(idx: number): number { return this.positions[idx * 2 + 1]; }

    /**
     * Example of a batch update (Simulating movement)
     */
    updatePositions(dt: number) {
        for (let i = 0; i < this.maxCells; i++) {
            if (this.isActive[i]) {
                // Apply friction
                this.velocities[i * 2] *= this.friction;
                this.velocities[i * 2 + 1] *= this.friction;

                this.positions[i * 2] += this.velocities[i * 2] * dt;
                this.positions[i * 2 + 1] += this.velocities[i * 2 + 1] * dt;
            }
        }
    }
}
