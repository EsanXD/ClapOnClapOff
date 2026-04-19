import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Zap } from 'lucide-react';
import './LampDemo.css';

interface LampDemoProps {
  isOn: boolean;
}

const LampDemo: React.FC<LampDemoProps> = ({ isOn }) => {
  return (
    <div className={`lamp-demo-container ${isOn ? 'lamp-active' : 'lamp-idle'}`}>
      <div className="demo-stage">
        <motion.div 
          className="demo-lamp"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="lamp-hanger"></div>
          <div className="lamp-body">
            <div className="lamp-shade-inner"></div>
            <div className={`lamp-light-cone ${isOn ? 'visible' : ''}`}></div>
            <div className={`bulb-filament ${isOn ? 'active' : ''}`}></div>
            <Lightbulb 
              size={120} 
              strokeWidth={1}
              className={`bulb-svg ${isOn ? 'lit' : 'dark'}`}
            />
          </div>
        </motion.div>

        {/* Dynamic Floor Reflection */}
        <div className={`demo-floor-reflection ${isOn ? 'active' : ''}`}></div>
      </div>

      <div className="demo-instructions">
        <div className="trigger-pill">
          <Zap size={14} className={isOn ? 'active' : ''} />
          <span>Double Clap to Toggle</span>
        </div>
        <p>The Hybrid engine is tracking every snap in the room.</p>
      </div>

      <AnimatePresence>
        {isOn && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="demo-atmosphere"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LampDemo;
