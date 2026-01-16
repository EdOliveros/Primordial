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

    public cameraPos: [number, number] = [2500, 2500]; // Center of 5000x5000 world
    public zoom = 1.0;
    public targetZoom = 1.0;
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
        this.engine = new Engine(5000, 100000);
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
                Math.random() * 5000,
                Math.random() * 5000,
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
        this.targetZoom = this.zoom;
    }

    public pan(dx: number, dy: number) {
        this.cameraPos[0] -= dx / this.zoom;
        this.cameraPos[1] -= dy / this.zoom;
    }

    public setKeyState(key: string, pressed: boolean) {
        if (key in this.keyState) {
            (this.keyState as any)[key] = pressed;
        }
    }

    private updateKeyboardMovement() {
        // Zoom-adaptive speed: slower when zoomed in, faster when zoomed out
        const baseSpeed = 10;
        const speed = baseSpeed / this.zoom;

        let dx = 0;
        let dy = 0;

        if (this.keyState.w || this.keyState.ArrowUp) dy -= speed;
        if (this.keyState.s || this.keyState.ArrowDown) dy += speed;
        if (this.keyState.a || this.keyState.ArrowLeft) dx -= speed;
        if (this.keyState.d || this.keyState.ArrowRight) dx += speed;

        if (dx !== 0 || dy !== 0) {
            this.cameraPos[0] += dx;
            this.cameraPos[1] += dy;
        }
    }

    public handleZoom(delta: number, mouseX: number, mouseY: number) {
        const rect = this.canvas.getBoundingClientRect();
        const vx = (mouseX - rect.left - rect.width / 2);
        const vy = (mouseY - rect.top - rect.height / 2);

        const wx = this.cameraPos[0] + vx / this.zoom;
        const wy = this.cameraPos[1] + vy / this.zoom;

        const zoomFactor = delta > 0 ? 0.9 : 1.1;
        this.targetZoom = Math.max(0.1, Math.min(10.0, this.targetZoom * zoomFactor));

        const nextZoom = this.targetZoom;
        this.cameraPos[0] = wx - vx / nextZoom;
        this.cameraPos[1] = wy - vy / nextZoom;
    }

    public async inspect(worldX: number, worldY: number) {
        // CPU Picking for Step 2 (Direct access to engine data)
        const cell = this.engine.getNearestCell(worldX, worldY);
        this.inspectedCell = cell;
        this.onInspector(cell);
    }

    public follow() {
        if (this.inspectedCell) {
            this.followingIdx = this.inspectedCell.idx;
            this.targetZoom = 4.0;
        }
    }

    public dismissInspector() {
        this.followingIdx = null;
        this.targetZoom = 1.0;
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
        if (now > this.fpsTime + 1000) {
            this.onFPS(this.fpsFrames);
            this.fpsFrames = 0;
            this.fpsTime = now;
        }

        // Update keyboard-based camera movement
        this.updateKeyboardMovement();

        this.zoom += (this.targetZoom - this.zoom) * 0.05;

        // 1. Step Simulation on CPU (Optimized AOS Buffer)
        this.engine.update(dt);

        // 2. Render via WebGL Instanced Attributes (Step 2)
        // Passes the CPU-side cells buffer directly for a single draw call.
        this.renderer.render(
            [this.canvas.width, this.canvas.height],
            this.engine.storage.cells,
            this.engine.storage.maxCells,
            this.cameraPos,
            this.zoom
        );

        // 3. UI Updates
        if (this.frameCount % 60 === 0) {
            const tel = this.engine.getTelemetry();
            this.onTelemetry(tel);
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    public resize(width: number, height: number) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.renderer.resize(width, height);
    }
}
