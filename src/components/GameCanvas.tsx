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

            return () => {
                controller.stop();
                resizeObserver.disconnect();
            };
        }
    }, []);

    const handleClick = (e: React.MouseEvent) => {
        if (controllerRef.current) {
            controllerRef.current.inspect(e.clientX, e.clientY);
        }
    };

    return (
        <canvas
            ref={canvasRef}
            id="simCanvas"
            onClick={handleClick}
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
