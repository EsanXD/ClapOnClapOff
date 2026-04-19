import { useState, useEffect, useRef, useCallback } from 'react';

export type EngineId = 'rms' | 'freq' | 'hybrid' | 'manual';

export interface ClapEvent {
  id: string;
  timestamp: number;
  type: 'peak' | 'clap' | 'toggle';
  origin: 'system' | 'manual';
  engineId: EngineId;
  interval?: number;
  ambientLevel: number;
  sensitivity: number;
  brightness?: number;
  isFalsePositive: boolean;
}

interface ClapDetectionOptions {
  sensitivity?: number;
  minClapInterval?: number;
  maxClapInterval?: number;
  primaryEngineId?: EngineId;
  onClap?: (count: number) => void;
  onDoubleClap?: () => void;
}

export const useClapDetection = (options: ClapDetectionOptions = {}) => {
  const {
    sensitivity = 0.5,
    minClapInterval = 150,
    maxClapInterval = 500,
    primaryEngineId = 'hybrid', // Default to the most balanced engine
    onClap,
    onDoubleClap
  } = options;

  const [isActive, setIsActive] = useState(false);
  const [isRecording, _setIsRecording] = useState(false);
  const [ambientLevel, setAmbientLevel] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [sessionEvents, setSessionEvents] = useState<ClapEvent[]>([]);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Refs for real-time loop logic
  const isRecordingRef = useRef(false);
  const sensitivityRef = useRef(sensitivity);
  const primaryEngineRef = useRef<EngineId>(primaryEngineId);
  const ambientLevelRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  
  // Per-engine state trackers
  const lastClapTimes = useRef<Record<EngineId, number>>({ rms: 0, freq: 0, hybrid: 0, manual: 0 });
  const clapCounts = useRef<Record<EngineId, number>>({ rms: 0, freq: 0, hybrid: 0, manual: 0 });

  // Audio Graph Nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rawAnalyserRef = useRef<AnalyserNode | null>(null);
  const freqAnalyserRef = useRef<AnalyserNode | null>(null);
  const hpFilterRef = useRef<BiquadFilterNode | null>(null);
  const lpFilterRef = useRef<BiquadFilterNode | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ambientHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    primaryEngineRef.current = primaryEngineId;
  }, [primaryEngineId]);

  const setIsRecording = (val: boolean) => {
    isRecordingRef.current = val;
    _setIsRecording(val);
  };

  const handleClap = useCallback((now: number, engineId: EngineId, isManual: boolean = false, extraData?: { timestamp?: number, brightness?: number }) => {
    const currentIsRecording = isRecordingRef.current;
    
    const currentStartTime = startTimeRef.current;
    const timestamp = isManual ? (extraData?.timestamp || 0) : (currentIsRecording ? (now - currentStartTime) / 1000 : 0);
    const lastTime = lastClapTimes.current[engineId];
    
    // Calculate interval using real time (now) for system claps so it works without recording
    const timeSinceLast = isManual 
      ? (timestamp * 1000 - (lastTime * 1000)) 
      : (now - lastTime);
    
    let eventType: 'clap' | 'toggle' = 'clap';

    if (timeSinceLast < maxClapInterval && timeSinceLast > minClapInterval) {
      eventType = 'toggle';
      if (!isManual) {
        clapCounts.current[engineId] = 0;
        lastClapTimes.current[engineId] = 0;
      }
      
      if (engineId === primaryEngineRef.current || isManual) {
        if (onDoubleClap) onDoubleClap();
      }
    } else if (!isManual) {
      clapCounts.current[engineId] = 1;
      lastClapTimes.current[engineId] = now;
      if (engineId === primaryEngineRef.current && onClap) onClap(1);
    } else {
      lastClapTimes.current[engineId] = timestamp;
    }

    // Only commit to session events if we are actively recording or it's a manual override
    if (currentIsRecording || isManual) {
      const newEvent: ClapEvent = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp,
        type: eventType,
        origin: isManual ? 'manual' : 'system',
        engineId,
        ambientLevel: ambientLevelRef.current,
        sensitivity: sensitivityRef.current,
        brightness: extraData?.brightness,
        isFalsePositive: false
      };

      if (eventType === 'toggle') {
        newEvent.interval = Math.round(timeSinceLast);
      }

      setSessionEvents(prev => [...prev, newEvent].sort((a, b) => a.timestamp - b.timestamp));
    }
  }, [maxClapInterval, minClapInterval, onClap, onDoubleClap]);

  const calculateRMS = (analyser: AnalyserNode) => {
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    return Math.sqrt(sum / buffer.length);
  };

  const tick = useCallback(() => {
    if (!rawAnalyserRef.current || !freqAnalyserRef.current) return;

    const rms = calculateRMS(rawAnalyserRef.current);
    const freqRMS = calculateRMS(freqAnalyserRef.current);

    const currentBrightness = freqRMS / (rms + 0.001);
    setBrightness(currentBrightness);
    setCurrentLevel(rms);

    ambientHistoryRef.current.push(rms);
    if (ambientHistoryRef.current.length > 50) ambientHistoryRef.current.shift();
    const avgAmbient = ambientHistoryRef.current.reduce((a, b) => a + b, 0) / ambientHistoryRef.current.length;
    ambientLevelRef.current = avgAmbient;
    setAmbientLevel(avgAmbient);

    const now = Date.now();
    const sens = sensitivityRef.current;
    
    // Thresholds
    const volumeThreshold = avgAmbient + (0.3 * (1.1 - sens));
    const brightnessThreshold = 0.45 + (0.25 * (1.1 - sens));

    const isLoud = rms > volumeThreshold;
    const isBright = currentBrightness > brightnessThreshold;

    // Engine 1: RMS Standard (Strict volume)
    if (isLoud && now - lastClapTimes.current.rms > minClapInterval) {
      handleClap(now, 'rms');
    }

    // Engine 2: Precision Freq (Strict brightness)
    if (isBright && freqRMS > (volumeThreshold * 0.4) && now - lastClapTimes.current.freq > minClapInterval) {
      handleClap(now, 'freq', false, { brightness: currentBrightness });
    }

    // Engine 3: Balanced Hybrid (The Sweet Spot)
    // Lenient on volume (threshold * 0.8) BUT requires brightness
    const isLoudEnoughForHybrid = rms > (volumeThreshold * 0.8);
    if (isLoudEnoughForHybrid && isBright && now - lastClapTimes.current.hybrid > minClapInterval) {
      handleClap(now, 'hybrid', false, { brightness: currentBrightness });
    }

    requestRef.current = requestAnimationFrame(tick);
  }, [minClapInterval, maxClapInterval, handleClap]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      
      const rawAnalyser = audioContext.createAnalyser();
      rawAnalyser.fftSize = 2048;
      source.connect(rawAnalyser);
      rawAnalyserRef.current = rawAnalyser;

      const hpFilter = audioContext.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.value = 1800;
      const lpFilter = audioContext.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency.value = 5000;
      const freqAnalyser = audioContext.createAnalyser();
      freqAnalyser.fftSize = 2048;
      source.connect(hpFilter);
      hpFilter.connect(lpFilter);
      lpFilter.connect(freqAnalyser);
      freqAnalyserRef.current = freqAnalyser;
      hpFilterRef.current = hpFilter;
      lpFilterRef.current = lpFilter;

      setIsActive(true);
      requestRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error('Mic access failed', err);
      setIsActive(false);
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    setSessionEvents([]);
    setRecordedBlob(null);
    chunksRef.current = [];
    startTimeRef.current = Date.now();
    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mediaRecorder.onstop = () => setRecordedBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const stop = () => {
    stopRecording();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    setIsActive(false);
  };

  return {
    isActive, isRecording, ambientLevel, currentLevel, brightness, sessionEvents, recordedBlob,
    currentTime, setCurrentTime, setSessionEvents, start, stop, startRecording, stopRecording,
    simulateClap: () => handleClap(Date.now(), primaryEngineRef.current),
    addManualEvent: (t: number) => handleClap(0, 'manual', true, { timestamp: t }),
    deleteEvent: (id: string) => setSessionEvents(p => p.filter(e => e.id !== id)),
    analyser: rawAnalyserRef.current
  };
};
