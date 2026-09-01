import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AivaState } from './aiva-provider';

interface AivaOrbProps {
  state: AivaState;
  className?: string;
  onClick?: () => void;
}

export function AivaOrb({ state, className, onClick }: AivaOrbProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative flex items-center justify-center rounded-full transition-all duration-300',
        'w-full h-full', // Take the size from the parent className
        onClick && 'cursor-pointer hover:scale-105 active:scale-95',
        className
      )}
    >
      {/* Background glowing sphere */}
      <div
        className={cn(
          'absolute inset-0 rounded-full transition-all duration-500 bg-white',
          state === 'idle' && 'shadow-[0_0_15px_rgba(255,255,255,0.3)]',
          state === 'listening' && 'shadow-[0_0_20px_rgba(255,255,255,0.8)]',
          state === 'thinking' && 'shadow-[0_0_20px_rgba(255,255,255,0.6)]',
          state === 'working' && 'shadow-[0_0_15px_rgba(255,255,255,0.5)]',
          state === 'speaking' && 'shadow-[0_0_25px_rgba(255,255,255,0.7)]',
          state === 'confirming' && 'shadow-[0_0_20px_rgba(255,255,255,0.6)]',
          state === 'completed' && 'shadow-[0_0_15px_rgba(255,255,255,0.5)]',
          state === 'error' && 'shadow-[0_0_15px_rgba(255,255,255,0.8)]'
        )}
        style={{
          animation:
            state === 'idle' ? 'aiva-orb-idle 3s ease-in-out infinite' :
            state === 'listening' ? 'aiva-orb-listen 2s ease-in-out infinite' :
            state === 'error' ? 'aiva-shake 0.5s ease-in-out' : 'none',
        }}
      />

      {/* State-specific inner animations */}
      <AnimatePresence mode="wait">
        {state === 'listening' && (
          <motion.div
            key="listening"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute flex items-center justify-center gap-[2px]"
          >
            <div className="aiva-waveform-bar w-1 bg-black rounded-full" />
            <div className="aiva-waveform-bar w-1 bg-black rounded-full" />
            <div className="aiva-waveform-bar w-1 bg-black rounded-full" />
            <div className="aiva-waveform-bar w-1 bg-black rounded-full" />
            <div className="aiva-waveform-bar w-1 bg-black rounded-full" />
          </motion.div>
        )}

        {state === 'thinking' && (
          <motion.div
            key="thinking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ animation: 'aiva-orbit 3s linear infinite' }}
          >
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black rounded-full shadow-[0_0_4px_black]" />
            <div className="absolute bottom-2 right-2 w-1.5 h-1.5 bg-gray-800 rounded-full shadow-[0_0_4px_black]" />
          </motion.div>
        )}

        {state === 'working' && (
          <motion.svg
            key="working"
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 270 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
            className="absolute inset-0 w-full h-full text-black/80 p-[2px]"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeDasharray="283"
              style={{ animation: 'aiva-dash 1.5s ease-in-out infinite' }}
            />
          </motion.svg>
        )}

        {state === 'speaking' && (
          <motion.div
            key="speaking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="absolute w-[120%] h-[120%] border-2 border-white/60 rounded-full" style={{ animation: 'aiva-ripple 1.5s ease-out infinite' }} />
            <div className="absolute w-[120%] h-[120%] border-2 border-white/40 rounded-full" style={{ animation: 'aiva-ripple 1.5s ease-out infinite 0.5s' }} />
            <div className="absolute w-[120%] h-[120%] border-2 border-white/20 rounded-full" style={{ animation: 'aiva-ripple 1.5s ease-out infinite 1s' }} />
            {/* Inner pulsing black dot for the speaker effect */}
            <div className="absolute w-3 h-3 bg-black rounded-full" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
          </motion.div>
        )}

        {state === 'confirming' && (
          <motion.div
            key="confirming"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </motion.div>
        )}

        {state === 'completed' && (
          <motion.div
            key="completed"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute flex items-center justify-center"
          >
            <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}

        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute flex items-center justify-center text-black"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
               <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
