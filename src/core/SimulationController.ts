import { PrimordialRenderer } from "../web/renderer";
import { GpuEngine } from "./GpuEngine";
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
    private gpuEngine: GpuEngine;
    private engine: Engine; // CPU Engine for high-perf Step 2
    private isSimulationRunning = false;
    private frameCount = 0;
    private lastTime = performance.now();
    private fpsFrames = 0;
    private fpsTime = performance.now();

    private settings = { mutation: 1.0, food: 1.0, friction: 0.98 };

    public onTelemetry: (tel: Telemetry) => void = () => { };
    public onFPS: (fps: number) => void = () => { };
    public onFrame: (frameCount: number) => void = () => { };
    public onInspector: (cell: any) => void = () => { };

    public cameraPos: [number, number] = [1000, 1000];
    public zoom = 1.0;
    public targetZoom = 1.0;
    public followingIdx: number | null = null;
    public inspectedCell: any = null;

    private animationFrameId: number | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.renderer = new PrimordialRenderer(canvas);
        const gl = (this.renderer as any).gl as WebGL2RenderingContext;
        this.gpuEngine = new GpuEngine(gl, 1000000);
        this.engine = new Engine(2000, 100000); // Optimized for 100k as per prompt
    }

    public start(settings: { count: number, mutation: number, food: number, friction: number }) {
        this.settings = settings;
        this.engine.applySettings({
            mutationRate: settings.mutation,
            foodAbundance: settings.food,
            friction: settings.friction
        });

        // Initialize cells on CPU Storage (Paso 1 Optimization)
        for (let i = 0; i < Math.min(settings.count, 100000); i++) {
            const genome = new Float32Array(8).map(() => Math.random());
            this.engine.storage.spawn(
                Math.random() * 2000,
                Math.random() * 2000,
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

    public onMinimapData: (data: Float32Array) => void = () => { };

    public setCameraPos(x: number, y: number) {
        this.cameraPos = [x, y];
        this.targetZoom = this.zoom;
    }

    public pan(dx: number, dy: number) {
        this.cameraPos[0] -= dx / this.zoom;
        this.cameraPos[1] -= dy / this.zoom;
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

        this.zoom += (this.targetZoom - this.zoom) * 0.05;

        // 1. Step Simulation on CPU (Optimized AOS Buffer)
        this.engine.update(dt);

        // 2. Render via WebGL Instanced Attributes (Step 2)
        // Passes the CPU-side dataBuffer directly for a single draw call.
        this.renderer.render(
            [this.canvas.width, this.canvas.height],
            this.engine.storage.dataBuffer,
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
    }
}
