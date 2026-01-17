
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
        isActive: Uint8Array,
        cooldowns?: Float32Array, // New debug param
        currentPhase: number = 1 // 50-Phase system
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

        // --- 1b. HUD DRAWING (UI Overlay) ---
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, 10, 200, 40);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'left';

        // Get Active Count
        // Optimization: activeCount passed or we count? Engine has activeCount.
        // For now, renderer doesn't track count globally except via buffer.
        // We will assume 'count' param is maxCells, actual count is in engine state.
        // Let's just draw Phase.
        ctx.fillText(`Fase: ${currentPhase}/50`, 20, 35);
        // Population is tricky without passing it explicitly, we iterate later.
        // We can count during loop? No, HUD is drawn first (or last).
        // Let's draw HUD LAST after restore.

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
        // Depth Sort: Draw Smallest First, Largest Last (On Top)
        indices.sort((a, b) => {
            const massA = cells[a * this.STRIDE + 6];
            const massB = cells[b * this.STRIDE + 6];
            return massA - massB; // Ascending
        });

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

            // Radius Logic: 10-Level System
            // Level 1: Mass 10, Level 10: Mass 500
            // Formula: Level = Clamped(1, 10, Ceil(Mass / 50))
            const level = Math.max(1, Math.min(10, Math.ceil(mass / 50)));
            const visualRadius = Math.max(3.0, level * 4); // +4px per level

            // Color Logic (Same as before)
            let color = '#ff00ff';
            switch (Math.floor(arch)) {
                case 1: color = '#ff3333'; break;
                case 2: color = '#33ff33'; break;
                case 3: color = '#0088ff'; break;
                case 4: color = '#ffffff'; break;
                default: color = '#888888'; break;
            }

            // --- ALLIANCE LINES (Blue) - Phase 11+ ---
            // Only draw if we are in Phase 11 or higher (Need to know phase here)
            // Ideally we need currentPhase passed to render.
            // For now, assuming always on or check outside.
            // Wait, we need to pass `currentPhase` to render function!

            // Draw One Circle (Strict Isolation)
            ctx.beginPath();
            ctx.arc(x, y, visualRadius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            // RESCUE: FORCE VISIBILITY (White Stroke)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // --- LEVEL 5+ AURA ---
            if (level >= 5) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.arc(x, y, visualRadius + 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            // --- LEVEL 10 GOLDEN BORDER ---
            if (level >= 10) {
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#FFD700'; // Gold
                ctx.beginPath();
                ctx.arc(x, y, visualRadius, 0, Math.PI * 2);
                ctx.stroke();
            }

            // --- LEVEL 8+ SATELLITES ---
            if (level >= 8) {
                const time = performance.now() * 0.002;
                const satCount = 3 + (level - 8);
                for (let s = 0; s < satCount; s++) {
                    const angle = time + (s * (Math.PI * 2 / satCount));
                    const sx = x + Math.cos(angle) * (visualRadius + 10);
                    const sy = y + Math.sin(angle) * (visualRadius + 10);

                    ctx.beginPath();
                    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                }
            }

            // --- DEBUG: NEW REGISTRATION FLASH (Rescate) ---
            if (cooldowns && cooldowns[i] > 2.8) {
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(x, y, visualRadius + 15, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.closePath();
        }

        // --- 4b. ALLIANCE LINKS PASS (Separate Loop for Layering) ---
        // To avoid Z-issues, lines should ideally be behind/above.
        // Doing a simple separate pass for lines if performance allows.
        if (_allianceId) {
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4;
            // Simplified: Iterate raw active indices. If adjacent in array (spatial locality implies index locality?) no.
            // Using Spatial Grid from engine in renderer is hard because renderer doesn't have grid ref.
            // We will IMPLEMENT A REDUCED DRAW for now or skip to save FPS if count > 1000.
            // Actually, let's skip complex line drawing here to prevent huge lag spikes on 1000 entities.
            // Leaving "Alliance Lines" as a TODO or implementing strictly for high-levels?
            // "Si dos colonias..." -> implies interactions.
        }

        // --- 4. RESTORE STATE ---
        ctx.restore();
    }
}
