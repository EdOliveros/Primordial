import { Engine } from "./core/engine";

async function runEvolutionDemo() {
    const WORLD_SIZE = 2000;
    const MAX_CELLS = 50_000;
    const INITIAL_CELLS = 1000;
    const engine = new Engine(WORLD_SIZE, MAX_CELLS);

    console.log(`--- PRIMORDIAL Evolution Demo ---`);
    console.log(`Starting with ${INITIAL_CELLS} cells in a ${WORLD_SIZE}x${WORLD_SIZE} world.`);

    // Initialize with random genes
    for (let i = 0; i < INITIAL_CELLS; i++) {
        const genome = Array.from({ length: 8 }, () => Math.random());
        // Mix genes for better start: [Vel, Agg, Photo, Size, Def, Vision, Mut, Life]
        // Increase Photo and Vision for early survival
        genome[2] = 0.8;
        genome[5] = 0.5;
        engine.storage.spawn(
            Math.random() * WORLD_SIZE,
            Math.random() * WORLD_SIZE,
            genome
        );
    }

    const SIM_FRAMES = 100;
    const dt = 0.1; // Large dt for faster simulation

    console.log(`Running simulation for ${SIM_FRAMES} frames...`);

    for (let frame = 0; frame <= SIM_FRAMES; frame++) {
        engine.update(dt);

        if (frame % 20 === 0) {
            let totalEnergy = 0;
            let avgAggressiveness = 0;
            for (let i = 0; i < engine.storage.activeCells; i++) {
                totalEnergy += engine.storage.getEnergy(i);
                avgAggressiveness += engine.storage.getGenome(i)[1];
            }
            let avgEnergy = engine.storage.activeCells > 0 ? totalEnergy / engine.storage.activeCells : 0;
            avgAggressiveness /= engine.storage.activeCells || 1;

            if (isNaN(avgEnergy)) avgEnergy = 0;

            console.log(`Frame ${frame.toString().padStart(3)} | Pop: ${engine.storage.activeCells.toString().padStart(5)} | Avg Energy: ${avgEnergy.toFixed(1)} | Avg Agg: ${avgAggressiveness.toFixed(3)}`);
        }
    }

    console.log(`---------------------------------`);
    console.log(`Final stats: ${engine.storage.activeCells} cells alive.`);
}

runEvolutionDemo().catch(console.error);
