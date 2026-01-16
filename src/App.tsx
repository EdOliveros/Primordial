import React, { useState, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import InfoPanel from './components/InfoPanel';
import { SimulationController, Telemetry } from './core/SimulationController';

const App: React.FC = () => {
    const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
    const [fps, setFps] = useState(0);
    const [frameCount, setFrameCount] = useState(0);
    const [inspectedCell, setInspectedCell] = useState<any | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    const controllerRef = useRef<SimulationController | null>(null);

    const handleStart = (settings: { count: number, mutation: number, food: number, friction: number }) => {
        if (controllerRef.current) {
            controllerRef.current.start(settings);
            setIsRunning(true);
        }
    };

    const handleFollow = () => {
        controllerRef.current?.follow();
    };

    const handleDismiss = () => {
        controllerRef.current?.dismissInspector();
        setInspectedCell(null);
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <GameCanvas
                onTelemetry={setTelemetry}
                onFPS={setFps}
                onFrame={setFrameCount}
                onInspector={setInspectedCell}
                controllerRef={controllerRef}
            />
            <UIOverlay
                telemetry={telemetry}
                fps={fps}
                frameCount={frameCount}
                inspectedCell={inspectedCell}
                isSimulationRunning={isRunning}
                onStart={handleStart}
                onFollow={handleFollow}
                onDismiss={handleDismiss}
            />
            <InfoPanel telemetry={telemetry} />
        </div>
    );
};

export default App;
