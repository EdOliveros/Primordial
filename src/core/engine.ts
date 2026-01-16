import { CellStorage } from "./storage";
import { SpatialGrid } from "./spatialGrid";
import { Environment } from "./environment";
import { SpeciesTracker } from "./species";
import { Analytics } from "./analytics";

/**
 * Engine manages the simulation loop, including AI, physics, and evolution.
 * Optimized with Spatial Hashing and Object Pooling awareness.
 */
export class Engine {
    public storage: CellStorage;
    public spatialGrid: SpatialGrid;
    public environment: Environment;
    public speciesTracker: SpeciesTracker;
    public analytics: Analytics;

    public worldSize: number;

    private readonly REPRO_ENERGY = 150.0;
    private readonly HUNGER_THRESHOLD = 60.0;
    private frameCount: number = 0;

    public foodAbundance: number = 1.0;
    public totalBirths: number = 0;
    public totalDeaths: number = 0;

    constructor(worldSize: number, maxCells: number) {
        this.worldSize = worldSize;
        this.storage = new CellStorage(maxCells);
        this.spatialGrid = new SpatialGrid(worldSize, maxCells);
        this.environment = new Environment(worldSize);
        this.speciesTracker = new SpeciesTracker();
        this.analytics = new Analytics();
    }

    applySettings(settings: any) {
        if (settings.mutationRate !== undefined) {
            this.storage.globalMutationRate = settings.mutationRate;
        }
        if (settings.foodAbundance !== undefined) {
            this.foodAbundance = settings.foodAbundance;
        }
        if (settings.friction !== undefined) {
            this.storage.friction = settings.friction;
        }
    }

    update(dt: number) {
        this.frameCount++;

        // 1. Update Spatial Grid
        this.spatialGrid.update(this.storage.positions, this.storage.isActive, this.storage.maxCells);

        // 2. Identify Species
        if (this.frameCount === 1 || this.frameCount % 60 === 0) {
            this.updateSpecies();
        }

        // 3. Process Cells
        let frameDeaths = 0;
        for (let i = 0; i < this.storage.maxCells; i++) {
            if (this.storage.isActive[i]) {
                const wasActive = this.storage.isActive[i];
                this.processCell(i, dt);
                if (wasActive && !this.storage.isActive[i]) {
                    frameDeaths++;
                }
            }
        }
        this.totalDeaths += frameDeaths;

        // 4. Move Cells
        this.storage.updatePositions(dt);
        this.boundaryCheck();
    }

    private processCell(idx: number, dt: number) {
        const genome = this.storage.getGenome(idx);

        const speedMultiplier = genome[0];
        const aggressiveness = genome[1];
        const photoEfficiency = genome[2];
        const size = genome[3];
        const defense = genome[4];
        const visionRange = genome[5] * 100;

        let energy = this.storage.getEnergy(idx);
        const x = this.storage.getX(idx);
        const y = this.storage.getY(idx);

        // --- 1. Thermodynamics ---
        const vx = this.storage.velocities[idx * 2];
        const vy = this.storage.velocities[idx * 2 + 1];
        const currentSpeedSq = vx * vx + vy * vy;
        const energyCost = (currentSpeedSq * 0.5 + Math.pow(size, 3) * 1 + visionRange * 0.005) * dt;
        energy -= energyCost;

        const solarIntensity = this.environment.getSolarIntensity(x, y);
        const energyGain = (solarIntensity * photoEfficiency * 45.0 * this.foodAbundance) * dt;
        energy += energyGain;

        const poison = this.environment.getPoison(x, y);
        if (poison > 0) energy -= poison * 50 * dt;

        // --- 2. AI & Behavior ---
        let bestTarget = -1;
        let fleeTarget = -1;
        let minDist = Infinity;
        let minFleeDist = Infinity;

        this.spatialGrid.query(x, y, visionRange, (neighborIdx) => {
            if (neighborIdx === idx) return;
            const tx = this.storage.getX(neighborIdx);
            const ty = this.storage.getY(neighborIdx);
            const distSq = (tx - x) ** 2 + (ty - y) ** 2;

            const nGenome = this.storage.getGenome(neighborIdx);

            // Predation
            if (energy < this.HUNGER_THRESHOLD && nGenome[4] < aggressiveness) {
                if (distSq < minDist) {
                    minDist = distSq;
                    bestTarget = neighborIdx;
                }
            }

            // Fleeing
            if (nGenome[1] > defense && distSq < minFleeDist) {
                minFleeDist = distSq;
                fleeTarget = neighborIdx;
            }
        });

        if (fleeTarget !== -1) {
            const tx = this.storage.getX(fleeTarget);
            const ty = this.storage.getY(fleeTarget);
            const dx = x - tx;
            const dy = y - ty;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxSpeed = speedMultiplier * 100;
            if (dist > 0.1) {
                this.storage.velocities[idx * 2] = (dx / dist) * maxSpeed;
                this.storage.velocities[idx * 2 + 1] = (dy / dist) * maxSpeed;
            }
        } else if (bestTarget !== -1) {
            const tx = this.storage.getX(bestTarget);
            const ty = this.storage.getY(bestTarget);
            const dx = tx - x;
            const dy = y - ty;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxSpeed = speedMultiplier * 100;
            if (dist > 0.1) {
                this.storage.velocities[idx * 2] = (dx / dist) * maxSpeed;
                this.storage.velocities[idx * 2 + 1] = (dy / dist) * maxSpeed;
            }

            if (dist < (size * 10 + this.storage.getGenome(bestTarget)[3] * 10)) {
                energy += 30;
                this.storage.remove(bestTarget);
            }
        } else {
            this.wander(idx, speedMultiplier);
        }

        // --- 3. Evolution ---
        if (energy > this.REPRO_ENERGY) {
            if (this.storage.reproduce(idx) !== -1) {
                this.totalBirths++;
            }
            energy -= 80;
            this.storage.stats[idx * 4 + 3] = -1.0;
        } else if (this.storage.stats[idx * 4 + 3] === -1.0) {
            this.storage.stats[idx * 4 + 3] = 0.0;
        }

        if (energy <= 0) {
            this.storage.remove(idx);
        } else {
            this.storage.setEnergy(idx, energy);
        }
    }

