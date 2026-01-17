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

    private animationFrameId: number | null = null;

    // Keyboard navigation state
    private keyState = {
        w: false, a: false, s: false, d: false,
        ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
    };

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.renderer = new PrimordialRenderer(canvas);
        // Ensure renderer starts with correct size
        this.renderer.resize(canvas.width, canvas.height);
        this.engine = new Engine(1000, 100000);
    }

    public start(settings: { count: number, mutation: number, food: number, friction: number }) {
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
    }

    public stop() {
        this.isSimulationRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
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

        const now = performance.now();
        const dt = Math.min(0.016, (now - this.lastTime) / 1000);
        this.lastTime = now;

        this.frameCount++;
        this.onFrame(this.frameCount);

        this.fpsFrames++;
        if (now > this.fpsTime + 500) { // Update FPS 2x per second
            this.onFPS(this.fpsFrames * 2); // Multiply by 2 since we're measuring half-second intervals
            this.fpsFrames = 0;
            this.fpsTime = now;
        }

        // Update keyboard-based camera movement
        this.updateKeyboardMovement();

        // Zoom logic removed

        // 1. Step Simulation on CPU (Optimized AOS Buffer)
        this.engine.update(dt);

        // 2. Render via WebGL Instanced Attributes (Step 2)
        // Passes the CPU-side cells buffer directly for a single draw call.
        this.renderer.render(
            [this.canvas.width, this.canvas.height],
            this.engine.storage.cells,
            this.engine.storage.maxCells,
            this.cameraPos,
            this.zoom,
            this.engine.storage.allianceId
        );

        // 3. UI Updates (throttled to 2x per second)
        if (this.frameCount % 30 === 0) { // Check frequently for smoother events
            const tel = this.engine.getTelemetry();

            // Check Milestones (every ~0.5s)
            if (this.frameCount % 300 === 0) { // Every ~5s to avoid spam
                this.checkMilestones(tel);
            }

            if (this.frameCount % 120 === 0) {
                this.onTelemetry(tel);
            }
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    private checkMilestones(tel: Telemetry) {
        if (tel.alive < 50) return; // Ignore early game

        const total = tel.archetypes.reduce((a, b) => a + b, 0);
        if (total === 0) return;

        const GENE_NAMES = ["Velocista", "Depredador", "Productor", "Tanque", "Velocista (Def)"]; // Simplified mapping

        // check extinction risk (< 5% but was previously existing)
        // Simplified check: Just dominant vs dying
        tel.archetypes.forEach((count, i) => {
            const pct = count / total;
            // 0: Speed, 1: Agg, 2: Photo, 3: Tank... (Indices match renderer/engine logic roughly)
            // Note: Tel archetypes array logic depends on engine implementation. 
            // Assuming 1=Agg, 2=Prod, 3=Tank based on renderer.

            if (pct > 0.8 && i > 0) {
                this.onEvent(`Hito: La especie ${GENE_NAMES[i]} domina el 80% del ecosistema.`);
            }
        });
    }

    public onEvent: (msg: string) => void = () => { };

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.renderer = new PrimordialRenderer(canvas);
        // Ensure renderer starts with correct size
        this.renderer.resize(canvas.width, canvas.height);
        this.engine = new Engine(1000, 100000);

        // Hook Engine Events
        this.engine.onEvent = (type, data) => {
            if (type === 'colony') {
                if (Math.random() > 0.7) { // Filter spam
                    this.onEvent(`La especie ${data.color} ha formado una super-colonia.`);
                }
            }
            if (type === 'alliance') {
                this.onEvent(`¡Alianza formada! 3 colonias ${data.color} cooperan.`);
            }
        };
    }
        this.canvas.width = width;
this.canvas.height = height;
this.renderer.resize(width, height);
    }
}
