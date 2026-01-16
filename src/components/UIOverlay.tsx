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
    onFollow,
    onDismiss
}) => {
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

export default React.memo(UIOverlay);
