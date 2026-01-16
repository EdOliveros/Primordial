import { Engine } from "./engine";

/**
 * GodMode provides the "Modo Dios" API for user interaction.
 */
export class GodMode {
    private engine: Engine;

    constructor(engine: Engine) {
        this.engine = engine;
    }

    /**
     * Lanzar un 'Evento de Extinción' (elimina el 90% de las células aleatoriamente).
     */
    triggerExtinction() {
        console.log("GOD MODE: Triggering Extinction Event (90%)...");
        let removed = 0;
        // Iterate backwards because remove swaps
        for (let i = this.engine.storage.activeCells - 1; i >= 0; i--) {
            if (Math.random() < 0.9) {
                this.engine.storage.remove(i);
                removed++;
            }
        }
        console.log(`GOD MODE: Extinction complete. Removed ${removed} cells.`);
    }

    /**
     * Inyectar una 'Cepa Viral'. 
     * Virus cells have flag in metadata (stats[3] = 999).
     */
    injectViralStrain(count: number = 50) {
        console.log(`GOD MODE: Injecting Viral Strain (${count} cells)...`);
        const viralDNA = new Float32Array(8).fill(0.0);
        viralDNA[0] = 1.0; // Max speed
        viralDNA[1] = 1.0; // Max agg
        viralDNA[6] = 0.5; // High mutability

        for (let i = 0; i < count; i++) {
            const x = Math.random() * this.engine.worldSize;
            const y = Math.random() * this.engine.worldSize;
            const idx = this.engine.storage.spawn(x, y, viralDNA);
            if (idx !== -1) {
                // Metadata flag for virus
                this.engine.storage.stats[idx * 4 + 3] = 999;
            }
        }
    }

    /**
     * Modificar la 'Constante Solar' para inducir eras de hielo.
     */
    setSolarConstant(value: number) {
        console.log(`GOD MODE: Setting Solar Constant to ${value.toFixed(2)}`);
        this.engine.environment.solarConstant = value;
    }
}
