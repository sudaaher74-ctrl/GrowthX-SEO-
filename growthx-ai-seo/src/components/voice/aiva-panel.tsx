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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed bottom-24 right-6 z-50 w-96 overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 sm:w-[400px]"
            >
              {/* Rainbow Border Glow */}
              <div className="absolute inset-0 aiva-border-segment opacity-40 pointer-events-none" style={{ mixBlendMode: 'overlay' }} />
              <div className="absolute inset-px rounded-[23px] bg-white pointer-events-none" />

              <div className="relative flex h-full flex-col p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-lg font-semibold text-transparent">
                    Aiva Assistant
                  </h3>
                  <button
                    onClick={close}
                    className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Conversation Area */}
                <div className="flex-1 space-y-4 min-h-[200px] flex flex-col justify-end mb-6">
                  <AnimatePresence mode="popLayout">
                    {transcript && (
                      <motion.div
                        key="user-msg"
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="self-end max-w-[85%]"
                      >
                        <div className="rounded-2xl rounded-tr-sm bg-gray-100 px-4 py-2.5 text-[15px] text-gray-800 shadow-sm">
                          {transcript}
                        </div>
                      </motion.div>
                    )}

                    <motion.div
                      key="assistant-msg"
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="self-start max-w-[90%]"
                    >
                      <div className="aiva-bubble rounded-2xl rounded-tl-sm bg-gradient-to-br from-purple-600 to-indigo-600 px-4 py-2.5 text-[15px] text-white shadow-md">
                        {assistantMessage}
                      </div>
                    </motion.div>

                    {progressMessage && (
                      <motion.div
                        key="progress-msg"
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="self-start"
                      >
                        <span className="text-sm text-gray-500 italic flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                          </span>
                          {progressMessage}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Controls Area */}
                <div className="flex flex-col items-center justify-center space-y-4 pt-4 border-t border-gray-100">
                  {state === 'confirming' ? (
                    <div className="flex gap-3 w-full">
                      <Button onClick={cancelAction} variant="outline" className="flex-1 rounded-xl h-11">
                        Cancel
                      </Button>
                      <Button onClick={confirmAction} className="flex-1 rounded-xl h-11 bg-purple-600 hover:bg-purple-700 text-white">
                        Confirm
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <AivaOrb
                        state={state}
                        onClick={state === 'listening' ? stopListening : startListening}
                      />
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                        {state === 'idle'
                          ? 'Tap to speak'
                          : state === 'listening'
                          ? 'Tap to send'
                          : state === 'thinking'
                          ? 'Thinking...'
                          : state === 'working'
                          ? 'Working...'
                          : state === 'speaking'
                          ? 'Speaking...'
                          : state === 'error'
                          ? 'Error'
                          : ''}
                      </span>
                    </div>
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
