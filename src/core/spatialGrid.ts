/**
 * SpatialGrid implements 2D spatial hashing for fast neighbor lookups.
 * Using a 50x50 grid as requested.
 */
export class SpatialGrid {
    private grid: Int32Array; // Stores indices of cells
    private gridCount: Int32Array; // Stores number of cells in each grid cell
    private gridOffset: Int32Array; // Stores offset in the flat grid array

    private readonly resolution: number = 100; // 1000 / 100 = 10 cells (10x10 grid)
    private readonly worldSize: number;
    private readonly maxCells: number;

    constructor(worldSize: number, maxCells: number) {
        this.worldSize = worldSize;
        this.maxCells = maxCells;

        // A flat array to store all indices, partitioned by grid cells
        this.grid = new Int32Array(maxCells);
        this.gridCount = new Int32Array(this.resolution * this.resolution);
        this.gridOffset = new Int32Array(this.resolution * this.resolution);
    }

    /**
     * Rebuilds the grid based on current cell positions.
     */
    update(cells: Float32Array, isActive: Uint8Array, stride: number) {
        this.gridCount.fill(0);

        // 1. Count cells per grid cell
        for (let i = 0; i < this.maxCells; i++) {
            if (isActive[i] === 0) continue;
            const x = cells[i * stride];
            const y = cells[i * stride + 1];
            const gx = Math.floor((x / this.worldSize) * this.resolution);
            const gy = Math.floor((y / this.worldSize) * this.resolution);

            if (gx >= 0 && gx < this.resolution && gy >= 0 && gy < this.resolution) {
                this.gridCount[gy * this.resolution + gx]++;
            }
        }

        // 2. Compute offsets
        let offset = 0;
        for (let i = 0; i < this.gridCount.length; i++) {
            this.gridOffset[i] = offset;
            offset += this.gridCount[i];
            this.gridCount[i] = 0; // Reset counts to use as current insertion pointer
        }

        // 3. Fill the grid array
        for (let i = 0; i < this.maxCells; i++) {
            if (isActive[i] === 0) continue;
            const x = cells[i * stride];
            const y = cells[i * stride + 1];
            const gx = Math.floor((x / this.worldSize) * this.resolution);
            const gy = Math.floor((y / this.worldSize) * this.resolution);

            if (gx >= 0 && gx < this.resolution && gy >= 0 && gy < this.resolution) {
                const cellIdx = gy * this.resolution + gx;
                const insertPos = this.gridOffset[cellIdx] + this.gridCount[cellIdx];
                this.grid[insertPos] = i;
                this.gridCount[cellIdx]++;
            }
        }
    }

    /**
     * Executes a callback for all cells in neighbors of (gx, gy).
     */
    query(worldX: number, worldY: number, radius: number, callback: (idx: number) => void) {
        const gxStart = Math.max(0, Math.floor(((worldX - radius) / this.worldSize) * this.resolution));
        const gxEnd = Math.min(this.resolution - 1, Math.floor(((worldX + radius) / this.worldSize) * this.resolution));
        const gyStart = Math.max(0, Math.floor(((worldY - radius) / this.worldSize) * this.resolution));
        const gyEnd = Math.min(this.resolution - 1, Math.floor(((worldY + radius) / this.worldSize) * this.resolution));

        for (let gy = gyStart; gy <= gyEnd; gy++) {
            for (let gx = gxStart; gx <= gxEnd; gx++) {
                const cellIdx = gy * this.resolution + gx;
                const start = this.gridOffset[cellIdx];
                const end = start + this.gridCount[cellIdx];
                for (let i = start; i < end; i++) {
                    callback(this.grid[i]);
                }
            }
        }
    }
}
