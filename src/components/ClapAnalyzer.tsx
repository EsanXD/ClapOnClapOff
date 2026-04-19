import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.esm.js';
import type { ClapEvent } from '../hooks/useClapDetection';
import { Play, Pause, RotateCcw, Download, PlusCircle, MousePointer2 } from 'lucide-react';
import DiagnosticTrack from './DiagnosticTrack';
import './ClapAnalyzer.css';

interface ClapAnalyzerProps {
  blob: Blob | null;
  events: ClapEvent[];
  isRecording: boolean;
  analyser: AnalyserNode | null;
  onToggleFalsePositive: (id: string) => void;
  onAddManualEvent: (timestamp: number) => void;
  onDeleteEvent: (id: string) => void;
  onExportCSV: () => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
}

const createColormap = () => {
  const stops = [[0, 0, 0, 1], [0, 0, 0.5, 1], [0, 0.5, 1, 1], [0, 1, 0, 1], [1, 1, 0, 1], [1, 0, 0, 1]];
  const colormap = [];
  const n = stops.length - 1;
  const step = 256 / n;
  for (let i = 0; i < n; i++) {
    const start = stops[i];
    const end = stops[i + 1];
    for (let j = 0; j < step; j++) {
      const t = j / step;
      colormap.push([
        Math.round(start[0] + (end[0] - start[0]) * t),
        Math.round(start[1] + (end[1] - start[1]) * t),
        Math.round(start[2] + (end[2] - start[2]) * t),
        start[3] + (end[3] - start[3]) * t,
      ]);
    }
  }
  while (colormap.length < 256) colormap.push(stops[stops.length - 1]);
  return colormap.slice(0, 256);
};

const HEATMAP_COLORMAP = createColormap();

