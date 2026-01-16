import { Engine } from "./core/engine";
import { GodMode } from "./core/godMode";

async function runGodModeDemo() {
    const WORLD_SIZE = 2000;
    const engine = new Engine(WORLD_SIZE, 30_000);
    const god = new GodMode(engine);

    console.log("--- PRIMORDIAL God Mode Demo ---");

    // 1. Initial Seeding
    console.log("Seeding world...");
    for (let i = 0; i < 2000; i++) {
        const genome = new Float32Array(8).fill(0.5);
        genome[2] = 0.8; // Photossynthesizers
        engine.storage.spawn(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE, genome);
    }

    const dt = 0.2;

    // Simulate some frames
    for (let i = 0; i < 50; i++) engine.update(dt);
    console.log(`Initial Population: ${engine.storage.activeCells}`);

    // Disaster 1: Ice Age
    console.log("\n>>> Event: ICE AGE (Solar Constant = 0.1)");
    god.setSolarConstant(0.1);
    for (let i = 0; i < 100; i++) engine.update(dt);
    console.log(`Population after Ice Age: ${engine.storage.activeCells}`);

    // Disaster 2: Viral Outbreak
    console.log("\n>>> Event: VIRAL OUTBREAK");
    god.injectViralStrain(20);
    for (let i = 0; i < 50; i++) engine.update(dt);

    const viruses = Array.from({ length: engine.storage.activeCells })
        .filter((_, idx) => engine.storage.stats[idx * 4 + 3] === 999).length;
    console.log(`Current Population: ${engine.storage.activeCells} | Infected: ${viruses}`);

    // Disaster 3: Extinction
    console.log("\n>>> Event: MASS EXTINCTION (90%)");
    god.triggerExtinction();
    console.log(`Final Population: ${engine.storage.activeCells}`);

    console.log("\n---------------------------------");
    console.log("God Mode test complete.");
}

runGodModeDemo().catch(console.error);
