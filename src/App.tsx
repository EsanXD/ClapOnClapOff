import React, { useState, useEffect, useRef } from 'react';
import ControlPanel from './components/ControlPanel';
import ClapAnalyzer from './components/ClapAnalyzer';
import LampDemo from './components/LampDemo';
import { useClapDetection, type EngineId } from './hooks/useClapDetection';
import { exportEventsToCSV } from './utils/csvExport';
import { Microscope, PlayCircle, Upload, Loader2, FileAudio } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import './App.css';

const App: React.FC = () => {
  const [lightOn, setLightOn] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [primaryEngineId, setPrimaryEngineId] = useState<EngineId>('hybrid');
  const [viewMode, setViewMode] = useState<'diagnostic' | 'demo'>('diagnostic');
  const [isPulseActive, setIsPulseActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    isAnalyzing,
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
    analyzeFile,
    simulateClap,
    addManualEvent,
    deleteEvent,
    analyser
  } = useClapDetection({
    sensitivity,
    primaryEngineId,
    onDoubleClap: toggleStatus
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setViewMode('diagnostic');
      await analyzeFile(file);
    }
  };

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
        
        <div className="header-actions">
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

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="audio/*" 
            className="hidden-file-input"
          />
          <button 
            className={`upload-btn ${isAnalyzing ? 'analyzing' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={18} className="spin" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <Upload size={18} />
                <span>Upload Session</span>
              </>
            )}
          </button>
        </div>

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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <LampDemo isOn={lightOn} />
              </motion.div>
            ) : (
              <motion.div
                key="diagnostic"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
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
            <div className="card-header">
              {isAnalyzing ? <FileAudio size={20} /> : <Microscope size={20} />}
              <h3>{isAnalyzing ? 'Analyzing PCM Data' : 'System Intelligence'}</h3>
            </div>
            <p className="description">
              {isAnalyzing 
                ? 'Performing high-speed forensic scan of spectral density and RMS transients (up to 60s).' 
                : (viewMode === 'demo' 
                    ? 'The Lamp responds to localized acoustic transients in the 2kHz-5kHz band.' 
                    : 'The Matrix provides high-speed telemetry from multiple parallel engines.')}
            </p>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        Professional Audio Forensic & Diagnostic Workspace v5.5
      </footer>
    </div>
  );
};

export default App;