const ClapAnalyzer: React.FC<ClapAnalyzerProps> = ({ 
  blob, 
  events,
  isRecording,
  analyser,
  onToggleFalsePositive,
  onAddManualEvent,
  onDeleteEvent,
  onExportCSV,
  currentTime,
  setCurrentTime
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const specRef = useRef<HTMLDivElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isAddMode, setIsAddMode] = useState(false);
  const [livePoints, setLivePoints] = useState<number[]>([]);

  // WaveSurfer Lifecycle
  useEffect(() => {
    if (!containerRef.current || !blob || isRecording) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4f4f4f',
      progressColor: '#3b82f6',
      cursorColor: 'transparent',
      cursorWidth: 0,
      barWidth: 2,
      barGap: 3,
      height: 100,
      normalize: false,
    });

    ws.registerPlugin(Spectrogram.create({
      labels: false,
      height: 150,
      container: specRef.current || undefined,
      colorMap: HEATMAP_COLORMAP,
      frequencyMin: 0,
      frequencyMax: 3500,
    }));
    
    waveSurferRef.current = ws;
    ws.loadBlob(blob);
    ws.on('ready', () => setDuration(ws.getDuration()));
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('timeupdate', (time) => setCurrentTime(time));
    
    ws.on('click', (progress) => {
      if (isAddMode) {
        onAddManualEvent(progress * ws.getDuration());
      }
    });

    return () => {
      ws.destroy();
      waveSurferRef.current = null;
    };
  }, [blob, isRecording, isAddMode]);

  // Live Rendering Logic
  useEffect(() => {
    if (!isRecording || !analyser) {
      setLivePoints([]);
      return;
    }

    let rafId: number;
    const startTime = Date.now();
    const points: number[] = [];

    const drawLive = () => {
      const bufferLength = analyser.fftSize;
      const dataArray = new Float32Array(bufferLength);
      analyser.getFloatTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      
      points.push(rms);
      setLivePoints([...points]);

      // Update current time for live pins sync
      const elapsed = (Date.now() - startTime) / 1000;
      setCurrentTime(elapsed);
      setDuration(Math.max(60, elapsed)); // Assume max 60s or current elapsed

      rafId = requestAnimationFrame(drawLive);
    };

    rafId = requestAnimationFrame(drawLive);
    return () => cancelAnimationFrame(rafId);
  }, [isRecording, analyser]);

  // Render Canvas
  useEffect(() => {
    if (!liveCanvasRef.current || !isRecording) return;
    const canvas = liveCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const maxPoints = (60 * 60); // 60fps * 60s
    const sliceWidth = canvas.width / maxPoints;
    let x = 0;

    livePoints.forEach((rms) => {
      const h = rms * canvas.height * 2;
      ctx.moveTo(x, canvas.height / 2 - h / 2);
      ctx.lineTo(x, canvas.height / 2 + h / 2);
      x += sliceWidth;
    });
    ctx.stroke();
  }, [livePoints, isRecording]);

  const handlePlayPause = () => {
    if (waveSurferRef.current) waveSurferRef.current.playPause();
  };

  const handleReset = () => {
    if (waveSurferRef.current) {
      waveSurferRef.current.stop();
      waveSurferRef.current.seekTo(0);
    }
  };

  return (
    <div className="analyzer-container">
      <div className="analyzer-header">
        <div className="header-titles">
          <h3>
            {isRecording && <span className="rec-dot"></span>}
            {isRecording ? 'Live Signal Analysis' : 'Signal Diagnostic Studio'}
          </h3>
          <span className="live-timestamp">{currentTime.toFixed(3)}s / {isRecording ? '60.000s' : duration.toFixed(3) + 's'}</span>
        </div>
        
        <div className="analyzer-actions">
          {!isRecording && blob && (
            <button 
              onClick={() => setIsAddMode(!isAddMode)} 
              className={`mode-btn ${isAddMode ? 'active' : ''}`}
              title={isAddMode ? 'Switch to Selection Mode' : 'Switch to Add Nodes Mode'}
            >
              {isAddMode ? <PlusCircle size={16} /> : <MousePointer2 size={16} />}
              {isAddMode ? 'Adding Node' : 'Select Mode'}
            </button>
          )}

          <div className="action-divider"></div>
          
          <button onClick={handleReset} className="icon-btn" title="Reset" disabled={isRecording}><RotateCcw size={16} /></button>
          <button onClick={handlePlayPause} className="play-btn" disabled={isRecording || !blob}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
          </button>
          <button onClick={onExportCSV} className="export-btn" disabled={isRecording || !blob}>
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      <div className={`analysis-view ${isRecording ? 'recording' : 'zen-mode'} ${isAddMode ? 'add-mode' : ''}`}>
        {isRecording ? (
          <canvas 
            ref={liveCanvasRef} 
            width={1200} 
            height={100} 
            className="live-waveform-canvas"
          />
        ) : (
          <div ref={containerRef} className="waveform-timeline"></div>
        )}
        
        {/* Tier 2: Spectrogram (Hidden during recording) */}
        {!isRecording && <div ref={specRef} className="spectrogram-container"></div>}
        
        {/* Tier 3: Diagnostic Track (Stays live!) */}
        <DiagnosticTrack 
          events={events} 
          duration={isRecording ? 60 : duration}
          onToggleFalsePositive={onToggleFalsePositive}
          onDeleteEvent={onDeleteEvent}
        />

        <div className="annotation-layer-overlay">
          <span>{isRecording ? 'LIVE RECORDING IN PROGRESS' : 'ZEN VIEW: USE DIAGNOSTIC TRACK'}</span>
        </div>
      </div>
      
      <div className="studio-footer-meta">
        {isRecording ? (
          <span className="live-status">System detecting claps in real-time...</span>
        ) : (
          <>
            <span>{isAddMode ? 'CLICK ON SIGNAL TO ADD MISSED CLAP' : 'CLICK PINS OR BRACKETS TO ANNOTATE'}</span>
            <span>|</span>
            <span>{isAddMode ? 'Nodes will be marked as "Manual"' : 'Toggle Node Mode in header'}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default ClapAnalyzer;