    private wander(idx: number, speedMult: number) {
        this.storage.velocities[idx * 2] += (Math.random() - 0.5) * 10;
        this.storage.velocities[idx * 2 + 1] += (Math.random() - 0.5) * 10;
        const maxSpeed = speedMult * 50;
        const vx = this.storage.velocities[idx * 2];
        const vy = this.storage.velocities[idx * 2 + 1];
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > maxSpeed && speed > 0) {
            this.storage.velocities[idx * 2] = (vx / speed) * maxSpeed;
            this.storage.velocities[idx * 2 + 1] = (vy / speed) * maxSpeed;
        }
    }

    private updateSpecies() {
        this.speciesTracker.resetCounts();
        const currentCounts: Record<number, number> = {};
        for (let i = 0; i < this.storage.maxCells; i++) {
            if (!this.storage.isActive[i]) continue;
            const genome = this.storage.getGenome(i);
            const speciesId = this.speciesTracker.identify(genome);
            this.storage.stats[i * 4 + 3] = speciesId;
            currentCounts[speciesId] = (currentCounts[speciesId] || 0) + 1;
        }
        this.speciesTracker.prune();
        this.analytics.record(currentCounts);
    }

    public getVisualData() {
        let count = 0;
        for (let i = 0; i < this.storage.maxCells; i++) if (this.storage.isActive[i]) count++;

        const posData = new Float32Array(count * 2);
        const colorData = new Float32Array(count * 4);
        let ptr = 0;
        for (let i = 0; i < this.storage.maxCells; i++) {
            if (!this.storage.isActive[i]) continue;
            posData[ptr * 2] = this.storage.getX(i);
            posData[ptr * 2 + 1] = this.storage.getY(i);

            const cIdx = i * 4;
            colorData[ptr * 4] = this.storage.visualColors[cIdx];
            colorData[ptr * 4 + 1] = this.storage.visualColors[cIdx + 1];
            colorData[ptr * 4 + 2] = this.storage.visualColors[cIdx + 2];
            colorData[ptr * 4 + 3] = this.storage.visualColors[cIdx + 3];

            // If highlighted (metadata slot used for transient effects)
            if (this.storage.stats[i * 4 + 3] === -1.0) {
                colorData[ptr * 4 + 3] = 1.0; // Force glow for reproduction/events
            }

            ptr++;
        }
        return { positions: posData, colors: colorData, count };
    }

    public getTelemetry() {
        const geneHistogram = new Int32Array(8);
        const archetypeDist = new Int32Array(5); // [Avg, Pred, Prod, Tank, Speed]

        for (let i = 0; i < this.storage.maxCells; i++) {
            if (!this.storage.isActive[i]) continue;

            // Gene histogram
            const genome = this.storage.getGenome(i);
            let dominant = 0;
            let maxVal = -1;
            for (let g = 0; g < 8; g++) {
                if (genome[g] > maxVal) {
                    maxVal = genome[g];
                    dominant = g;
                }
            }
            geneHistogram[dominant]++;

            // Archetype distribution
            const archIdx = this.storage.archetypes[i];
            archetypeDist[archIdx]++;
        }

        return {
            alive: this.storage.activeCount,
            births: this.totalBirths,
            deaths: this.totalDeaths,
            generation: Math.floor(this.frameCount / 500),
            histogram: Array.from(geneHistogram),
            archetypes: Array.from(archetypeDist)
        };
    }

    public getNearestCell(x: number, y: number, followedIdx: number = -1) {
        let idx = -1;

        if (followedIdx !== -1 && this.storage.isActive[followedIdx]) {
            idx = followedIdx;
        } else {
            let minDist = 100 * 100; // 100px search radius for manual click
            this.spatialGrid.query(x, y, 100, (nIdx) => {
                const dx = this.storage.getX(nIdx) - x;
                const dy = this.storage.getY(nIdx) - y;
                const d2 = dx * dx + dy * dy;
                if (d2 < minDist) {
                    minDist = d2;
                    idx = nIdx;
                }
            });
        }

        if (idx === -1 || !this.storage.isActive[idx]) return null;

        return {
            idx: idx,
            x: this.storage.getX(idx),
            y: this.storage.getY(idx),
            energy: this.storage.getEnergy(idx),
            genome: Array.from(this.storage.getGenome(idx)),
            generation: this.storage.generations[idx]
        };
    }

    private boundaryCheck() {
        for (let i = 0; i < this.storage.maxCells; i++) {
            if (!this.storage.isActive[i]) continue;
            let x = this.storage.getX(i);
            let y = this.storage.getY(i);

            if (this.environment.isBlocked(x, y)) {
                this.storage.velocities[i * 2] *= -1.2;
                this.storage.velocities[i * 2 + 1] *= -1.2;
                this.storage.positions[i * 2] += this.storage.velocities[i * 2] * 0.1;
                this.storage.positions[i * 2 + 1] += this.storage.velocities[i * 2 + 1] * 0.1;
            }

            if (x < 0) this.storage.positions[i * 2] = this.worldSize;
            if (x > this.worldSize) this.storage.positions[i * 2] = 0;
            if (y < 0) this.storage.positions[i * 2 + 1] = this.worldSize;
            if (y > this.worldSize) this.storage.positions[i * 2 + 1] = 0;
        }
    }
}
