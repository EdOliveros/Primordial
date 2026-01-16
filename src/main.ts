import { PrimordialRenderer } from "./web/renderer";

const WORLD_SIZE = 2000;
const MAX_CELLS = 50_000;
const GENE_LABELS = ["SPD", "AGG", "PHO", "SIZ", "DEF", "VIS", "MUT", "LIF"];

async function start() {
    const canvas = document.getElementById("simCanvas") as HTMLCanvasElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const renderer = new PrimordialRenderer(canvas);

    // UI Elements - Dash
    const uiAlive = document.getElementById("val-alive")!;
    const uiBirths = document.getElementById("val-births")!;
    const uiDeaths = document.getElementById("val-deaths")!;
    const uiStability = document.getElementById("val-stability")!;
    const uiTime = document.getElementById("val-time")!;
    const uiGen = document.getElementById("gen-tag")!;
    const uiFPS = document.getElementById("fps-counter")!;
    const uiHisto = document.getElementById("gene-histogram")!;
    const dashboard = document.getElementById("dashboard")!;
    const clockPanel = document.getElementById("clock-panel")!;

    // UI Elements - Inspector
    const inspector = document.getElementById("inspector")!;
    const insName = document.getElementById("inspector-name")!;
    const insGen = document.getElementById("inspector-gen")!;
    const insEnergy = document.getElementById("inspector-energy")!;
    const insDNA = document.getElementById("inspector-dna")!;
    const btnFollow = document.getElementById("btn-follow")! as HTMLButtonElement;
    const btnCloseInspect = document.getElementById("btn-close-inspect")!;

    // UI Elements - Setup
    const startScreen = document.getElementById("start-screen")!;
    const btnStart = document.getElementById("btn-start")! as HTMLButtonElement;
    const inputCount = document.getElementById("input-count")! as HTMLInputElement;
    const inputMutation = document.getElementById("input-mutation")! as HTMLInputElement;
    const inputFood = document.getElementById("input-food")! as HTMLInputElement;
    const inputFriction = document.getElementById("input-friction")! as HTMLInputElement;

    const labelCount = document.getElementById("label-count")!;
    const labelMutation = document.getElementById("label-mutation")!;
    const labelFood = document.getElementById("label-food")!;
    const labelFriction = document.getElementById("label-friction")!;

    // Camera State
    let cameraPos: [number, number] = [WORLD_SIZE / 2, WORLD_SIZE / 2];
    let zoom = 1.0;
    let targetZoom = 1.0;
    let followingIdx: number | null = null;
    let inspectedCell: any = null;

    // Interaction
    canvas.addEventListener("click", (e) => {
        if (!isSimulationRunning) return;

        // Convert screen click to world coordinates
        // NDC space: -1 to 1 corresponds to screen width/height
        // View space: (world - camera) * zoom
        // NDC = view / (worldSize * 0.5)

        const rect = canvas.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;

        // Inverse transform
        const vx = nx * (WORLD_SIZE * 0.5);
        const vy = ny * (WORLD_SIZE * 0.5);

        const worldX = vx / zoom + cameraPos[0];
        const worldY = vy / zoom + cameraPos[1];

        worker.postMessage({ type: "inspect", data: { x: worldX, y: worldY } });
    });

    btnCloseInspect.onclick = () => {
        inspector.style.display = "none";
        followingIdx = null;
        btnFollow.classList.remove("active");
        targetZoom = 1.0;
    };

    btnFollow.onclick = () => {
        if (inspectedCell) {
            followingIdx = inspectedCell.idx;
            btnFollow.classList.add("active");
            targetZoom = 4.0;
        }
    };

    // Setup Listeners
    inputCount.oninput = () => labelCount.textContent = inputCount.value;
    inputMutation.oninput = () => labelMutation.textContent = inputMutation.value + "x";
    inputFood.oninput = () => labelFood.textContent = inputFood.value + "x";
    inputFriction.oninput = () => labelFriction.textContent = inputFriction.value;

    const bars: HTMLElement[] = [];
    GENE_LABELS.forEach((label) => {
        const container = document.createElement("div");
        container.className = "histo-bar-container";
        container.innerHTML = `<div class="histo-label">${label}</div><div class="histo-track"><div class="histo-fill"></div></div>`;
        uiHisto.appendChild(container);
        bars.push(container.querySelector(".histo-fill") as HTMLElement);
    });

    const worker = new Worker(new URL("./simWorker.ts", import.meta.url), { type: "module" });
    worker.postMessage({ type: "init", data: { worldSize: WORLD_SIZE, maxCells: MAX_CELLS } });

    let isWorkerReady = false;
    let isSimulationRunning = false;
    let lastRenderData: any = null;
    let frameCount = 0;

    worker.onmessage = (e) => {
        const { type, data } = e.data;
        if (type === "ready") isWorkerReady = true;
        if (type === "renderData") {
            lastRenderData = data;
            updateUI(data.telemetry);

            // If following, update camera target position from render data if possible, 
            // but worker doesn't return full index map. 
            // We'll need the worker to send us the specific followed cell's pos.
            if (followingIdx !== null) {
                // Request specific cell update
                worker.postMessage({ type: "inspect", data: { x: inspectedCell.x, y: inspectedCell.y, followedIdx: followingIdx } });
            }
        }
        if (type === "inspectionResults") {
            if (data) {
                inspectedCell = data;
                showInspector(data);
                if (followingIdx === data.idx) {
                    cameraPos[0] = data.x;
                    cameraPos[1] = data.y;
                }
            }
        }
    };

    function showInspector(cell: any) {
        inspector.style.display = "block";
        insName.textContent = `CELL #${cell.idx}`;
        insGen.textContent = `Gen ${cell.generation}`;
        insEnergy.textContent = Math.floor(cell.energy).toString();

        insDNA.innerHTML = "";
        cell.genome.forEach((val: number, i: number) => {
            const slot = document.createElement("div");
            slot.className = "gene-slot";
            slot.innerHTML = `<div class="gene-val">${(val * 100).toFixed(0)}</div><div class="gene-name">${GENE_LABELS[i]}</div>`;
            insDNA.appendChild(slot);
        });
    }

    btnStart.onclick = () => {
        if (!isWorkerReady) return;
        const count = parseInt(inputCount.value);
        worker.postMessage({
            type: "applySettings", data: {
                mutationRate: parseFloat(inputMutation.value),
                foodAbundance: parseFloat(inputFood.value),
                friction: parseFloat(inputFriction.value)
            }
        });
        for (let i = 0; i < count; i++) {
            worker.postMessage({
                type: "spawn", data: {
                    x: Math.random() * WORLD_SIZE, y: Math.random() * WORLD_SIZE,
                    genome: new Float32Array(8).map(() => Math.random())
                }
            });
        }
        startScreen.classList.add("hidden");
        dashboard.classList.add("visible");
        clockPanel.classList.add("visible");
        isSimulationRunning = true;
    };

    function updateUI(tel: any) {
        if (!tel) return;
        uiAlive.textContent = tel.alive.toLocaleString();
        uiBirths.textContent = tel.births.toLocaleString();
        uiDeaths.textContent = tel.deaths.toLocaleString();
        uiGen.textContent = `GEN. ${tel.generation}`;
        const stability = Math.max(0, 100 - (tel.deaths / (tel.births + 1)) * 10);
        uiStability.textContent = `${stability.toFixed(1)}%`;
        const maxPop = Math.max(...tel.histogram as number[]) || 1;
        tel.histogram.forEach((count: number, i: number) => {
            bars[i].style.width = `${(count / maxPop) * 100}%`;
        });
    }

    let lastTime = performance.now();
    let fpsFrames = 0;
    let fpsTime = performance.now();

    function loop() {
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        if (isSimulationRunning && isWorkerReady) {
            frameCount++;
            uiTime.textContent = `YEAR ${(frameCount / 200).toFixed(1)}`;
            fpsFrames++;
            if (now > fpsTime + 1000) {
                uiFPS.textContent = `FPS: ${fpsFrames}`;
                fpsFrames = 0;
                fpsTime = now;
            }

            // Smooth Zoom
            zoom += (targetZoom - zoom) * 0.05;

            worker.postMessage({ type: "update", data: { dt: Math.min(dt, 0.1) } });
        }

        if (lastRenderData) {
            renderer.render(
                [WORLD_SIZE, WORLD_SIZE],
                lastRenderData.positions,
                lastRenderData.colors,
                lastRenderData.count,
                cameraPos,
                zoom
            );
        }

        requestAnimationFrame(loop);
    }

    loop();
}

window.onload = start;
