
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
        _allianceId?: Int32Array
    ) {
        const ctx = this.ctx;
        const width = viewportSize[0];
        const height = viewportSize[1];

        // 1. Clear Screen
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // 2. Setup Camera Transform
        ctx.save();

        // Center the camera:
        // Move to center of screen
        ctx.translate(width / 2, height / 2);
        // Apply Zoom
        ctx.scale(zoom, zoom);
        // Move camera to world position (so cameraPos becomes 0,0)
        ctx.translate(-cameraPos[0], -cameraPos[1]);

        // 3. Draw Entities
        // Implementa un bucle que recorra todas las entidades
        for (let i = 0; i < count; i++) {
            const offset = i * this.STRIDE;

            // Extract Entity Properties
            const x = cells[offset];
            const y = cells[offset + 1];

            // Check for valid position to avoid drawing artifacts
            if (Number.isNaN(x) || Number.isNaN(y)) continue;

            const energy = cells[offset + 4];
            if (energy <= 0) continue; // Skip dead

            const mass = cells[offset + 6];
            const arch = cells[offset + 5];

            // Calculate Radius (entity.radius)
            // Using shader logic: 8.0 * (1.0 + log(mass)) or similar, ensuring default of 5
            const safeMass = Math.max(1.0, mass);
            const radius = 8.0 * (1.0 + Math.log(safeMass) * 1.5);
            const visualRadius = radius || 5;

            // Determine Color (entity.color)
            let color = '#ff00ff'; // Default fallback
            switch (Math.floor(arch)) {
                case 1: color = '#ff3333'; break; // Predator (Red)
                case 2: color = '#33ff33'; break; // Producer (Green)
                case 3: color = '#0088ff'; break; // Tank (Blue)
                case 4: color = '#ffffff'; break; // Speedster (White)
                default: color = '#888888'; break; // Unknown
            }

            // Override for colonies/super-entities if needed, or based on mass
            if (mass > 2.0) {
                // ctx.shadowBlur = 10; // Simple glow for big ones (expensive?)
                // ctx.shadowColor = color;
            }

            // Draw
            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            ctx.arc(x, y, visualRadius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }

        // 4. Draw Alliances (Optional, if requested or to match previous feature)
        // User didn't strictly request this in the prompt, but it's good to keep.
        // However, user said "Eliminar el cuadro verde" and "Restaurar visibilidad".
        // I will keep the loop simple as requested.

        ctx.restore();
    }
}
