import React, { useState, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import ClapAnalyzer from './components/ClapAnalyzer';
import LampDemo from './components/LampDemo';
import { useClapDetection, type EngineId } from './hooks/useClapDetection';
import { exportEventsToCSV } from './utils/csvExport';
import { Microscope, PlayCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import './App.css';

const App: React.FC = () => {
  const [lightOn, setLightOn] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [primaryEngineId, setPrimaryEngineId] = useState<EngineId>('hybrid');
  const [viewMode, setViewMode] = useState<'diagnostic' | 'demo'>('demo');
  const [isPulseActive, setIsPulseActive] = useState(false);

  // visual feedback pulse
  useEffect(() => {
    if (lightOn) {
      setIsPulseActive(true);
      const timer = setTimeout(() => setIsPulseActive(false), 400);
      return () => clearTimeout(timer);
    }
  }, [lightOn]);

  const toggleStatus = () => {
    setLightOn(prev => !prev);
  };

  const {
    isActive,
    isRecording,
    ambientLevel,
    brightness,
    sessionEvents,
    recordedBlob,
    currentTime,
    setCurrentTime,
    setSessionEvents,
    start,
    stop,
    startRecording,
    stopRecording,
    simulateClap,
    addManualEvent,
    deleteEvent,
    analyser
  } = useClapDetection({
    sensitivity,
    primaryEngineId,
    onDoubleClap: toggleStatus
  });

  const toggleFalsePositive = (id: string) => {
    setSessionEvents(prev => prev.map(ev => 
      ev.id === id ? { ...ev, isFalsePositive: !ev.isFalsePositive } : ev
    ));
  };

  const handleExport = () => {
    exportEventsToCSV(sessionEvents);
  };

  return (
    <div className={`app-main ${isPulseActive ? 'pulse-active' : ''}`}>
      <header className="app-header">
        <div className="header-left">
          <h1>ClapOn <span className="logo-dot">.</span></h1>
          <p>Interactive Diagnostic Studio</p>
        </div>
        
        <nav className="view-switcher">
          <button 
            className={`nav-btn ${viewMode === 'demo' ? 'active' : ''}`} 
            onClick={() => setViewMode('demo')}
          >
            <PlayCircle size={18} /> Live Demo
          </button>
          <button 
            className={`nav-btn ${viewMode === 'diagnostic' ? 'active' : ''}`} 
            onClick={() => setViewMode('diagnostic')}
          >
            <Microscope size={18} /> Diagnostic
          </button>
        </nav>

        <div className={`status-indicator ${lightOn ? 'on' : 'off'}`}>
          <div className="status-dot"></div>
          <span>Trigger: {lightOn ? 'ACTIVE' : 'IDLE'}</span>
        </div>
      </header>

      <main className="app-content">
        <div className="view-section">
          <AnimatePresence mode="wait">
            {viewMode === 'demo' ? (
              <motion.div
                key="demo"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <LampDemo isOn={lightOn} />
              </motion.div>
            ) : (
              <motion.div
                key="diagnostic"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ClapAnalyzer 
                  blob={recordedBlob}
                  events={sessionEvents}
                  isRecording={isRecording}
                  analyser={analyser}
                  onToggleFalsePositive={toggleFalsePositive}
                  onAddManualEvent={addManualEvent}
                  onDeleteEvent={deleteEvent}
                  onExportCSV={handleExport}
                  currentTime={currentTime}
                  setCurrentTime={setCurrentTime}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="control-section">
          <ControlPanel 
            isActive={isActive}
            onToggleMic={isActive ? stop : start}
            onSimulateClap={simulateClap}
            onToggleRecording={isRecording ? stopRecording : startRecording}
            isRecording={isRecording}
            sensitivity={sensitivity}
            setSensitivity={setSensitivity}
            ambientLevel={ambientLevel}
            brightness={brightness}
            primaryEngineId={primaryEngineId}
            setPrimaryEngineId={setPrimaryEngineId}
          />
          
          <div className="research-status-card">
            <h3>System Intelligence</h3>
            <p className="description">
              {viewMode === 'demo' 
                ? 'The Lamp is calibrated to respond to localized acoustic transients in the 2kHz-5kHz band.' 
                : 'The Diagnostic Matrix provides parallel telemetry from Standard and Precision engines.'}
            </p>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        Acoustic Telemetry & Lighting Logic v5.1
      </footer>
    </div>
  );
};

export default App;
