import React, { useState } from 'react';

interface StartScreenProps {
    onStart: (settings: { count: number, mutation: number, food: number, friction: number }) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
    const [settings, setSettings] = useState({
        count: 5000,
        mutation: 1.0,
        food: 1.0,
        friction: 0.98
    });

    const [isExiting, setIsExiting] = useState(false);

    const handleInitiate = () => {
        setIsExiting(true);
        // Delay the start slightly to allow for an exit animation if needed
        setTimeout(() => {
            onStart(settings);
        }, 800);
    };

    return (
        <div id="start-screen" className={isExiting ? 'exit' : ''}>
            <div className="config-card">
                <div className="logo-area">
                    <div className="logo-orb"></div>
                    <h1>PRIMORDIAL</h1>
                    <span className="subtitle">Evolution Simulator</span>
                </div>

                <div className="slider-group">
                    <div className="slider-header">
                        <span>Población Inicial</span>
                        <span className="value-tag">{settings.count.toLocaleString()}</span>
                    </div>
                    <input
                        type="range"
                        min="1000"
                        max="20000"
                        step="500"
                        value={settings.count}
                        onChange={(e) => setSettings({ ...settings, count: parseInt(e.target.value) })}
                    />
                </div>

                <div className="slider-group">
                    <div className="slider-header">
                        <span>Recursos del Mundo</span>
                        <span className="value-tag">{settings.food.toFixed(1)}x</span>
                    </div>
                    <input
                        type="range"
                        min="0.1"
                        max="5.0"
                        step="0.1"
                        value={settings.food}
                        onChange={(e) => setSettings({ ...settings, food: parseFloat(e.target.value) })}
                    />
                </div>

                <div className="slider-group">
                    <div className="slider-header">
                        <span>Velocidad de Mutación</span>
                        <span className="value-tag">{settings.mutation.toFixed(1)}x</span>
                    </div>
                    <input
                        type="range"
                        min="0.1"
                        max="5.0"
                        step="0.1"
                        value={settings.mutation}
                        onChange={(e) => setSettings({ ...settings, mutation: parseFloat(e.target.value) })}
                    />
                </div>

                <button className="btn-launch" onClick={handleInitiate}>
                    INICIAR SIMULACIÓN
                </button>

                <div className="footer-credits">
                    <p>Powered by Artificial Intelligence</p>
                    <div className="ai-chips">
                        <span>Gemini</span>
                        <span>Antigravity</span>
                    </div>
                </div>
            </div>

            <div className="bg-blur-layer"></div>
        </div>
    );
};

export default StartScreen;
