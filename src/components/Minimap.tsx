import React, { useEffect, useRef } from 'react';

interface MinimapProps {
    cameraPos: [number, number];
    zoom: number;
    data: Float32Array | null;
    onNavigate: (x: number, y: number) => void;
    worldSize: number;
}

const Minimap: React.FC<MinimapProps> = ({ cameraPos, zoom, data, onNavigate, worldSize }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const size = 180; // Size in pixels

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, size, size);

        // Draw cells (if data exists)
        if (data) {
            ctx.fillStyle = 'rgba(0, 242, 255, 0.5)';
            const scale = size / worldSize;

            // The data is RGBA32F (4 floats per cell)
            // It's a 64x64 sample
            for (let i = 0; i < data.length; i += 4) {
                const x = (data[i] + worldSize / 2) * scale;
                const y = (data[i + 1] + worldSize / 2) * scale;

                // Only draw if within world bounds
                if (x >= 0 && x <= size && y >= 0 && y <= size) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }

        // Draw Viewport Rectangle
        const scale = size / worldSize;
        const viewW = (window.innerWidth / zoom) * scale;
        const viewH = (window.innerHeight / zoom) * scale;
        const viewX = (cameraPos[0] + worldSize / 2) * scale - viewW / 2;
        const viewY = (cameraPos[1] + worldSize / 2) * scale - viewH / 2;

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(viewX, viewY, viewW, viewH);

        // Map Border
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.3)';
        ctx.strokeRect(0, 0, size, size);

    }, [cameraPos, zoom, data, worldSize]);

    const handleClick = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const worldX = (clickX / size) * worldSize - worldSize / 2;
        const worldY = (clickY / size) * worldSize - worldSize / 2;

        onNavigate(worldX, worldY);
    };

    return (
        <div id="minimap-container">
            <canvas
                ref={canvasRef}
                width={size}
                height={size}
                onClick={handleClick}
            />
            <div className="minimap-label">NAVIGATOR</div>
        </div>
    );
};

export default Minimap;
