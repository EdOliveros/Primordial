import React, { useEffect, useRef } from 'react';

interface MinimapProps {
    cameraPos: [number, number];
    zoom: number;
    onNavigate: (x: number, y: number) => void;
    worldSize: number;
}

const Minimap: React.FC<MinimapProps> = ({ cameraPos, zoom, onNavigate, worldSize }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const size = 180; // Size in pixels

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Static dark background
        ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
        ctx.fillRect(0, 0, size, size);

        // Optional: Add subtle grid pattern for visual interest
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.05)';
        ctx.lineWidth = 0.5;
        const gridSize = size / 10;
        for (let i = 0; i <= 10; i++) {
            ctx.beginPath();
            ctx.moveTo(i * gridSize, 0);
            ctx.lineTo(i * gridSize, size);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * gridSize);
            ctx.lineTo(size, i * gridSize);
            ctx.stroke();
        }

        // Draw Viewport Rectangle (View Box)
        const scale = size / worldSize;
        const viewW = (window.innerWidth / zoom) * scale;
        const viewH = (window.innerHeight / zoom) * scale;
        const viewX = (cameraPos[0]) * scale - viewW / 2;
        const viewY = (cameraPos[1]) * scale - viewH / 2;

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(viewX, viewY, viewW, viewH);

        // Map Border
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, size, size);

    }, [cameraPos, zoom, worldSize]);

    const handleClick = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const worldX = (clickX / size) * worldSize;
        const worldY = (clickY / size) * worldSize;

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
