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

    public init(worldSize: number, maxCells: number) {
        this.worldSize = worldSize;
        this.storage.init(maxCells);
        this.spatialGrid = new SpatialGrid(worldSize, maxCells);
        this.environment = new Environment(worldSize);
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
        if (!this.storage || !this.storage.cells) return;
        this.frameCount++;

        // 1. Update Spatial Grid
        this.spatialGrid.update(this.storage.cells, this.storage.isActive, this.storage.stride);

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

        // 5. Swap Buffers (Ping-Pong)
        const temp = this.storage.cells;
        this.storage.cells = this.storage.nextCells;
        this.storage.nextCells = temp;

        // 6. Swarm Logic (Every 30 frames)
        if (this.frameCount % 30 === 0) {
            this.checkSwarmDensity();
        }

        // 7. Alliance Logic (Every 60 frames)
        if (this.frameCount % 60 === 0) {
            this.updateAlliances();
        }
    }

    private updateAlliances() {
        // Reset alliances
        this.storage.allianceId.fill(-1);
        let nextAllianceId = 1;

        const colonies: number[] = [];
        for (let i = 0; i < this.storage.maxCells; i++) {
            if (this.storage.isActive[i] && this.storage.cells[i * this.storage.stride + 6] > 2.0) {
                colonies.push(i);
            }
        }

        const visited = new Set<number>();

        for (const idx of colonies) {
            if (visited.has(idx)) continue;

            const alliance = [idx];
            visited.add(idx);

            const myGenome = this.storage.getGenome(idx);
            const x = this.storage.getX(idx);
            const y = this.storage.getY(idx);

            // Find up to 2 partners
            for (const otherIdx of colonies) {
                if (alliance.length >= 3) break;
                if (visited.has(otherIdx)) continue;

                const tx = this.storage.getX(otherIdx);
                const ty = this.storage.getY(otherIdx);
                const distSq = (x - tx) ** 2 + (y - ty) ** 2;

                if (distSq < 400 * 400) { // Search radius 400
                    // Check genetic affinity (Euclidean distance of RGB genes)
                    const otherGenome = this.storage.getGenome(otherIdx);
                    // Use genes 0,1,2 (Speed, Agg, Photo) + 4 (Def) as markers
                    let diff = 0;
                    diff += Math.abs(myGenome[0] - otherGenome[0]);
                    diff += Math.abs(myGenome[1] - otherGenome[1]);
                    diff += Math.abs(myGenome[2] - otherGenome[2]);

                    if (diff < 0.3) { // Very similar genetics
                        alliance.push(otherIdx);
                        visited.add(otherIdx);
                    }
                }
            }

            // ALLIANCE FUSION LOGIC (Super-Colony)
            // Check for triangles of alliances that are close enough to fuse
            if (alliance.length >= 3) {
                // Register Valid Alliance
                for (const member of alliance) {
                    this.storage.allianceId[member] = nextAllianceId;
                }

                // Check Fusion Condition: Total Mass > Threshold AND Proximity
                let totalAllianceMass = 0;
                let cx = 0, cy = 0;
                for (const m of alliance) {
                    totalAllianceMass += this.storage.cells[m * this.storage.stride + 6];
                    cx += this.storage.getX(m);
                    cy += this.storage.getY(m);
                }
                cx /= alliance.length;
                cy /= alliance.length;

                // If HUGE alliance, FUSE into SUPER COLONY
                if (totalAllianceMass > 100) {
                    // Determine dominant genome
                    const bestMember = alliance.reduce((prev, curr) =>
                        this.storage.getEnergy(curr) > this.storage.getEnergy(prev) ? curr : prev
                    );
                    const superGenome = this.storage.getGenome(bestMember);

                    // Spawn Super Colony
                    const superIdx = this.storage.spawn(cx, cy, superGenome);
                    if (superIdx !== -1) {
                        const off = superIdx * this.storage.stride;
                        this.storage.cells[off + 6] = totalAllianceMass * 1.1; // 10% synergy bonus
                        this.storage.cells[off + 4] = 5000; // Massive Energy
                        this.storage.cells[off + 7] = -1.0; // Glow

                        // Remove old parts
                        alliance.forEach(m => this.storage.remove(m));

                        const color = this.getDominantArchetype(superGenome);
                        this.onEvent('fusion', { color, mass: totalAllianceMass });
                    }
                } else {
                    // Just normal alliance notification
                    if (alliance.length >= 3) {
                        const sampleGenome = this.storage.getGenome(alliance[0]);
                        const geneColor = this.getDominantArchetype(sampleGenome);
                        this.onEvent('alliance', { color: geneColor, count: alliance.length });
                    }
                }
                nextAllianceId++;
            }
        }
    }

    private checkSwarmDensity() {
        // Enforce MAX_ENTITIES by lowering density threshold
        const MAX_ENTITIES = 2000;
        let densityThreshold = 15;
        let searchRadius = 50;

        // Aggressive fusion if over population limit
        if (this.storage.activeCount > MAX_ENTITIES) {
            densityThreshold = 5; // Merge much more aggressively
            searchRadius = 80;
        }

        const visited = new Set<number>();
        const toMerge: number[][] = [];

        // Identify clusters
        for (let i = 0; i < this.storage.maxCells; i++) {
            if (!this.storage.isActive[i] || visited.has(i)) continue;

            const cluster: number[] = [i];
            const x = this.storage.getX(i);
            const y = this.storage.getY(i);
            const mySpecies = this.storage.cells[i * this.storage.stride + 5]; // Archetype as proxy for species

            // Query neighbors
            this.spatialGrid.query(x, y, searchRadius, (nIdx) => {
                if (nIdx === i || visited.has(nIdx)) return;

                // Check if same species/archetype
                const nArch = this.storage.cells[nIdx * this.storage.stride + 5];
                if (nArch === mySpecies) {
                    cluster.push(nIdx);
                    visited.add(nIdx);
                }
            });

            if (cluster.length > densityThreshold) {
                toMerge.push(cluster);
                cluster.forEach(idx => visited.add(idx));
            }
        }

        // Execute Mergers
        toMerge.forEach(cluster => this.formColony(cluster));
    }

    public onEvent: (type: string, data: any) => void = () => { };

    private formColony(clusterIndices: number[]) {
        let totalMass = 0;
        let avgX = 0;
        let avgY = 0;
        let bestGenome: Float32Array | null = null;
        let maxEnergy = -1;

        // Calculate centroid and total properties
        clusterIndices.forEach(idx => {
            const offset = idx * this.storage.stride;
            const mass = this.storage.cells[offset + 6]; // Mass is at offset 6
            const energy = this.storage.cells[offset + 4];

            totalMass += mass;
            avgX += this.storage.getX(idx);
            avgY += this.storage.getY(idx);

            // Inherit genome from most energetic cell (survival of the fittest)
            if (energy > maxEnergy) {
                maxEnergy = energy;
                bestGenome = this.storage.getGenome(idx);
            }

            // Despawn individual
            this.storage.remove(idx);
        });

        if (!bestGenome) return;

        avgX /= clusterIndices.length;
        avgY /= clusterIndices.length;

        // Spawn Super-Entity (Colony)
        const newIdx = this.storage.spawn(avgX, avgY, bestGenome);
        if (newIdx !== -1) {
            // Set properties
            const offset = newIdx * this.storage.stride;
            this.storage.cells[offset + 6] = totalMass; // Set total mass
            this.storage.cells[offset + 4] = maxEnergy + (totalMass * 10); // Bonus energy
            this.storage.cells[offset + 3] = 0; // Reset velocity
            this.storage.cells[offset + 2] = 0;

            // Highlight visually as Colony (Glow)
            this.storage.cells[offset + 7] = -1.0;

            // Trigger Event
            const geneColor = this.getDominantArchetype(bestGenome);
            this.onEvent('colony', { color: geneColor, mass: totalMass });
        }
    }

    private getDominantArchetype(genome: Float32Array): string {
        // Simple mapping based on renderer logic (Gene 0,1,2,4 -> Color)
        // 0: Speed (White), 1: Agg (Red), 2: Photo (Green), 4: Def (Blue)
        let maxVal = 0;
        let type = 'Promedio';

        if (genome[1] > maxVal) { maxVal = genome[1]; type = 'Depredador (Rojo)'; }
        if (genome[2] > maxVal) { maxVal = genome[2]; type = 'Productor (Verde)'; }
        if (genome[4] > maxVal) { maxVal = genome[4]; type = 'Tanque (Azul)'; }
        if (genome[0] > maxVal) { maxVal = genome[0]; type = 'Velocista (Blanco)'; }

        return type;
    }

    private fragmentColony(idx: number, mass: number, genome: Float32Array) {
        const x = this.storage.getX(idx);
        const y = this.storage.getY(idx);
        const survivors = Math.min(5, Math.floor(mass / 2.0)); // 3-5 survivors

        this.storage.remove(idx); // Destroy colony

        for (let i = 0; i < survivors; i++) {
            // Scatter survivors
            const angle = Math.random() * Math.PI * 2;
            const dist = 10 + Math.random() * 20;
            const sx = x + Math.cos(angle) * dist;
            const sy = y + Math.sin(angle) * dist;

            this.storage.spawn(sx, sy, genome);
        }
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
        const offset = idx * this.storage.stride;
        const vx = this.storage.cells[offset + 2];
        const vy = this.storage.cells[offset + 3];
        const currentSpeedSq = vx * vx + vy * vy;
        const energyCost = (currentSpeedSq * 0.5 + Math.pow(size, 3) * 1 + visionRange * 0.005) * dt;
        energy -= energyCost;

        const mass = this.storage.cells[offset + 6];

        const solarIntensity = this.environment.getSolarIntensity(x, y);
        let energyGain = (solarIntensity * photoEfficiency * 45.0 * this.foodAbundance) * dt;

        // Scaled Feeding: Colonies eat more efficiently (Logarithmic Efficiency)
        if (mass > 2.0) {
            // Level 1-10 scaling roughly
            const level = Math.ceil(Math.log10(mass) * 3);
            energyGain *= (1.0 + level * 0.2);
        }
        energy += energyGain;

        const poison = this.environment.getPoison(x, y);
        if (poison > 0) energy -= poison * 50 * dt;

        // Fragmentation: Weak colonies break apart
        if (mass > 1.5 && mass < 10.0) {
            this.fragmentColony(idx, mass, genome);
            return; // Cell removed
        }

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

            // --- COLOSTY SYSTEM: 10-Level Logarithmic Growth ---
            const nMass = this.storage.cells[neighborIdx * this.storage.stride + 6];
            const myMass = this.storage.cells[idx * this.storage.stride + 6];
            const nArch = this.storage.cells[neighborIdx * this.storage.stride + 5];
            const myArch = this.storage.cells[idx * this.storage.stride + 5];

            // 1. Absorption (The Blob Logic)
            // Rule: Bigger eats Smaller (if diff > 20% and compatible-ish or aggressive)
            if (myMass > nMass * 1.2) {
                // Calculate "Eat Radius" based on mass (Logarithmic)
                const eatRadiusSq = (8.0 * (1.0 + Math.log(myMass) * 1.5)) ** 2; // Match visual radius somewhat

                if (distSq < eatRadiusSq * 1.2) { // Tolerance
                    // Check Alliance protection
                    const myAlliance = this.storage.allianceId[idx];
                    const nAlliance = this.storage.allianceId[neighborIdx];
                    const areAllies = myAlliance !== -1 && myAlliance === nAlliance;

                    if (!areAllies) {
                        // CONSUME
                        this.storage.cells[idx * this.storage.stride + 6] += nMass; // Absorb Mass
                        this.storage.cells[idx * this.storage.stride + 4] += energy * 0.5; // Absorb portion of energy
                        this.storage.remove(neighborIdx);

                        // Notify if significant
                        if (nMass > 5.0) {
                            this.onEvent('absorption', { mass: nMass });
                        }
                        return; // Done processing this neighbor
                    }
                }
            }

            const myAlliance = this.storage.allianceId[idx];
            const nAlliance = this.storage.allianceId[neighborIdx];

            // Predation / Fighting
            // If aggressive (> 0.5) and larger mass, steal mass
            // Added Logic: Alliance Protection (Don't eat allies)
            const otherAlliance = this.storage.allianceId[neighborIdx];
            const areAllies = myAlliance !== -1 && myAlliance === otherAlliance;

            if (!areAllies && aggressiveness > 0.5 && myMass > nMass * 1.2) {
                const steal = 1.5 * dt; // Mass transfer rate

                // Check for assimilation event (Colony vs Colony)
                if (myMass > 2.0 && nMass > 2.0 && (nMass - steal) <= 0.1) {
                    // Imminent death of other colony
                    const myGenome = this.storage.getGenome(idx);
                    const otherGenome = this.storage.getGenome(neighborIdx);
                    this.onEvent('assimilation', {
                        predator: this.getDominantArchetype(myGenome),
                        prey: this.getDominantArchetype(otherGenome)
                    });
                }

                this.storage.cells[offset + 6] += steal;
                this.storage.cells[neighborIdx * this.storage.stride + 6] -= steal;

                // Gain energy from eating
                this.storage.cells[offset + 4] += steal * 10;
            }

            // Alliance Cooperation
            if (myAlliance !== -1 && myAlliance === nAlliance) {
                // 1. Energy Sharing (Rich helps Poor)
                const nEnergy = this.storage.cells[neighborIdx * this.storage.stride + 4];
                if (energy > 100 && nEnergy < 50) {
                    const transfer = 10 * dt;
                    energy -= transfer;
                    this.storage.cells[neighborIdx * this.storage.stride + 4] += transfer;
                }

                // 2. Cooperative Defense (Swarm Enemy)
                // If I see an ally, and I am defensive, maybe I don't set them as target.
                // But also, if there is an enemy nearby (handled by standard targeting), I will attack it.
                // To explicitly "surround enemies", we can increase Aggressiveness if an Ally is nearby.
            }

            // Predation
            if (energy < this.HUNGER_THRESHOLD && nGenome[4] < aggressiveness && myMass >= nMass) {
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
                const offset = idx * this.storage.stride;
                this.storage.cells[offset + 2] = (dx / dist) * maxSpeed;
                this.storage.cells[offset + 3] = (dy / dist) * maxSpeed;
            }
        } else if (bestTarget !== -1) {
            const tx = this.storage.getX(bestTarget);
            const ty = this.storage.getY(bestTarget);
            const dx = tx - x;
            const dy = ty - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxSpeed = speedMultiplier * 100;
            if (dist > 0.1) {
                const offset = idx * this.storage.stride;
                this.storage.cells[offset + 2] = (dx / dist) * maxSpeed;
                this.storage.cells[offset + 3] = (dy / dist) * maxSpeed;
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
            const offset = idx * this.storage.stride;
            this.storage.cells[offset + 7] = -1.0;
        } else if (this.storage.cells[idx * this.storage.stride + 7] === -1.0) {
            this.storage.cells[idx * this.storage.stride + 7] = 0.0;
        }

        if (energy <= 0) {
            this.storage.remove(idx);
        } else {
            this.storage.setEnergy(idx, energy);
        }
    }

    private wander(idx: number, speedMult: number) {
        const offset = idx * this.storage.stride;
        this.storage.cells[offset + 2] += (Math.random() - 0.5) * 10;
        this.storage.cells[offset + 3] += (Math.random() - 0.5) * 10;
        const maxSpeed = speedMult * 50;
        const vx = this.storage.cells[offset + 2];
        const vy = this.storage.cells[offset + 3];
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > maxSpeed && speed > 0) {
            this.storage.cells[offset + 2] = (vx / speed) * maxSpeed;
            this.storage.cells[offset + 3] = (vy / speed) * maxSpeed;
        }
    }

    private updateSpecies() {
        this.speciesTracker.resetCounts();
        const currentCounts: Record<number, number> = {};
        for (let i = 0; i < this.storage.maxCells; i++) {
            if (!this.storage.isActive[i]) continue;
            const genome = this.storage.getGenome(i);
            const speciesId = this.speciesTracker.identify(genome);
            this.storage.cells[i * this.storage.stride + 7] = speciesId;
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
            if (this.storage.cells[i * this.storage.stride + 7] === -1.0) {
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
            const archIdx = this.storage.cells[i * this.storage.stride + 5];
            archetypeDist[Math.floor(archIdx)]++;
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
            mass: this.storage.cells[idx * this.storage.stride + 6], // Add mass
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
                this.storage.cells[i * this.storage.stride + 2] *= -1.2;
                this.storage.cells[i * this.storage.stride + 3] *= -1.2;
                this.storage.cells[i * this.storage.stride] += this.storage.cells[i * this.storage.stride + 2] * 0.1;
                this.storage.cells[i * this.storage.stride + 1] += this.storage.cells[i * this.storage.stride + 3] * 0.1;
            }

            if (x < 0) this.storage.cells[i * this.storage.stride] = this.worldSize;
            if (x > this.worldSize) this.storage.cells[i * this.storage.stride] = 0;
            if (y < 0) this.storage.cells[i * this.storage.stride + 1] = this.worldSize;
            if (y > this.worldSize) this.storage.cells[i * this.storage.stride + 1] = 0;
        }
    }
}
