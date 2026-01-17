import { PrimordialRenderer } from "../web/renderer";
import { Engine } from "./engine";

export interface Telemetry {
    alive: number;
    births: number;
    deaths: number;
    generation: number;
    histogram: number[];
    archetypes: number[];
}

export class SimulationController {
    private canvas: HTMLCanvasElement;
    private renderer: PrimordialRenderer;
    private engine: Engine; // CPU Engine for high-perf Step 2
    private isSimulationRunning = false;
    private frameCount = 0;
    private lastTime = performance.now();
    private fpsFrames = 0;
    private fpsTime = performance.now();

    public onTelemetry: (tel: Telemetry) => void = () => { };
    public onFPS: (fps: number) => void = () => { };
    public onFrame: (frameCount: number) => void = () => { };
    public onInspector: (cell: any) => void = () => { };

    public cameraPos: [number, number] = [500, 500]; // Center of 1000x1000 world
    public zoom = 1.0; // Locked zoom
    public followingIdx: number | null = null;
    public inspectedCell: any = null;

    private animationId: number | null = null;

    // Keyboard navigation state
    private keyState = {
        w: false, a: false, s: false, d: false,
        ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
    };

    constructor(canvas: HTMLCanvasElement) {
        // ID de Instancia para debugging (Anti Gravity Request)
        console.log('Nueva instancia de Simulación creada:', Math.random());

        this.canvas = canvas;
        this.renderer = new PrimordialRenderer(canvas);
        // Ensure renderer starts with correct size
        this.renderer.resize(canvas.width, canvas.height);
        this.engine = new Engine(1000, 100000);
    }

    public start(settings: { count: number, mutation: number, food: number, friction: number }) {
        // Prevent double loop
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        this.engine.applySettings({
            mutationRate: settings.mutation,
            foodAbundance: settings.food,
            friction: settings.friction
        });

        // Initialize cells on CPU Storage (Paso 1 Optimization)
        for (let i = 0; i < Math.min(settings.count, 100000); i++) {
            const genome = new Float32Array(8).map(() => Math.random());
            this.engine.storage.spawn(
                Math.random() * 1000,
                Math.random() * 1000,
                genome
            );
        }

        this.isSimulationRunning = true;
        this.loop();
        this.startAutoSave();
    }

    public startAutoSave() {
        setInterval(() => {
            if (this.isSimulationRunning) {
                this.saveState();
            }
        }, 10000);
    }

    public saveState() {
        try {
            const activeCells = [];
            const storage = this.engine.storage;

            for (let i = 0; i < storage.maxCells; i++) {
                if (storage.isActive[i]) {
                    const offset = i * storage.stride;
                    // Compact format: [x, y, vx, vy, energy, ...genome(8), color]
                    // To save space, we might reconstruct colors on load, but saving genome is critical.
                    const genome = [];
                    for (let g = 0; g < 8; g++) genome.push(parseFloat(storage.cells[offset + 8 + g].toFixed(3)));

                    activeCells.push([
                        Math.round(storage.cells[offset]), // x
                        Math.round(storage.cells[offset + 1]), // y
                        parseFloat(storage.cells[offset + 4].toFixed(1)), // energy
                        ...genome
                    ]);
                }
            }

            const saveData = {
                timestamp: Date.now(),
                settings: {
                    mutation: this.engine.storage.globalMutationRate,
                    friction: this.engine.storage.friction,
                    food: this.engine.environment.solarConstant // Approximation
                },
                cells: activeCells
            };

            localStorage.setItem('primordial_save', JSON.stringify(saveData));
            // Optional: Trigger a small notification event if linked? 
            // Better not spam user every 10s.
        } catch (e) {
            console.error("Auto-save failed (Quota?):", e);
        }
    }

    public loadState(): boolean {
        try {
            const raw = localStorage.getItem('primordial_save');
            if (!raw) return false;

            const data = JSON.parse(raw);

            // Clear current world
            this.engine.storage.init(this.engine.storage.maxCells); // Reset buffers

            // Apply settings
            if (data.settings) {
                this.engine.storage.globalMutationRate = data.settings.mutation || 1.0;
                this.engine.storage.friction = data.settings.friction || 0.98;
                // Environmental settings might need more direct access if extended
            }

            // Spawn cells
            // Format: [x, y, energy, g0...g7]
            for (const cellData of data.cells) {
                const x = cellData[0];
                const y = cellData[1];
                const energy = cellData[2];
                const genome = cellData.slice(3, 11);

                const idx = this.engine.storage.spawn(x, y, genome);
                if (idx !== -1) {
                    this.engine.storage.setEnergy(idx, energy);
                }
            }

            this.isSimulationRunning = true;
            this.loop();
            this.startAutoSave();
            return true;
        } catch (e) {
            console.error("Failed to load save:", e);
            return false;
        }
    }

    public clearSave() {
        localStorage.removeItem('primordial_save');
    }

