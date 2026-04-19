import React from 'react';
import { Mic, MicOff, Play, Activity, Layers, Target, Sparkles } from 'lucide-react';
import type { EngineId } from '../hooks/useClapDetection';
import './ControlPanel.css';

interface ControlPanelProps {
  isActive: boolean;
  onToggleMic: () => void;
  onSimulateClap: () => void;
  onToggleRecording: () => void;
  isRecording: boolean;
  sensitivity: number;
  setSensitivity: (val: number) => void;
  ambientLevel: number;
  brightness: number; // New live monitor
  primaryEngineId?: EngineId;
  setPrimaryEngineId?: (id: EngineId) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  isActive,
  onToggleMic,
  onSimulateClap,
  onToggleRecording,
  isRecording,
  sensitivity,
  setSensitivity,
  ambientLevel,
  brightness,
  primaryEngineId = 'rms',
  setPrimaryEngineId
}) => {

  const engines: { id: EngineId; name: string; icon: any; color: string }[] = [
    { id: 'rms', name: 'Standard (RMS)', icon: Activity, color: '#3b82f6' },
    { id: 'freq', name: 'Precision (Freq)', icon: Target, color: '#10b981' },
    { id: 'hybrid', name: 'Hybrid (Loud+Bright)', icon: Sparkles, color: '#a855f7' },
  ];

  // Helper for brightness class
  const getBrightnessStatus = () => {
    if (brightness > 0.6) return 'High/Crisp';
    if (brightness > 0.4) return 'Moderate';
    return 'Low/Warm';
  };

  return (
    <div className="control-panel">
      <div className="panel-section">
        <div className="section-header">
          <Activity size={18} />
          <h3>System Controls</h3>
        </div>
        <div className="button-grid">
          <button 
            className={`control-btn mic-btn ${isActive ? 'active' : ''}`}
            onClick={onToggleMic}
          >
            {isActive ? <Mic size={20} /> : <MicOff size={20} />}
            <span>{isActive ? 'Mic Active' : 'Start Mic'}</span>
          </button>

          <button 
            className={`control-btn rec-btn ${isRecording ? 'recording' : ''}`}
            onClick={onToggleRecording}
            disabled={!isActive}
          >
            <Layers size={20} />
            <span>{isRecording ? 'Recording...' : 'Record Test'}</span>
          </button>
        </div>
      </div>

      <div className="panel-section">
        <div className="section-header">
          <Target size={18} />
          <h3>Detection Engine</h3>
        </div>
        <div className="engine-selector">
          {engines.map((engine) => (
            <button
              key={engine.id}
              className={`engine-btn ${primaryEngineId === engine.id ? 'active' : ''}`}
              onClick={() => setPrimaryEngineId?.(engine.id)}
              style={{ '--engine-color': engine.color } as any}
            >
              <engine.icon size={16} />
              <span>{engine.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <div className="section-header">
          <Layers size={18} />
          <h3>Engine Calibration</h3>
        </div>
        
        {/* Sensitivity Slider */}
        <div className="slider-container">
          <div className="slider-labels">
            <span>Aggressive</span>
            <span>Filtering: {(sensitivity * 100).toFixed(0)}%</span>
            <span>Strict</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={sensitivity} 
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="sensitivity-slider"
          />
        </div>

        {/* Real-time Meters */}
        <div className="calibration-meters">
          <div className="meter-group">
            <div className="meter-labels">
              <span className="label">Room Noise Floor</span>
              <span className="val">{(ambientLevel * 1000).toFixed(1)}</span>
            </div>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${Math.min(100, ambientLevel * 1000)}%` }}></div>
            </div>
          </div>

          <div className="meter-group">
            <div className="meter-labels">
              <span className="label"><Sparkles size={12} /> Brightness Ratio</span>
              <span className="val">{getBrightnessStatus()}</span>
            </div>
            <div className="meter-track brightness">
              <div 
                className="meter-fill brightness" 
                style={{ 
                  width: `${Math.min(100, brightness * 100)}%`,
                  background: brightness > 0.4 ? '#10b981' : '#3b82f6'
                }}
              ></div>
            </div>
            <div className="meter-meta">Targets 2kHz - 5kHz band</div>
          </div>
        </div>
      </div>

      <div className="panel-section">
        <button className="simulate-btn" onClick={onSimulateClap} disabled={!isActive}>
          <Play size={16} fill="white" />
          Quick Test (Trigger Clap)
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
