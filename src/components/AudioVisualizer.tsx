import React, { useRef, useEffect } from 'react';
import './AudioVisualizer.css';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  currentLevel: number;
  ambientLevel: number;
  sensitivity: number;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyser, currentLevel, ambientLevel, sensitivity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataArray = useRef<Float32Array | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!analyser) return;
    
    const bufferLength = analyser.fftSize;
    dataArray.current = new Float32Array(bufferLength);

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas || !dataArray.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      analyser.getFloatTimeDomainData(dataArray.current as any);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      
      // Draw background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3b82f6';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray.current[i] * 5.0; // scale up for visibility
        const y = (v * height / 2) + (height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Draw Threshold Line
      const threshold = ambientLevel + (0.3 * (1.1 - sensitivity));
      const thresholdY = height - (threshold * height * 5); // Rough scaling
      
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0, thresholdY);
      ctx.lineTo(width, thresholdY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.font = '10px Inter';
      ctx.fillText('Clap Threshold', 10, thresholdY - 5);

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, ambientLevel, sensitivity]);

  return (
    <div className="visualizer-container">
      <div className="visualizer-stats">
        <div className="stat">
          <span className="label">Clap Energy</span>
          <div className="bar-bg">
            <div 
              className="bar-fill" 
              style={{ width: `${Math.min(currentLevel * 1000, 100)}%`, backgroundColor: currentLevel > (ambientLevel + 0.3 * (1.1 - sensitivity)) ? '#ef4444' : '#3b82f6' }}
            ></div>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} width={600} height={150} className="waveform-canvas"></canvas>
    </div>
  );
};

export default AudioVisualizer;