    public stop() {
        this.isSimulationRunning = false;
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    public setCameraPos(x: number, y: number) {
        this.cameraPos = [x, y];
    }

    public pan(dx: number, dy: number) {
        this.cameraPos[0] -= dx / this.zoom;
        this.cameraPos[1] -= dy / this.zoom;

        // Constrain camera to world bounds (0-1000)
        this.cameraPos[0] = Math.max(0, Math.min(1000, this.cameraPos[0]));
        this.cameraPos[1] = Math.max(0, Math.min(1000, this.cameraPos[1]));
    }

    public setKeyState(key: string, pressed: boolean) {
        if (key in this.keyState) {
            (this.keyState as any)[key] = pressed;
        }
    }

    private updateKeyboardMovement() {
        // Fixed speed since zoom is locked
        const speed = 10;

        let dx = 0;
        let dy = 0;

        if (this.keyState.w || this.keyState.ArrowUp) dy -= speed;
        if (this.keyState.s || this.keyState.ArrowDown) dy += speed;
        if (this.keyState.a || this.keyState.ArrowLeft) dx -= speed;
        if (this.keyState.d || this.keyState.ArrowRight) dx += speed;

        if (dx !== 0 || dy !== 0) {
            this.cameraPos[0] += dx;
            this.cameraPos[1] += dy;

            // Constrain camera to world bounds (0-1000)
            this.cameraPos[0] = Math.max(0, Math.min(1000, this.cameraPos[0]));
            this.cameraPos[1] = Math.max(0, Math.min(1000, this.cameraPos[1]));
        }
    }

    // Zoom handling removed - zoom is locked to 1.0

    public async inspect(worldX: number, worldY: number) {
        // CPU Picking for Step 2 (Direct access to engine data)
        const cell = this.engine.getNearestCell(worldX, worldY);
        this.inspectedCell = cell;
        this.onInspector(cell);
    }

    public follow() {
        if (this.inspectedCell) {
            this.followingIdx = this.inspectedCell.idx;
        }
    }

    public dismissInspector() {
        this.followingIdx = null;
        this.inspectedCell = null;
    }

    private loop = () => {
        if (!this.isSimulationRunning) return;

        // HEARTBEAT LOG (Every 100 frames)
        if (this.frameCount % 100 === 0) {
            console.log(`--- Loop Corriendo (Frame ${this.frameCount}) ---`);
            console.log(`Camera: ${this.cameraPos[0].toFixed(1)}, ${this.cameraPos[1].toFixed(1)} Zoom: ${this.zoom}`);
            console.log(`Entities: ${this.engine.storage.activeCount}`);

            // AUTO-ZOOM CHECK (Level 10 Detection)
            let maxMass = 0;
            for (let i = 0; i < this.engine.storage.maxCells; i++) {
                if (this.engine.storage.isActive[i]) {
                    const m = this.engine.storage.cells[i * this.engine.storage.stride + 6];
                    if (m > maxMass) maxMass = m;
                }
            }
            // If Level 10 (Mass > 500) exists, target Zoom to 0.5
            if (maxMass > 450) {
                // Smoothly drift to 0.6 if currently zoomed in
                if (this.zoom > 0.6) {
                    this.zoom = this.zoom * 0.99 + 0.6 * 0.01;
                }
            }
        }

        // FORCE CAMERA RESET (Debug)
        // this.cameraPos = [500, 500]; 
        // this.zoom = 1.0;

        const now = performance.now();
        const dt = Math.min(0.016, (now - this.lastTime) / 1000);
        this.lastTime = now;

        this.frameCount++;
        try {
            this.onFrame(this.frameCount);
        } catch (e) { console.error("Error in onFrame:", e); }

        this.fpsFrames++;
        if (now > this.fpsTime + 500) {
            this.onFPS(this.fpsFrames * 2);
            this.fpsFrames = 0;
            this.fpsTime = now;
        }

        this.updateKeyboardMovement();

        try {
            // 1. Step Simulation
            this.engine.update(dt);

            // 2. Render
            if (this.renderer) {
                this.renderer.render(
                    [this.canvas.width, this.canvas.height],
                    this.engine.storage.cells,
                    this.engine.storage.maxCells,
                    this.cameraPos,
                    this.zoom,
                    this.engine.storage.allianceId,
                    this.engine.storage.isActive, // Pass isActive for strict filtering
                    this.engine.storage.cooldowns // Pass cooldowns for debug visuals
                );
            }
        } catch (e) {
            console.error("CRITICAL ERROR IN LOOP:", e);
        }

        // 3. UI Updates
        if (this.frameCount % 30 === 0) {
            try {
                const tel = this.engine.getTelemetry();
                if (this.frameCount % 300 === 0) this.checkMilestones(tel);
                if (this.frameCount % 120 === 0) this.onTelemetry(tel);
            } catch (e) { console.error("Error in UI/Telemetry:", e); }
        }

        this.animationId = requestAnimationFrame(this.loop);
    }

    private previousTelemetry: Telemetry | null = null;

    private checkMilestones(tel: Telemetry) {
        if (tel.alive < 50) return; // Ignore early game

        const total = tel.archetypes.reduce((a, b) => a + b, 0);
        if (total === 0) return;

        const GENE_NAMES = ["Velocista", "Depredador", "Productor", "Tanque", "Velocista (Def)"];

        // 1. Dominance Check
        tel.archetypes.forEach((count, i) => {
            const pct = count / total;
            if (pct > 0.8 && i > 0) {
                this.onEvent(`Hito: La especie ${GENE_NAMES[i]} domina el 80% del ecosistema.`);
            }
        });

        // 2. Trend Analysis (vs previous snapshot)
        if (this.previousTelemetry) {
            const prevTotal = this.previousTelemetry.archetypes.reduce((a, b) => a + b, 0);
            if (prevTotal > 0) {
                tel.archetypes.forEach((count, i) => {
                    const pct = count / total;
                    const prevPct = this.previousTelemetry!.archetypes[i] / prevTotal;
                    const delta = pct - prevPct;

                    if (delta > 0.10) {
                        this.onEvent(`¡Explosión demográfica! La especie ${GENE_NAMES[i]} crece rápidamente.`);
                    }
                    if (delta < -0.10) {
                        this.onEvent(`Alerta de Colapso: La especie ${GENE_NAMES[i]} está en declive.`);
                    }
                });
            }
        }

        // Save snapshot (clone to avoid reference issues)
        this.previousTelemetry = JSON.parse(JSON.stringify(tel));
    }

    public onEvent: (msg: string) => void = () => { };

    public resize(width: number, height: number) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.renderer.resize(width, height);
    }
}
