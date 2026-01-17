import { Engine } from "./core/engine";

async function runSpeciesDemo() {
    const WORLD_SIZE = 2000;
    const MAX_CELLS = 50_000;
    const INITIAL_CELLS = 2000;
    const engine = new Engine(WORLD_SIZE, MAX_CELLS);

    console.log(`--- PRIMORDIAL Species Emergence Demo ---`);
    console.log(`Initial population: ${INITIAL_CELLS} generic cells.`);

    // Initialize with 3 distinct "Pre-defined" archetypes to see if they split
    for (let i = 0; i < INITIAL_CELLS; i++) {
        const type = Math.random();
        let genome = new Float32Array(8).fill(0.5);
        if (type < 0.33) {
            // Predator archetype: High Agg, High Vel
            genome[0] = 0.8; genome[1] = 0.9; genome[2] = 0.1;
        } else if (type < 0.66) {
            // Photosynthesizer: High Photo, Low Agg
            genome[0] = 0.2; genome[1] = 0.1; genome[2] = 0.9;
        } else {
            // Tank: High Size, High Def
            genome[3] = 0.9; genome[4] = 0.9; genome[1] = 0.4;
        }

        engine.storage.spawn(
            Math.random() * WORLD_SIZE,
            Math.random() * WORLD_SIZE,
            genome
        );
    }

    const STEPS = 300;
    const dt = 0.2;

    console.log(`Simulating ${STEPS} steps... Identifying species every 30 frames.`);

    for (let i = 0; i <= STEPS; i++) {
        engine.update(dt);

        if (i % 60 === 0) {
            console.log(`\nStep ${i} | Alive: ${engine.storage.activeCount}`);

            // Show top 5 species by population
            const topSpecies = [...engine.speciesTracker.speciesList]
                .sort((a, b) => b.population - a.population)
                .slice(0, 5);

            console.log("Top Species Tags:");
            topSpecies.forEach(s => {
                const color = `RGB(${s.color.r},${s.color.g},${s.color.b})`;
                console.log(`  - ID ${s.id.toString().padEnd(2)} | Pop: ${s.population.toString().padStart(5)} | Color: ${color} | DNA: ${s.representativeDNA[1].toFixed(2)}/${s.representativeDNA[2].toFixed(2)}/${s.representativeDNA[4].toFixed(2)} (Agg/Photo/Def)`);
            });
        }
    }

    console.log(`\n---------------------------------`);
    console.log(`Total species identified during run: ${engine.speciesTracker.speciesList.length}`);
}

runSpeciesDemo().catch(console.error);
