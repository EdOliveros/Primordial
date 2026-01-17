import React, { useState } from 'react';
import { Telemetry } from '../core/SimulationController';

interface InfoPanelProps {
    telemetry: Telemetry | null;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ telemetry }) => {
    const [isOpen, setIsOpen] = useState(false);

    const species = [
        { id: 1, name: 'Depredador', color: 'var(--neon-red)', icon: '🔴', desc: 'Busca activamente otras células. Alta tasa metabólica y agresividad extrema.' },
        { id: 2, name: 'Productor', color: 'var(--neon-green)', icon: '🟢', desc: 'Convierte la luz solar en energía con alta eficiencia. Base de la cadena alimenticia.' },
        { id: 3, name: 'Tanque', color: 'var(--neon-blue)', icon: '🔵', desc: 'Especializado en defensa. Difícil de cazar, aunque lento en sus movimientos.' },
        { id: 4, name: 'Velocista', color: '#ffffff', icon: '⚪', desc: 'Alta velocidad máxima. Capaz de huir de depredadores y colonizar nuevas áreas.' },
        { id: 0, name: 'Promedio', color: '#666', icon: '🔘', desc: 'Células sin una especialización genética clara. Versátiles pero no óptimas.' },
    ];

    const total = telemetry?.archetypes.reduce((a, b) => a + b, 0) || 0;

    // CSS Pie Chart calculation (conic-gradient)
    let cumulativePercent = 0;
    const gradient = species.map(s => {
        const count = telemetry?.archetypes[s.id] || 0;
        const percent = total > 0 ? (count / total) * 100 : 0;
        const start = cumulativePercent;
        cumulativePercent += percent;
        return `${s.color} ${start}% ${cumulativePercent}%`;
    }).join(', ');

    return (
        <div className={`info-panel ${isOpen ? 'open' : ''}`} style={{ pointerEvents: 'auto' }}>
            <button
                className={`panel-toggle-btn ${isOpen ? 'active' : ''}`}
                style={{ top: '0', left: '-50px', background: 'var(--bg-blur)' }}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? '✕' : '📖'}
            </button>

            <div className="panel-content">
                <h2>Guía de Especies</h2>

                <div className="chart-container">
                    <div className="pie-chart" style={{ background: total > 0 ? `conic-gradient(${gradient})` : '#333' }}>
                        <div className="pie-center">
                            <span>{total.toLocaleString()}</span>
                            <small>Células</small>
                        </div>
                    </div>
                </div>

                <div className="species-list">
                    {species.map(s => {
                        const count = telemetry?.archetypes[s.id] || 0;
                        const percent = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                        return (
                            <div key={s.id} className="species-item" style={{ borderLeftColor: s.color }}>
                                <div className="species-header">
                                    <span className="species-name">{s.icon} {s.name}</span>
                                    <span className="species-count">{percent}%</span>
                                </div>
                                <p className="species-desc">{s.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default React.memo(InfoPanel);
