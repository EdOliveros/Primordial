import React, { useState } from 'react';
import { Telemetry } from '../core/SimulationController';

interface InfoPanelProps {
    telemetry: Telemetry | null;
    onRegisterEvent?: (msg: string) => void;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ telemetry, onRegisterEvent }) => {
    const [isOpen, setIsOpen] = useState(false);

    const species = [
        { id: 1, name: 'Depredador', color: 'var(--neon-red)', icon: '🔴', desc: 'Busca activamente otras células. Alta tasa metabólica y agresividad extrema.' },
        { id: 2, name: 'Productor', color: 'var(--neon-green)', icon: '🟢', desc: 'Convierte la luz solar en energía con alta eficiencia. Base de la cadena alimenticia.' },
        { id: 3, name: 'Tanque', color: 'var(--neon-blue)', icon: '🔵', desc: 'Especializado en defensa. Difícil de cazar, aunque lento en sus movimientos.' },
        { id: 4, name: 'Velocista', color: '#ffffff', icon: '⚪', desc: 'Alta velocidad máxima. Capaz de huir de depredadores y colonizar nuevas áreas.' },
        { id: 0, name: 'Promedio', color: '#666', icon: '🔘', desc: 'Células sin una especialización genética clara. Versátiles pero no óptimas.' },
    ];

    const handleGeneClick = (code: string) => {
        if (!onRegisterEvent || !telemetry) return;

        let domSpecies = "Promedio";
        let flavor = "lidera en esta característica.";

        if (code === 'SPD') { domSpecies = "Velocista"; flavor = "es la más rápida del ecosistema."; }
        if (code === 'AGG') { domSpecies = "Depredador"; flavor = "domina en agresividad y combate."; }
        if (code === 'PHO') { domSpecies = "Productor"; flavor = "domina la producción de energía solar."; }
        if (code === 'DEF') { domSpecies = "Tanque"; flavor = "es la más resistente al daño."; }
        if (code === 'VIS') { domSpecies = "Depredador"; flavor = "tiene el mejor rango de visión."; }
        if (code === 'SIZ') { domSpecies = "Tanque"; flavor = "posee la mayor biomasa promedio."; }
        if (code === 'SOC') { domSpecies = "Productor"; flavor = "es la más sociable y forma colonias."; }
        if (code === 'MUT') { domSpecies = "Velocista"; flavor = "evoluciona más rápido que las demás."; }
        if (code === 'LIF') { domSpecies = "Tanque"; flavor = "es la más longeva."; }

        // Find count for context (mock logic for now as simplified mapping)
        const id = species.find(s => s.name === domSpecies)?.id || 0;
        const count = telemetry.archetypes[id] || 0;

        onRegisterEvent(`Análisis (${code}): La especie ${domSpecies} ${flavor} (${count} activos)`);
    };

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
                <div className="panel-header-row">
                    <h2>Guía de Especies</h2>
                    <button className="panel-close-btn" onClick={() => setIsOpen(false)}>✕</button>
                </div>

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

                <h2 style={{ marginTop: '30px' }}>Dominación Genética</h2>
                <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '15px', lineHeight: '1.4' }}>
                    Una especie alcanza la <strong>Dominación</strong> cuando el promedio de sus genes supera significativamente al resto del ecosistema, consolidando su rol en la cadena alimenticia.
                </div>

                <div className="glossary-list">
                    <div className="glossary-item">
                        <div className="glossary-header">
                            <span style={{ color: 'var(--neon-green)' }}>Adaptabilidad</span>
                            <small>Eficiencia</small>
                        </div>
                        <div className="glossary-bar"><div className="glossary-fill" style={{ width: '85%', background: 'var(--neon-green)' }}></div></div>
                        <p className="glossary-desc">Capacidad de sobrevivir con menos energía. Maestros del ahorro metabólico.</p>
                    </div>

                    <div className="glossary-item">
                        <div className="glossary-header">
                            <span style={{ color: 'var(--neon-red)' }}>Agresividad</span>
                            <small>Combate</small>
                        </div>
                        <div className="glossary-bar"><div className="glossary-fill" style={{ width: '90%', background: 'var(--neon-red)' }}></div></div>
                        <p className="glossary-desc">Fuerza para robar masa a otros. Indicador clave de depredadores.</p>
                    </div>

                    <div className="glossary-item">
                        <div className="glossary-header">
                            <span style={{ color: 'var(--neon-purple)' }}>Sociabilidad</span>
                            <small>Alianzas</small>
                        </div>
                        <div className="glossary-bar"><div className="glossary-fill" style={{ width: '75%', background: 'var(--neon-purple)' }}></div></div>
                        <p className="glossary-desc">Velocidad para formar colonias y alianzas defensivas.</p>
                    </div>

                    <div className="glossary-item">
                        <div className="glossary-header">
                            <span style={{ color: 'var(--neon-blue)' }}>Resiliencia</span>
                            <small>Recuperación</small>
                        </div>
                        <div className="glossary-bar"><div className="glossary-fill" style={{ width: '80%', background: 'var(--neon-blue)' }}></div></div>
                        <p className="glossary-desc">Tasa de regeneración de masa tras fragmentación o ataques.</p>
                    </div>
                </div>

                <h2 style={{ marginTop: '30px' }}>Manual de Genética de Especies</h2>
                <div className="genetics-glossary">
                    {[
                        { code: 'SPD', name: 'Speed', desc: 'Velocidad de desplazamiento. A mayor SPD, más rápido llegan a la comida, pero consumen energía más rápido.' },
                        { code: 'AGG', name: 'Aggression', desc: 'Instinto de ataque. Determina el daño que hacen al chocar con otras especies y su tendencia a iniciar combates.' },
                        { code: 'PHO', name: 'Photosynthesis', desc: 'Capacidad de generar energía pasiva con la luz (sin comer). Ideal para especies pacíficas.' },
                        { code: 'SIZ', name: 'Size', desc: 'Tamaño físico. Las células grandes son más resistentes pero más lentas y fáciles de detectar.' },
                        { code: 'DEF', name: 'Defense', desc: 'Resistencia al daño. Reduce la energía perdida cuando un depredador las ataca.' },
                        { code: 'VIS', name: 'Vision', desc: 'Rango de detección. Determina qué tan lejos pueden ver comida, aliados o enemigos.' },
                        { code: 'MUT', name: 'Mutation Rate', desc: 'Probabilidad de cambiar genes al dividirse. Una MUT alta crea especies que evolucionan (o mueren) rápido.' },
                        { code: 'LIF', name: 'Lifespan', desc: 'Esperanza de vida natural. Cuánto tiempo puede vivir una célula antes de morir por vejez.' }
                    ].map(g => (
                        <div key={g.code} className="genetics-item" onClick={() => handleGeneClick(g.code)} style={{ cursor: 'pointer' }}>
                            <div className="genetics-code">{g.code}</div>
                            <div className="genetics-details">
                                <div className="genetics-name">{g.name}</div>
                                <div className="genetics-desc">{g.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default React.memo(InfoPanel);
