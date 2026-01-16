import React, { useEffect, useRef } from 'react';
import { SimulationController, Telemetry } from '../core/SimulationController';

interface GameCanvasProps {
    onTelemetry: (tel: Telemetry) => void;
    onFPS: (fps: number) => void;
    onFrame: (frameCount: number) => void;
    onInspector: (cell: any) => void;
    controllerRef: React.MutableRefObject<SimulationController | null>;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
    onTelemetry,
    onFPS,
    onFrame,
    onInspector,
    controllerRef
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDragging = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const isSpaceDown = useRef(false);

    useEffect(() => {
        if (canvasRef.current) {
            const controller = new SimulationController(canvasRef.current);
            controller.onTelemetry = onTelemetry;
            controller.onFPS = onFPS;
            controller.onFrame = onFrame;
            controller.onInspector = onInspector;

            controllerRef.current = controller;

            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const width = entry.contentRect.width;
                    const height = entry.contentRect.height;
                    controller.resize(width, height);
                }
            });

            if (canvasRef.current.parentElement) {
                resizeObserver.observe(canvasRef.current.parentElement);
            }

            // Keyboard tracking
            const handleKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') isSpaceDown.current = true; };
            const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') isSpaceDown.current = false; };
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);

            return () => {
                controller.stop();
                resizeObserver.disconnect();
                window.removeEventListener('keydown', handleKeyDown);
                window.removeEventListener('keyup', handleKeyUp);
            };
        }
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 2 || (e.button === 0 && isSpaceDown.current)) {
            isDragging.current = true;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        } else if (e.button === 0) {
            if (controllerRef.current) {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) {
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const worldX = controllerRef.current.cameraPos[0] + (x - rect.width / 2) / controllerRef.current.zoom;
                    const worldY = controllerRef.current.cameraPos[1] + (y - rect.height / 2) / controllerRef.current.zoom;
                    controllerRef.current.inspect(worldX, worldY);
                }
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging.current && controllerRef.current) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            controllerRef.current.pan(dx, dy);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (controllerRef.current) {
            controllerRef.current.handleZoom(e.deltaY, e.clientX, e.clientY);
        }
    };

    return (
        <canvas
            ref={canvasRef}
            id="simCanvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                display: 'block',
                cursor: 'crosshair',
                zIndex: 0,
                background: '#000'
            }}
        />
    );
};

export default GameCanvas;
