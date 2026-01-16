import { PrimordialRenderer } from "../web/renderer";

export interface Telemetry {
    alive: number;
    births: number;
    deaths: number;
    generation: number;
    histogram: number[];
}

export class SimulationController {
    private canvas: HTMLCanvasElement;
    private renderer: PrimordialRenderer;
    private worker: Worker;
    private isWorkerReady = false;
    private isSimulationRunning = false;
    private lastRenderData: any = null;
    private frameCount = 0;
    private lastTime = performance.now();
    private fpsFrames = 0;
    private fpsTime = performance.now();

    public onTelemetry: (tel: Telemetry) => void = () => { };
    public onFPS: (fps: number) => void = () => { };
    public onFrame: (frameCount: number) => void = () => { };
    public onInspector: (cell: any) => void = () => { };

    public cameraPos: [number, number] = [1000, 1000]; // Default center (WORLD_SIZE is 2000)
    public zoom = 1.0;
    public targetZoom = 1.0;
    public followingIdx: number | null = null;
    public inspectedCell: any = null;

    private animationFrameId: number | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.renderer = new PrimordialRenderer(canvas);

        // In Vite, absolute path to worker is handled via URL constructor
        this.worker = new Worker(new URL("../simWorker.ts", import.meta.url), { type: "module" });

        this.setupWorker();
    }

    private setupWorker() {
        this.worker.postMessage({ type: "init", data: { worldSize: 2000, maxCells: 50000 } });

        this.worker.onmessage = (e) => {
            const { type, data } = e.data;
            if (type === "ready") this.isWorkerReady = true;
            if (type === "renderData") {
                this.lastRenderData = data;
                this.onTelemetry(data.telemetry);

                if (this.followingIdx !== null && this.inspectedCell) {
                    this.worker.postMessage({
                        type: "inspect",
                        data: { x: this.inspectedCell.x, y: this.inspectedCell.y, followedIdx: this.followingIdx }
                    });
                }
            }
            if (type === "inspectionResults") {
                if (data) {
                    this.inspectedCell = data;
                    this.onInspector(data);
                    if (this.followingIdx === data.idx) {
                        this.cameraPos[0] = data.x;
                        this.cameraPos[1] = data.y;
                    }
                }
            }
        };
    }

    public start(settings: { count: number, mutation: number, food: number, friction: number }) {
        if (!this.isWorkerReady) return;

        this.worker.postMessage({
            type: "applySettings", data: {
                mutationRate: settings.mutation,
                foodAbundance: settings.food,
                friction: settings.friction
            }
        });

        for (let i = 0; i < settings.count; i++) {
            this.worker.postMessage({
                type: "spawn", data: {
                    x: Math.random() * 2000, y: Math.random() * 2000,
                    genome: new Float32Array(8).map(() => Math.random())
                }
            });
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

    public inspect(x: number, y: number) {
        const rect = this.canvas.getBoundingClientRect();
        const nx = ((x - rect.left) / rect.width) * 2 - 1;
        const ny = ((y - rect.top) / rect.height) * 2 - 1;

        const vx = nx * (2000 * 0.5);
        const vy = ny * (2000 * 0.5);

        const worldX = vx / this.zoom + this.cameraPos[0];
        const worldY = vy / this.zoom + this.cameraPos[1];

        this.worker.postMessage({ type: "inspect", data: { x: worldX, y: worldY } });
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
        const dt = (now - this.lastTime) / 1000;
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
        this.worker.postMessage({ type: "update", data: { dt: Math.min(dt, 0.1) } });

        if (this.lastRenderData) {
            this.renderer.render(
                [2000, 2000],
                this.lastRenderData.positions,
                this.lastRenderData.colors,
                this.lastRenderData.count,
                this.cameraPos,
                this.zoom
            );
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    public resize(width: number, height: number) {
        this.canvas.width = width;
        this.canvas.height = height;
    }
}
