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

            const handleResize = () => {
                controller.resize(window.innerWidth, window.innerHeight);
            };

            window.addEventListener('resize', handleResize);
            handleResize();

            return () => {
                controller.stop();
                window.removeEventListener('resize', handleResize);
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
            style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        />
    );
};

export default GameCanvas;
