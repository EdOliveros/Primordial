import { CellStorage } from "./core/storage";
import { StaticQuadtree } from "./core/quadtree";

async function runBenchmark() {
    const MAX_CELLS = 100_000;
    const WORLD_SIZE = 1000;
    const storage = new CellStorage(MAX_CELLS);
    const quadtree = new StaticQuadtree(storage, 0, 0, WORLD_SIZE, WORLD_SIZE);

    console.log(`--- PRIMORDIAL Benchmark ---`);
    console.log(`Goal: Process ${MAX_CELLS.toLocaleString()} cells`);

    // 1. Spawning
    console.time("Spawning");
    const mockGenome = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    for (let i = 0; i < MAX_CELLS; i++) {
        storage.spawn(
            Math.random() * WORLD_SIZE,
            Math.random() * WORLD_SIZE,
            mockGenome
        );
    }
    console.timeEnd("Spawning");

    // 2. Quadtree Rebuild
    console.time("Quadtree Build");
    quadtree.clear();
    for (let i = 0; i < storage.activeCells; i++) {
        quadtree.insert(i);
    }
    console.timeEnd("Quadtree Build");

    // 3. Collision Query Test (Random cell search)
    console.time("Query Range (1000 random queries)");
    for (let i = 0; i < 1000; i++) {
        const qx = Math.random() * (WORLD_SIZE - 20);
        const qy = Math.random() * (WORLD_SIZE - 20);
        quadtree.queryRange(qx, qy, 20, 20);
    }
    console.timeEnd("Query Range (1000 random queries)");

    // 4. Position Update (DOD efficiency)
    console.time("Update Positions (10 frames)");
    for (let i = 0; i < 10; i++) {
        storage.updatePositions(0.016);
    }
    console.timeEnd("Update Positions (10 frames)");

    console.log(`----------------------------`);
}

runBenchmark().catch(console.error);
