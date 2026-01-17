
export class PrimordialRenderer {
    private ctx: CanvasRenderingContext2D; // Changed to Canvas 2D
    private readonly STRIDE = 16; // Match engine stride

    constructor(canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext("2d", { alpha: false }); // Alpha false for perf
        if (!ctx) throw new Error("Canvas 2D not supported");
        this.ctx = ctx;
    }

    public resize(_w: number, _h: number) {
        // Canvas is resized by the controller/observer, we just need to ensure context knows?
        // In 2D, setting canvas.width/height clears the context automatically.
        // We don't need to do anything special here unless we cache dimensions.
    }

    render(
        viewportSize: [number, number],
        cells: Float32Array,
        count: number,
        cameraPos: [number, number],
        zoom: number,
        _allianceId: Int32Array | undefined,
        isActive: Uint8Array // New parameter
    ) {
        const ctx = this.ctx;
        const width = viewportSize[0];
        const height = viewportSize[1];

        // --- 0. SAFETY CHECK ---
        if (width <= 0 || height <= 0) return;

        // --- 1. STRICT FRAME START ---
        ctx.save();

        // Reset transform to identity to ensure clearRect covers the entire physical canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // SINGLE CLEAR PER FRAME
        ctx.clearRect(0, 0, width, height);

        // Optional: Draw background if not using transparency
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // --- 2. CAMERA TRANSFORM ---
        // Center of screen
        ctx.translate(width / 2, height / 2);
        // Apply Zoom
        ctx.scale(zoom, zoom);
        // Move to world position
        ctx.translate(-cameraPos[0], -cameraPos[1]);

        // --- 3. DRAW ENTITIES (DEPTH SORTED) ---
        // 3a. Create Index Array of Active Entities
        const indices: number[] = [];
        for (let i = 0; i < count; i++) {
            if (isActive[i] === 1) {
                indices.push(i);
            }
        }

        // 3b. Sort by Mass (Descending: Largest First -> Bottom Layer)
        // Accessing TypedArray inside sort is relatively fast for <10k entities
        indices.sort((a, b) => {
            const massA = cells[a * this.STRIDE + 6];
            const massB = cells[b * this.STRIDE + 6];
            return massB - massA;
        });

        // 3c. Draw Loop
        ctx.globalAlpha = 1.0; // Enforce Opaqueness

        for (const i of indices) {
            const offset = i * this.STRIDE;

            const x = cells[offset];
            const y = cells[offset + 1];

            // Validation
            if (Number.isNaN(x) || Number.isNaN(y)) continue;

            const energy = cells[offset + 4]; // Should be handled by isActive, but double check
            if (energy <= 0) continue;

            const mass = cells[offset + 6];
            const arch = cells[offset + 5];

            // Radius Logic (Same as before)
            const safeMass = Math.max(1.0, mass);
            const radius = 8.0 * (1.0 + Math.log(safeMass) * 1.5);
            const visualRadius = radius || 5;

            // Color Logic (Same as before)
            let color = '#ff00ff';
            switch (Math.floor(arch)) {
                case 1: color = '#ff3333'; break;
                case 2: color = '#33ff33'; break;
                case 3: color = '#0088ff'; break;
                case 4: color = '#ffffff'; break;
                default: color = '#888888'; break;
            }

            // Draw One Circle (Strict Isolation)
            ctx.beginPath();
            ctx.arc(x, y, visualRadius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.closePath(); // Explicit Close
        }

        // --- 4. RESTORE STATE ---
        ctx.restore();
    }
}
