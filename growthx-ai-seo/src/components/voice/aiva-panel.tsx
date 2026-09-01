'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAiva } from './aiva-provider';
import { AivaOrb } from './aiva-orb';
import { X, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AivaPanel() {
  const {
    isOpen,
    state,
    transcript,
    assistantMessage,
    progressMessage,
    toggleOpen,
    close,
    startListening,
    stopListening,
    confirmAction,
    cancelAction,
  } = useAiva();

  return (
    <>
      {/* Apple Intelligence Edge Glow */}
      <AnimatePresence>
        {state === 'listening' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-40 pointer-events-none"
          >
            <div 
              className="absolute inset-0 border-[12px] border-transparent"
              style={{
                background: 'linear-gradient(90deg, #ff5e00, #ff007f, #7f00ff, #007fff, #00ff7f, #ffff00, #ff5e00) border-box',
                backgroundSize: '300% 300%',
                WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                animation: 'edge-glow-move 8s ease-in-out infinite',
                filter: 'blur(16px)',
                opacity: 0.8,
              }}
            />
            {/* Add a subtle inset shadow to blend it nicely */}
            <div 
              className="absolute inset-0 shadow-[inset_0_0_100px_rgba(127,0,255,0.15)]"
            />
            <style>{`
              @keyframes edge-glow-move {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <button
                onClick={toggleOpen}
                className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-black/5 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2"
                aria-label="Open Aiva Voice Assistant"
              >
                <div className="absolute inset-0 -m-1 rounded-full aiva-border-segment opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative flex h-full w-full items-center justify-center rounded-full bg-white">
                  <AivaOrb state="idle" className="scale-75" />
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Siri-style Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* No Background Blur Overlay - user wants to see the background perfectly */}
            {/* Bottom Strip / Pill */}
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-[600px] max-w-[90vw] rounded-full bg-white/95 backdrop-blur-lg shadow-2xl ring-1 ring-black/10"
            >
              {/* Rainbow Border Glow for Pill */}
              <div className="absolute inset-0 rounded-full aiva-border-segment opacity-20 pointer-events-none" style={{ mixBlendMode: 'overlay' }} />

              <div className="relative flex items-center justify-between p-2 pl-3 gap-4">
                {/* Left: Aiva Orb */}
                <div 
                  className="flex-shrink-0 cursor-pointer" 
                  onClick={state === 'listening' ? stopListening : startListening}
                  title={state === 'listening' ? 'Tap to send' : 'Tap to speak'}
                >
                  <div className="scale-75 origin-left -ml-2 -my-2">
                    <AivaOrb state={state} onClick={() => {}} />
                  </div>
                </div>

                {/* Middle: Conversation Text */}
                <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={state === 'listening' ? transcript : (progressMessage || assistantMessage || state)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="truncate text-[15px] font-medium text-gray-800"
                    >
                      {state === 'idle' ? 'What can I help you with today?' 
                        : state === 'listening' ? (transcript || 'Listening...')
                        : progressMessage ? (
                          <span className="flex items-center gap-2 italic text-gray-600">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                            </span>
                            {progressMessage}
                          </span>
                        )
                        : assistantMessage ? assistantMessage
                        : 'Thinking...'}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Right: Controls */}
                <div className="flex-shrink-0 flex items-center gap-2 pr-2">
                  {state === 'confirming' ? (
                    <>
                      <Button onClick={cancelAction} variant="ghost" size="sm" className="rounded-full text-gray-500 hover:text-gray-800 h-9 px-4">
                        Cancel
                      </Button>
                      <Button onClick={confirmAction} size="sm" className="rounded-full bg-purple-600 hover:bg-purple-700 text-white h-9 px-4">
                        Confirm
                      </Button>
                    </>
                  ) : (
                    <button
                      onClick={close}
                      className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none transition-colors"
                      aria-label="Close Assistant"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
