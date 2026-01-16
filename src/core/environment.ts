/**
 * Environment class manages the solar intensity map.
 * In a real scenario, this would use Perlin/Simplex noise. 
 * For this high-performance simulation, we use a simple harmonic noise map.
 */
export class Environment {
    private solarMap: Float32Array;
    private poisonMap: Float32Array;
    private barriers: Uint8Array;
    private resolution: number;
    private worldSize: number;
    public solarConstant: number = 1.0;

    constructor(worldSize: number, resolution: number = 64) {
        this.worldSize = worldSize;
        this.resolution = resolution;
        this.solarMap = new Float32Array(resolution * resolution);
        this.poisonMap = new Float32Array(resolution * resolution);
        this.barriers = new Uint8Array(resolution * resolution);
        this.generateMaps();
    }

    private generateMaps() {
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                const nx = x / this.resolution;
                const ny = y / this.resolution;
                const sValue = (Math.sin(nx * 10) * Math.cos(ny * 10) + 1.5) / 3.0;
                this.solarMap[y * this.resolution + x] = Math.max(0, Math.min(1, sValue));

                // Poison Areas
                const pValue = (Math.sin(nx * 20) * Math.sin(ny * 20) + 1.0) / 2.0;
                this.poisonMap[y * this.resolution + x] = pValue > 0.85 ? (pValue - 0.85) * 5 : 0;

                // Barriers
                if (x > 30 && x < 35 && y > 10 && y < 50) {
                    this.barriers[y * this.resolution + x] = 1;
                }
            }
        }
    }

    getSolarIntensity(worldX: number, worldY: number): number {
        const x = Math.floor((worldX / this.worldSize) * this.resolution);
        const y = Math.floor((worldY / this.worldSize) * this.resolution);
        if (x < 0 || x >= this.resolution || y < 0 || y >= this.resolution) return 0;
        return this.solarMap[y * this.resolution + x] * this.solarConstant;
    }

    getPoison(worldX: number, worldY: number): number {
        const x = Math.floor((worldX / this.worldSize) * this.resolution);
        const y = Math.floor((worldY / this.worldSize) * this.resolution);
        if (x < 0 || x >= this.resolution || y < 0 || y >= this.resolution) return 0;
        return this.poisonMap[y * this.resolution + x];
    }

    isBlocked(worldX: number, worldY: number): boolean {
        const x = Math.floor((worldX / this.worldSize) * this.resolution);
        const y = Math.floor((worldY / this.worldSize) * this.resolution);
        if (x < 0 || x >= this.resolution || y < 0 || y >= this.resolution) return true;
        return this.barriers[y * this.resolution + x] === 1;
    }
}
