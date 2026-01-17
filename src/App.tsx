import React, { useState, useRef, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import InfoPanel from './components/InfoPanel';
import StartScreen from './components/StartScreen';
import { SimulationController, Telemetry } from './core/SimulationController';
import EventLog, { GameEvent } from './components/EventLog';

const App: React.FC = () => {
    const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
    const [fps, setFps] = useState(0);
    const [frameCount, setFrameCount] = useState(0);
    const [inspectedCell, setInspectedCell] = useState<any | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [uiVisible, setUiVisible] = useState(true);
    const [events, setEvents] = useState<GameEvent[]>([]);

    const controllerRef = useRef<SimulationController | null>(null);

    // Global Key Listener for "Cinematic Mode"
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'h') {
                setUiVisible(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleEvent = (text: string) => {
        const newEvent: GameEvent = {
            id: Date.now() + Math.random(),
            text,
            type: text.includes('Alianza') ? 'success' : text.includes('Hito') ? 'milestone' : 'info',
            timestamp: Date.now()
        };

        setEvents(prev => {
            const list = [...prev, newEvent];
            if (list.length > 5) list.shift(); // Keep max 5
            return list;
        });

        // Auto remove
        setTimeout(() => {
            setEvents(prev => prev.filter(e => e.id !== newEvent.id));
        }, 5000);
    };

    const handleStart = (settings: { count: number, mutation: number, food: number, friction: number }) => {
        if (controllerRef.current) {
            controllerRef.current.onEvent = handleEvent; // Hook event listener
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

            {!isRunning ? (
                <StartScreen onStart={handleStart} />
            ) : (
                <div style={{
                    opacity: uiVisible ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: 'none', // Allow clicks to pass through to Canvas
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 10
                }}>
                    <div style={{ pointerEvents: 'auto' }}>
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
                    </div>

                    <div style={{ pointerEvents: 'auto' }}>
                        <InfoPanel telemetry={telemetry} />
                    </div>

                    {/* Event Log receives no pointer events (click-through) */}
                    <EventLog events={events} />
                </div>
            )}
        </div>
    );
};

export default App;
