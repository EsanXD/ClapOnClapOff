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
    primaryEngineId = 'hybrid',
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const isRecordingRef = useRef(false);
  const sensitivityRef = useRef(sensitivity);
  const primaryEngineRef = useRef<EngineId>(primaryEngineId);
  const ambientLevelRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  
  const lastClapTimes = useRef<Record<EngineId, number>>({ rms: 0, freq: 0, hybrid: 0, manual: 0 });
  const clapCounts = useRef<Record<EngineId, number>>({ rms: 0, freq: 0, hybrid: 0, manual: 0 });

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

  const handleClap = useCallback((now: number, engineId: EngineId, isManual: boolean = false, extraData?: { timestamp?: number, brightness?: number, forceLog?: boolean }) => {
    const currentIsRecording = isRecordingRef.current;
    
    // In Offline Analysis (forceLog), we don't need real-time checks
    const isOffline = extraData?.forceLog;
    
    const currentStartTime = startTimeRef.current;
    const timestamp = isManual ? (extraData?.timestamp || 0) : (isOffline ? (extraData?.timestamp || 0) : (currentIsRecording ? (now - currentStartTime) / 1000 : 0));
    
    // For offline analysis, we use timestamps (seconds * 1000) for intervals
    const lastTime = lastClapTimes.current[engineId];
    const timeSinceLast = isManual 
      ? (timestamp * 1000 - (lastTime * 1000)) 
      : (isOffline ? (timestamp * 1000 - (lastTime * 1000)) : (now - lastTime));
    
    let eventType: 'clap' | 'toggle' = 'clap';

    if (timeSinceLast < maxClapInterval && timeSinceLast > minClapInterval) {
      eventType = 'toggle';
      if (!isManual && !isOffline) {
        clapCounts.current[engineId] = 0;
        lastClapTimes.current[engineId] = 0;
      } else if (isOffline) {
        lastClapTimes.current[engineId] = 0;
      }
      
      if ((engineId === primaryEngineRef.current || isManual) && !isOffline) {
        if (onDoubleClap) onDoubleClap();
      }
    } else if (!isManual) {
      clapCounts.current[engineId] = 1;
      lastClapTimes.current[engineId] = isOffline ? timestamp : now;
      if (engineId === primaryEngineRef.current && onClap && !isOffline) onClap(1);
    } else {
      lastClapTimes.current[engineId] = timestamp;
    }

    if (currentIsRecording || isManual || isOffline) {
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

      if (eventType === 'toggle') newEvent.interval = Math.round(timeSinceLast);
      setSessionEvents(prev => [...prev, newEvent].sort((a, b) => a.timestamp - b.timestamp));
    }
  }, [maxClapInterval, minClapInterval, onClap, onDoubleClap]);

  const analyzeFile = async (file: File) => {
    setIsAnalyzing(true);
    setSessionEvents([]);
    setRecordedBlob(file); // Set for visualization
    
    try {
      const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
      let audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
      
      // 60s Crop
      if (audioBuffer.duration > 60) {
        const sampleRate = audioBuffer.sampleRate;
        const newBuffer = tempCtx.createBuffer(1, sampleRate * 60, sampleRate);
        newBuffer.copyToChannel(audioBuffer.getChannelData(0).slice(0, sampleRate * 60), 0);
        audioBuffer = newBuffer;
      }

      // Offline render for filtered signal
      const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      
      const hp = offlineCtx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const lp = offlineCtx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5000;
      
      source.connect(hp);
      hp.connect(lp);
      lp.connect(offlineCtx.destination);
      source.start();
      
      const filteredBuffer = await offlineCtx.startRendering();
      await tempCtx.close();

      const rawSamples = audioBuffer.getChannelData(0);
      const filteredSamples = filteredBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // Processing Loop
      const windowSize = 2048;
      const stride = 512;
      
      // Reset detectors
      lastClapTimes.current = { rms: 0, freq: 0, hybrid: 0, manual: 0 };
      
      const ambientHistory: number[] = [];

      for (let i = 0; i < rawSamples.length - windowSize; i += stride) {
        const time = i / sampleRate;
        
        // Calculate RMS for window
        let rawSum = 0;
        let filteredSum = 0;
        for (let j = 0; j < windowSize; j++) {
          const r = rawSamples[i + j];
          const f = filteredSamples[i + j];
          rawSum += r * r;
          filteredSum += f * f;
        }
        const rms = Math.sqrt(rawSum / windowSize);
        const freqRMS = Math.sqrt(filteredSum / windowSize);
        const currentBrightness = freqRMS / (rms + 0.001);

        // Ambient Tracking
        ambientHistory.push(rms);
        if (ambientHistory.length > 50) ambientHistory.shift();
        const avgAmbient = ambientHistory.reduce((a, b) => a + b, 0) / ambientHistory.length;
        ambientLevelRef.current = avgAmbient; // Set level for handleClap

        const sens = sensitivityRef.current;
        const volumeThreshold = avgAmbient + (0.3 * (1.1 - sens));
        const brightnessThreshold = 0.45 + (0.25 * (1.1 - sens));

        const isLoud = rms > volumeThreshold;
        const isBright = currentBrightness > brightnessThreshold;

        // Firing Logic (Replicating tick logic)
        if (isLoud && (time * 1000 - lastClapTimes.current.rms * 1000) > minClapInterval) {
          handleClap(0, 'rms', false, { timestamp: time, brightness: currentBrightness, forceLog: true });
        }
        if (isBright && freqRMS > (volumeThreshold * 0.4) && (time * 1000 - lastClapTimes.current.freq * 1000) > minClapInterval) {
          handleClap(0, 'freq', false, { timestamp: time, brightness: currentBrightness, forceLog: true });
        }
        if (rms > (volumeThreshold * 0.8) && isBright && (time * 1000 - lastClapTimes.current.hybrid * 1000) > minClapInterval) {
          handleClap(0, 'hybrid', false, { timestamp: time, brightness: currentBrightness, forceLog: true });
        }
      }
    } catch (err) {
      console.error('Forensic analysis failed', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

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
    
    const volumeThreshold = avgAmbient + (0.3 * (1.1 - sens));
    const brightnessThreshold = 0.45 + (0.25 * (1.1 - sens));

    const isLoud = rms > volumeThreshold;
    const isBright = currentBrightness > brightnessThreshold;

    if (isLoud && now - lastClapTimes.current.rms > minClapInterval) {
      handleClap(now, 'rms');
    }
    if (isBright && freqRMS > (volumeThreshold * 0.4) && now - lastClapTimes.current.freq > minClapInterval) {
      handleClap(now, 'freq', false, { brightness: currentBrightness });
    }
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

      const hp = audioContext.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const lp = audioContext.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5000;
      const freqAnalyser = audioContext.createAnalyser();
      freqAnalyser.fftSize = 2048;
      source.connect(hp);
      hp.connect(lp);
      lp.connect(freqAnalyser);
      freqAnalyserRef.current = freqAnalyser;
      hpFilterRef.current = hp;
      lpFilterRef.current = lp;

      setIsActive(true);
      requestRef.current = requestAnimationFrame(tick);
    } catch (err) {
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
    isActive, isRecording, isAnalyzing, ambientLevel, currentLevel, brightness, sessionEvents, recordedBlob,
    currentTime, setCurrentTime, setSessionEvents, start, stop, startRecording, stopRecording, analyzeFile,
    simulateClap: () => handleClap(Date.now(), primaryEngineRef.current),
    addManualEvent: (t: number) => handleClap(0, 'manual', true, { timestamp: t }),
    deleteEvent: (id: string) => setSessionEvents(p => p.filter(e => e.id !== id)),
    analyser: rawAnalyserRef.current
  };
};
