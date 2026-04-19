import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import './Room.css';

interface RoomProps {
  isOn: boolean;
}

const Room: React.FC<RoomProps> = ({ isOn }) => {
  return (
    <div className={`room-container ${isOn ? 'light-on' : 'light-off'}`}>
      <div className="wall-back"></div>
      <div className="floor"></div>
      
      <div className="lamp-setup">
        <motion.div 
          className="lamp-fixture"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="lamp-cord"></div>
          <div className="lamp-head">
            <div className="lamp-shade"></div>
            <div className={`bulb-glow ${isOn ? 'active' : ''}`}></div>
            <Lightbulb 
              className={`lamp-icon ${isOn ? 'bulb-on' : 'bulb-off'}`} 
              size={48} 
              strokeWidth={1.5}
            />
          </div>
        </motion.div>
        
        {/* Shadow of the lamp on the floor */}
        <div className={`lamp-shadow ${isOn ? 'visible' : 'hidden'}`}></div>
      </div>

      <div className="furniture">
        <div className="table"></div>
        <div className="chair"></div>
      </div>

      <AnimatePresence>
        {isOn && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="room-glow"
          />
        )}
      </AnimatePresence>

      <div className="vignette"></div>
    </div>
  );
};

export default Room;
