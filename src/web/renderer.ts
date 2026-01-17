
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
        allianceId: Int32Array | undefined,
        isActive: Uint8Array,
        cooldowns?: Float32Array,
        currentPhase: number = 1,
        victoryMessage?: string
    ) {
        const ctx = this.ctx;
        const width = viewportSize[0];
        const height = viewportSize[1];

        if (width <= 0 || height <= 0) return;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // --- CAMERA TRANSFORM ---
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-cameraPos[0], -cameraPos[1]);

        // --- 1. ALLIANCE LINES PASS ---
        // Restricted to: Same Species AND Same Level
        if (allianceId) {
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = '#3366ff'; // Alliance Blue

            // We need a fast way to find alliance partners. 
            // Since we don't have a spatial grid here, we iterate active pairs? 
            // No, that's O(N^2). We iterate and map by allianceId.
            const groups: Map<number, number[]> = new Map();
            for (let i = 0; i < count; i++) {
                if (isActive[i] && allianceId[i] !== -1) {
                    const id = allianceId[i];
                    if (!groups.has(id)) groups.set(id, []);
                    groups.get(id)!.push(i);
                }
            }

            for (const members of groups.values()) {
                if (members.length < 2) continue;
                for (let j = 0; j < members.length; j++) {
                    for (let k = j + 1; k < members.length; k++) {
                        const idxA = members[j];
                        const idxB = members[k];
                        const offA = idxA * this.STRIDE;
                        const offB = idxB * this.STRIDE;

                        // Constraint: Same Species & Same Level
                        const specA = cells[offA + 7];
                        const specB = cells[offB + 7];
                        if (specA !== specB) continue;

                        const massA = cells[offA + 6];
                        const massB = cells[offB + 6];
                        const lvlA = this.getLevel(massA);
                        const lvlB = this.getLevel(massB);
                        if (lvlA !== lvlB) continue;

                        ctx.beginPath();
                        ctx.moveTo(cells[offA], cells[offA + 1]);
                        ctx.lineTo(cells[offB], cells[offB + 1]);
                        ctx.stroke();
                    }
                }
            }
            ctx.globalAlpha = 1.0;
        }

        // --- 2. DRAW ENTITIES (DEPTH SORTED) ---
        const indices: number[] = [];
        for (let i = 0; i < count; i++) if (isActive[i]) indices.push(i);

        indices.sort((a, b) => cells[a * this.STRIDE + 6] - cells[b * this.STRIDE + 6]);

        for (const i of indices) {
            const offset = i * this.STRIDE;
            const x = cells[offset];
            const y = cells[offset + 1];
            const mass = cells[offset + 6];
            const arch = cells[offset + 5];

            const level = this.getLevel(mass);
            const visualRadius = Math.max(3.0, level * 4);

            let color = '#ff00ff';
            switch (Math.floor(arch)) {
                case 1: color = '#ff3333'; break;
                case 2: color = '#33ff33'; break;
                case 3: color = '#0088ff'; break;
                case 4: color = '#ffffff'; break;
                default: color = '#888888'; break;
            }

            ctx.beginPath();
            ctx.arc(x, y, visualRadius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = (mass > 50 || level > 1) ? 3 : 1;
            ctx.stroke();

            if (level >= 5) {
                ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.globalAlpha = 0.3;
                ctx.beginPath(); ctx.arc(x, y, visualRadius + 5, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
            if (level >= 10) {
                ctx.lineWidth = 4; ctx.strokeStyle = '#FFD700';
                ctx.beginPath(); ctx.arc(x, y, visualRadius, 0, Math.PI * 2); ctx.stroke();
            }
            if (level >= 8) {
                const time = performance.now() * 0.002;
                const satCount = 3 + (level - 8);
                for (let s = 0; s < satCount; s++) {
                    const angle = time + (s * (Math.PI * 2 / satCount));
                    ctx.beginPath();
                    ctx.arc(x + Math.cos(angle) * (visualRadius + 10), y + Math.sin(angle) * (visualRadius + 10), 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff'; ctx.fill();
                }
            }
            if (cooldowns && cooldowns[i] > 2.8) {
                ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(x, y, visualRadius + 15, 0, Math.PI * 2); ctx.stroke();
            }
        }

        ctx.restore();

        // --- 3. HUD PASS (Fixed Screen Space) ---
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(10, 10, 240, 50);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(`FASE: ${currentPhase}/50`, 25, 42);

        if (victoryMessage) {
            ctx.fillStyle = 'rgba(0, 50, 0, 0.8)';
            ctx.fillRect(width / 2 - 250, 100, 500, 60);
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(victoryMessage, width / 2, 140);
        }
        ctx.restore();
    }

    private getLevel(mass: number): number {
        if (mass < 50) return 1;
        if (mass > 1000) return 10;
        return Math.floor(2 + (mass - 50) * 8 / 950);
    }
}
