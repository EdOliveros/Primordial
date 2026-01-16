import React from 'react';
import { Telemetry } from '../core/SimulationController';

interface UIOverlayProps {
    telemetry: Telemetry | null;
    fps: number;
    frameCount: number;
    inspectedCell: any | null;
    isSimulationRunning: boolean;
    onStart: (settings: { count: number, mutation: number, food: number, friction: number }) => void;
    onFollow: () => void;
    onDismiss: () => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({
    telemetry,
    fps,
    frameCount,
    inspectedCell,
    isSimulationRunning,
    onStart,
    onFollow,
    onDismiss
}) => {
    const [settings, setSettings] = React.useState({
        count: 5000,
        mutation: 1.0,
        food: 1.0,
        friction: 0.98
    });

    if (!isSimulationRunning) {
        return (
            <div id="start-screen">
                <div class="config-card">
                    <h1>Primordial</h1>
                    <div className="slider-group">
                        <div className="slider-header"><span>Initial Population</span><span>{settings.count}</span></div>
                        <input type="range" min="100" max="50000" step="100" value={settings.count}
                            onChange={(e) => setSettings({ ...settings, count: parseInt(e.target.value) })} />
                    </div>
                    <div className="slider-group">
                        <div className="slider-header"><span>Mutation Rate</span><span>{settings.mutation}x</span></div>
                        <input type="range" min="0" max="10" step="0.5" value={settings.mutation}
                            onChange={(e) => setSettings({ ...settings, mutation: parseFloat(e.target.value) })} />
                    </div>
                    <div className="slider-group">
                        <div className="slider-header"><span>Food Abundance</span><span>{settings.food}x</span></div>
                        <input type="range" min="0.1" max="5" step="0.1" value={settings.food}
                            onChange={(e) => setSettings({ ...settings, food: parseFloat(e.target.value) })} />
                    </div>
                    <div className="slider-group">
                        <div className="slider-header"><span>Environmental Friction</span><span>{settings.friction}</span></div>
                        <input type="range" min="0.8" max="1.0" step="0.01" value={settings.friction}
                            onChange={(e) => setSettings({ ...settings, friction: parseFloat(e.target.value) })} />
                    </div>
                    <button id="btn-start" onClick={() => onStart(settings)}>Initiate Biosphere</button>
                    <p style={{ marginTop: '20px', fontSize: '0.7rem', opacity: 0.5 }}>
                        Powered by Gemini & Antigravity AI
                    </p>
                </div>
            </div>
        );
    }

    const GENE_LABELS = ["SPD", "AGG", "PHO", "SIZ", "DEF", "VIS", "MUT", "LIF"];

    return (
        <>
            <div id="dashboard" className="visible" style={{ pointerEvents: 'auto' }}>
                <div className="header"><span>God Mode Console</span><span>GEN. {telemetry?.generation || 0}</span></div>
                <div className="metric-group">
                    <div className="metric"><span className="label">Population</span><span className="value">{telemetry?.alive.toLocaleString() || 0}</span></div>
                    <div className="metric"><span className="label">Births</span><span className="value" style={{ color: 'var(--neon-green)' }}>{telemetry?.births.toLocaleString() || 0}</span></div>
                    <div className="metric"><span className="label">Extinctions</span><span className="value" style={{ color: 'var(--neon-red)' }}>{telemetry?.deaths.toLocaleString() || 0}</span></div>
                    <div className="metric">
                        <span className="label">Stability</span>
                        <span className="value">{telemetry ? Math.max(0, 100 - (telemetry.deaths / (telemetry.births + 1)) * 10).toFixed(1) : 0}%</span>
                    </div>
                </div>
                <div className="label">Genetic Domination</div>
                <div id="gene-histogram">
                    {telemetry?.histogram.map((count, i) => {
                        const maxVal = Math.max(...telemetry.histogram) || 1;
                        return (
                            <div key={i} className="histo-bar-container">
                                <div className="histo-label">{GENE_LABELS[i]}</div>
                                <div className="histo-track">
                                    <div className="histo-fill" style={{ width: `${(count / maxVal) * 100}%` }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {inspectedCell && (
                <div id="inspector" style={{ display: 'block' }}>
                    <div className="inspector-header">
                        <div>
                            <div className="label" style={{ margin: 0 }}>Specimen</div>
                            <div className="value" style={{ fontSize: '0.9rem' }}>CELL #{inspectedCell.idx}</div>
                        </div>
                        <div className="specimen-tag">Gen {inspectedCell.generation}</div>
                    </div>

                    <div className="metric-group" style={{ marginBottom: '20px' }}>
                        <div className="metric"><span className="label">Energy</span><span className="value" style={{ color: 'var(--neon-green)' }}>{Math.floor(inspectedCell.energy)}</span></div>
                        <div className="metric"><span className="label">Health</span><span className="value" style={{ color: 'var(--neon-red)' }}>100%</span></div>
                    </div>

                    <div className="label" style={{ marginBottom: '10px' }}>Genetic Sequence</div>
                    <div className="dna-grid">
                        {inspectedCell.genome.map((val: number, i: number) => (
                            <div key={i} className="gene-slot">
                                <div className="gene-val">{(val * 100).toFixed(0)}</div>
                                <div className="gene-name">{GENE_LABELS[i]}</div>
                            </div>
                        ))}
                    </div>

                    <div className="inspector-actions">
                        <button className="btn-action" onClick={onFollow}>Follow</button>
                        <button className="btn-action" onClick={onDismiss}>Dismiss</button>
                    </div>
                </div>
            )}

            <div id="clock-panel" className="visible">
                <div className="label">Deep Time</div>
                <div className="time-value">YEAR {(frameCount / 200).toFixed(1)}</div>
            </div>
            <div id="fps-counter">FPS: {fps}</div>
        </>
    );
};

export default UIOverlay;
