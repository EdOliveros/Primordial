import { PrimordialRenderer } from "../web/renderer";
import { GpuEngine } from "./GpuEngine";

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
        this.gpuEngine = new GpuEngine(gl, 1000000); // Scale to 1M cells
    }

    public start(settings: { count: number, mutation: number, food: number, friction: number }) {
        this.settings = settings;
        const maxCells = 1000000;
        const stride = 16;
        const size = Math.ceil(Math.sqrt(maxCells));

        // Single giant buffer for all initialization data
        const masterBuffer = new Float32Array(size * size * stride);

        for (let i = 0; i < settings.count; i++) {
            const offset = i * stride;
            masterBuffer[offset] = Math.random() * 2000;     // x
            masterBuffer[offset + 1] = Math.random() * 2000; // y
            masterBuffer[offset + 4] = 50.0;                 // Energy

            // Random genome for variety
            const g = new Float32Array(8).map(() => Math.random());

            // Determine archetype
            let arch = 0;
            if (g[1] > 0.7) arch = 1;
            else if (g[2] > 0.7) arch = 2;
            else if (g[4] > 0.7) arch = 3;
            else if (g[0] > 0.7) arch = 4;

            masterBuffer[offset + 5] = arch;

            // Genes 1-4
            masterBuffer[offset + 8] = g[0];
            masterBuffer[offset + 9] = g[1];
            masterBuffer[offset + 10] = g[2];
            masterBuffer[offset + 11] = g[3];

            // Genes 5-8
            masterBuffer[offset + 12] = g[4];
            masterBuffer[offset + 13] = g[5];
            masterBuffer[offset + 14] = g[6];
            masterBuffer[offset + 15] = g[7];
        }

        this.gpuEngine.uploadData(masterBuffer, stride);
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
        this.targetZoom = this.zoom; // Stop any auto-zoom
    }

    public pan(dx: number, dy: number) {
        // dx, dy are in screen pixels
        // Convert to world spaceDelta (divide by zoom)
        this.cameraPos[0] -= dx / this.zoom;
        this.cameraPos[1] -= dy / this.zoom;
    }

    public handleZoom(delta: number, mouseX: number, mouseY: number) {
        // 1. Get view-space position of mouse relative to canvas center
        const rect = this.canvas.getBoundingClientRect();
        const vx = (mouseX - rect.left - rect.width / 2);
        const vy = (mouseY - rect.top - rect.height / 2);

        // 2. Get world-space position under mouse before zoom
        const wx = this.cameraPos[0] + vx / this.zoom;
        const wy = this.cameraPos[1] + vy / this.zoom;

        // 3. Update target zoom
        const zoomFactor = delta > 0 ? 0.9 : 1.1;
        this.targetZoom = Math.max(0.1, Math.min(10.0, this.targetZoom * zoomFactor));

        // We use the current zoom to calculate the new camera position for 
        // immediate feedback, though targetZoom will catch up.
        // To make it feel perfect, we actually offset the camera based on the new zoom.
        const nextZoom = this.targetZoom;
        this.cameraPos[0] = wx - vx / nextZoom;
        this.cameraPos[1] = wy - vy / nextZoom;
    }

    public async inspect(worldX: number, worldY: number) {
        const cell = await this.gpuEngine.pick(worldX, worldY);
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

    private loop = async () => {
        if (!this.isSimulationRunning) return;

        const now = performance.now();
        // const dt = (now - this.lastTime) / 1000;
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

        // 1. Step Simulation on GPU
        this.gpuEngine.step([2000, 2000], this.settings.mutation, this.settings.food);

        // 2. Render from Textures
        this.renderer.render(
            [2000, 2000],
            this.gpuEngine.getStateTextures(),
            1000000, // Render 1M instances
            this.cameraPos,
            this.zoom
        );

        // 3. Optional: Read Telemetry (Throttled for performance)
        if (this.frameCount % 60 === 0) {
            const tel = await this.gpuEngine.getTelemetry();
            this.onTelemetry({
                alive: tel.total,
                births: 0,
                deaths: 0,
                generation: 0,
                histogram: [],
                archetypes: tel.counts
            });

            // Also send minimap data
            const miniData = await this.gpuEngine.getMinimapData();
            this.onMinimapData(miniData);
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    public resize(width: number, height: number) {
        this.canvas.width = width;
        this.canvas.height = height;
    }
}
