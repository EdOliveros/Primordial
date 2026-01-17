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
            {events.map(event => (
                <div key={event.id} className={`event-message ${event.type}`}>
                    <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '0.7rem', opacity: 0.7 }}>
                        [{new Date(event.timestamp).toLocaleTimeString()}]
                    </div>
                    {event.text}
                </div>
            ))}
        </div>
    );
};

export default React.memo(EventLog);
