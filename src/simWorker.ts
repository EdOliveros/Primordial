import { Engine } from "./core/engine";

let engine: Engine;

self.onmessage = (e: MessageEvent) => {
    const { type, data } = e.data;

    if (type === "init") {
        const { worldSize, maxCells } = data;
        engine = new Engine(worldSize, maxCells);
        self.postMessage({ type: "ready" });
    }

    if (type === "spawn") {
        engine.storage.spawn(data.x, data.y, data.genome);
    }

    if (type === "applySettings") {
        engine.applySettings(data);
    }

    if (type === "inspect") {
        const result = engine.getNearestCell(data.x, data.y, data.followedIdx);
        self.postMessage({ type: "inspectionResults", data: result });
    }

    if (type === "update") {
        const { dt } = data;
        engine.update(dt);

        // Pass visual data and telemetry back to main thread
        const visual = engine.getVisualData();
        const telemetry = engine.getTelemetry();
        self.postMessage({
            type: "renderData",
            data: {
                positions: visual.positions,
                colors: visual.colors,
                count: visual.count,
                telemetry
            }
        }, [visual.positions.buffer, visual.colors.buffer] as any);
    }
};
