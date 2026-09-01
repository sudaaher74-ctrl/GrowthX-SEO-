import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AivaState } from './aiva-provider';

interface AivaOrbProps {
  state: AivaState;
  className?: string;
  onClick?: () => void;
}

export function AivaOrb({ state, className, onClick }: AivaOrbProps) {
  // Determine if the orb should be large or small
  const isLarge = ['listening', 'thinking', 'working', 'speaking', 'confirming', 'error'].includes(state);

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative flex items-center justify-center rounded-full transition-all duration-300',
        isLarge ? 'w-24 h-24' : 'w-12 h-12',
        onClick && 'cursor-pointer hover:scale-105 active:scale-95',
        className
      )}
    >
      {/* Background glowing sphere */}
      <div
        className={cn(
          'absolute inset-0 rounded-full transition-all duration-500',
          state === 'idle' && 'bg-purple-600/80 shadow-[0_0_15px_rgba(124,58,237,0.5)]',
          state === 'listening' && 'bg-purple-600 shadow-[0_0_30px_rgba(124,58,237,0.8)]',
          state === 'thinking' && 'bg-indigo-600 shadow-[0_0_30px_rgba(79,70,229,0.8)]',
          state === 'working' && 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.8)]',
          state === 'speaking' && 'bg-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.8)]',
          state === 'confirming' && 'bg-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.8)]',
          state === 'completed' && 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)]',
          state === 'error' && 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)]'
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
            className="absolute flex items-center justify-center gap-1"
          >
            <div className="aiva-waveform-bar w-1.5 bg-white rounded-full" />
            <div className="aiva-waveform-bar w-1.5 bg-white rounded-full" />
            <div className="aiva-waveform-bar w-1.5 bg-white rounded-full" />
            <div className="aiva-waveform-bar w-1.5 bg-white rounded-full" />
            <div className="aiva-waveform-bar w-1.5 bg-white rounded-full" />
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
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]" />
            <div className="absolute bottom-4 right-4 w-2 h-2 bg-indigo-300 rounded-full shadow-[0_0_8px_white]" />
          </motion.div>
        )}

        {state === 'working' && (
          <motion.svg
            key="working"
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 270 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
            className="absolute inset-0 w-full h-full text-white/80"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
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
            <div className="absolute w-full h-full border-2 border-white/60 rounded-full" style={{ animation: 'aiva-ripple 1.5s ease-out infinite' }} />
            <div className="absolute w-full h-full border-2 border-white/40 rounded-full" style={{ animation: 'aiva-ripple 1.5s ease-out infinite 0.5s' }} />
            <div className="absolute w-full h-full border-2 border-white/20 rounded-full" style={{ animation: 'aiva-ripple 1.5s ease-out infinite 1s' }} />
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
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className="absolute flex items-center justify-center text-white"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
               <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
