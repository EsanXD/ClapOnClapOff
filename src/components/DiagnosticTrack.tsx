import React, { useState } from 'react';
import type { ClapEvent, EngineId } from '../hooks/useClapDetection';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import './DiagnosticTrack.css';

interface DiagnosticTrackProps {
  events: ClapEvent[];
  duration: number;
  onToggleFalsePositive: (id: string) => void;
  onDeleteEvent: (id: string) => void;
}

const DiagnosticTrack: React.FC<DiagnosticTrackProps> = ({ 
  events, 
  duration,
  onToggleFalsePositive,
  onDeleteEvent
}) => {
  const [activePopup, setActivePopup] = useState<string | null>(null);

  const getPosition = (timestamp: number) => {
    return (timestamp / duration) * 100;
  };

  const lanes: { id: EngineId; label: string }[] = [
    { id: 'manual', label: 'Ground Truth' },
    { id: 'rms', label: 'Standard (RMS)' },
    { id: 'freq', label: 'Precision (Freq)' },
    { id: 'hybrid', label: 'Hybrid (Loud+Bright)' },
  ];

  return (
    <div className="diagnostic-track-container">
      {lanes.map((lane) => (
        <div key={lane.id} className={`track-lane lane-${lane.id}`}>
          <div className="lane-label">{lane.label}</div>
          <div className="lane-rail">
            {events.filter(e => e.engineId === lane.id).map((event) => {
              const pos = getPosition(event.timestamp);
              
              return (
                <React.Fragment key={event.id}>
                  {/* Bracket for Toggles */}
                  {event.type === 'toggle' && event.interval && (
                    <div 
                      className="lane-bracket"
                      style={{ 
                        left: `${getPosition(event.timestamp - event.interval / 1000)}%`, 
                        width: `${getPosition(event.interval / 1000)}%` 
                      }}
                      onClick={() => setActivePopup(event.id)}
                    >
                      <span>{event.interval}ms</span>
                    </div>
                  )}

                  {/* Marker Bar (The Signal) */}
                  <div 
                    className={`lane-bar ${event.type} ${event.isFalsePositive ? 'invalid' : ''}`}
                    style={{ left: `${pos}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopup(event.id);
                    }}
                  >
                    {activePopup === event.id && (
                      <div className="marker-popup" onClick={(e) => e.stopPropagation()}>
                        <div className="popup-header">
                          <span className="popup-title">{event.origin === 'manual' ? 'Missed Detection' : 'System Detection'}</span>
                          <button onClick={() => setActivePopup(null)} className="close-btn"><X size={14} /></button>
                        </div>
                        <div className="popup-content">
                          <div className="info-row">
                            <span className="label">Result:</span>
                            <span className={`val status-ok`}>TRIGGER: {event.type.toUpperCase()}</span>
                          </div>
                          
                          <div className="popup-actions">
                            <button 
                              className={`action-btn ${event.isFalsePositive ? 'btn-solve' : 'btn-warn'}`}
                              onClick={() => onToggleFalsePositive(event.id)}
                            >
                              <AlertTriangle size={14} />
                              {event.isFalsePositive ? 'Mark Correct' : 'Mark Invalid'}
                            </button>
                            <button 
                              className="action-btn btn-danger"
                              onClick={() => {
                                onDeleteEvent(event.id);
                                setActivePopup(null);
                              }}
                            >
                              <Trash2 size={14} />
                              Delete Event
                            </button>
                          </div>
                        </div>
                        <div className="popup-arrow"></div>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DiagnosticTrack;
