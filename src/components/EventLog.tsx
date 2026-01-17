import React from 'react';

export interface GameEvent {
    id: number;
    text: string;
    type: 'info' | 'warning' | 'success' | 'milestone';
    timestamp: number;
}

interface EventLogProps {
    events: GameEvent[];
}

const EventLog: React.FC<EventLogProps> = ({ events }) => {
    return (
        <div className="event-log-container">
            {events.map((ev) => (
                <div key={ev.id} className={`event-toast ${ev.type}`}>
                    <div className="event-icon">
                        {ev.type === 'success' && '🌟'}
                        {ev.type === 'warning' && '⚠️'}
                        {ev.type === 'milestone' && '🧬'}
                        {ev.type === 'info' && 'ℹ️'}
                    </div>
                    <div className="event-content">
                        {ev.text}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default React.memo(EventLog);
