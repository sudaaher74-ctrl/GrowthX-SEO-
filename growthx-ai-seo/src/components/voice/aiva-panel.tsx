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
    uiPayload,
  } = useAiva();

  return (
    <>
      {/* Apple Intelligence Edge Glow - Changed to B&W / Removed Rainbow */}
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
              className="absolute inset-0 border-[4px] border-black/10"
              style={{ filter: 'blur(8px)' }}
            />
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
                aria-label="Open Nexa Voice Assistant"
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
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-[600px] max-w-[90vw] rounded-[30px] bg-[#111111] backdrop-blur-md shadow-2xl ring-1 ring-white/10 overflow-hidden"
            >

              <div className="flex flex-col">
                <AnimatePresence>
                  {uiPayload && uiPayload.type === 'blog_ideas' && (state === 'speaking' || state === 'completed' || state === 'idle') && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full px-6 pt-5 pb-3 border-b border-white/10"
                    >
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ideas for &quot;{uiPayload.topic}&quot;</h4>
                      <ul className="space-y-3">
                        {uiPayload.items.map((idea: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-3 text-[15px] text-gray-200 leading-snug">
                            <span className="text-white/50 font-semibold">{idx + 1}.</span>
                            {idea}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  {uiPayload && uiPayload.type === 'crawl_status' && (state === 'speaking' || state === 'completed' || state === 'idle') && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full px-6 pt-5 pb-5 border-b border-white/10"
                    >
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Crawl Status: {uiPayload.domain}</h4>
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                          <span className="text-2xl font-semibold text-white">{uiPayload.status}</span>
                          <span className="text-xs text-gray-500 uppercase tracking-wider mt-1">Status</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-2xl font-semibold text-white">{uiPayload.pagesCrawled}</span>
                          <span className="text-xs text-gray-500 uppercase tracking-wider mt-1">Pages</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-2xl font-semibold text-white">{uiPayload.issuesFound}</span>
                          <span className="text-xs text-gray-500 uppercase tracking-wider mt-1">Issues</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {uiPayload && uiPayload.type === 'audit_summary' && (state === 'speaking' || state === 'completed' || state === 'idle') && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full px-6 pt-5 pb-5 border-b border-white/10"
                    >
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Audit Summary: {uiPayload.domain}</h4>
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                          <span className="text-2xl font-semibold text-white">{uiPayload.criticalCount}</span>
                          <span className="text-xs text-gray-500 uppercase tracking-wider mt-1">Critical</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-2xl font-semibold text-white">{uiPayload.highCount}</span>
                          <span className="text-xs text-gray-500 uppercase tracking-wider mt-1">High</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-2xl font-semibold text-white">{uiPayload.totalIssues}</span>
                          <span className="text-xs text-gray-500 uppercase tracking-wider mt-1">Total Issues</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {uiPayload && uiPayload.type === 'competitor_list' && (state === 'speaking' || state === 'completed' || state === 'idle') && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full px-6 pt-5 pb-4 border-b border-white/10"
                    >
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tracked Competitors</h4>
                      <div className="flex flex-wrap gap-2">
                        {uiPayload.competitors.map((c, idx) => (
                          <div key={idx} className="px-3 py-1.5 bg-white/10 rounded-md text-sm text-white font-medium border border-white/5">
                            {c.domain}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {uiPayload && uiPayload.type === 'meta_tags' && (state === 'speaking' || state === 'completed' || state === 'idle') && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full px-6 pt-5 pb-5 border-b border-white/10"
                    >
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Optimized Tags: {uiPayload.targetUrl}</h4>
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-1">SEO Title</span>
                          <p className="text-[15px] text-gray-300 font-medium">{uiPayload.title}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-1">Meta Description</span>
                          <p className="text-[14px] text-gray-400 leading-relaxed">{uiPayload.description}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {uiPayload && uiPayload.type === 'seo_strategy' && (state === 'speaking' || state === 'completed' || state === 'idle') && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full px-6 pt-5 pb-5 border-b border-white/10 overflow-y-auto max-h-[50vh]"
                    >
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">90-Day SEO Strategy</h4>
                      <div className="space-y-5">
                        {uiPayload.pillars?.length > 0 && (
                          <div>
                            <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">Content Pillars</span>
                            <ul className="space-y-2">
                              {uiPayload.pillars.map((pillar, idx) => (
                                <li key={idx} className="text-[14px] text-gray-300 leading-relaxed">
                                  <strong className="text-white">{pillar.name}:</strong> {pillar.description}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {uiPayload.campaigns?.length > 0 && (
                          <div>
                            <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">Top Campaigns</span>
                            <div className="space-y-3">
                              {uiPayload.campaigns.map((camp, idx) => (
                                <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/10">
                                  <h5 className="text-[13px] font-bold text-white mb-1">{camp.name}</h5>
                                  <p className="text-[12px] text-gray-400">{camp.rationale}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {uiPayload && uiPayload.type === 'competitor_scrape_result' && (state === 'speaking' || state === 'completed' || state === 'idle') && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full px-6 pt-5 pb-5 border-b border-white/10 overflow-y-auto max-h-[50vh]"
                    >
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Live Scrape Result</h4>
                      <p className="text-[12px] text-gray-500 mb-4 truncate">Target: {uiPayload.url}</p>
                      
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">Extracted: {uiPayload.target}</span>
                          <div className="text-[14px] text-gray-300 leading-relaxed whitespace-pre-wrap p-3 bg-white/5 rounded-xl border border-white/10">
                            {uiPayload.extractedData}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {uiPayload && uiPayload.type === 'gap_insights' && (state === 'speaking' || state === 'completed' || state === 'idle') && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full px-6 pt-5 pb-5 border-b border-white/10 overflow-y-auto max-h-[50vh]"
                    >
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Competitor Gap Analysis</h4>
                      <div className="space-y-5">
                        <div>
                          <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">Strategic Insight</span>
                          <p className="text-[14px] text-gray-300 leading-relaxed">{uiPayload.insights}</p>
                        </div>
                        {uiPayload.missingKeywords?.length > 0 && (
                          <div>
                            <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">Missing High-Value Keywords</span>
                            <div className="flex flex-wrap gap-2">
                              {uiPayload.missingKeywords.map((kw: string, idx: number) => (
                                <div key={idx} className="px-2.5 py-1 bg-white/10 rounded-md text-[12px] text-white font-medium border border-white/5">
                                  {kw}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {uiPayload.recommendedContent?.length > 0 && (
                          <div>
                            <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">Recommended Content</span>
                            <div className="space-y-2">
                              {uiPayload.recommendedContent.map((rec, idx) => (
                                <div key={idx} className="p-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                                  <div className="flex flex-col">
                                    <span className="text-[13px] font-semibold text-white">{rec.title}</span>
                                    <span className="text-[11px] text-gray-500 mt-0.5">{rec.type} • Target: {rec.targetKeyword}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {uiPayload && uiPayload.type === 'social_draft' && (state === 'speaking' || state === 'completed' || state === 'idle') && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full px-6 pt-5 pb-5 border-b border-white/10 overflow-y-auto max-h-[50vh]"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Social Trend Hijack</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 uppercase tracking-wider">
                          {uiPayload.platform}
                        </span>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-1">Identified Trend</span>
                          <p className="text-[14px] text-brand-300 font-medium">#{uiPayload.trend}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-2">Drafted Post</span>
                          <div className="text-[14px] text-gray-300 leading-relaxed whitespace-pre-wrap p-4 bg-white/5 rounded-xl border border-white/10 italic">
                            &quot;{uiPayload.postText}&quot;
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative flex items-center justify-between p-2 pl-3 gap-4 h-[60px]">
                {/* Left: Aiva Orb */}
                <div 
                  className="flex-shrink-0 cursor-pointer p-1" 
                  onClick={state === 'listening' ? stopListening : startListening}
                  title={state === 'listening' ? 'Tap to send' : 'Tap to speak'}
                >
                  <AivaOrb state={state} className="w-10 h-10" onClick={() => {}} />
                </div>

                {/* Middle: Conversation Text */}
                <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={state === 'listening' ? transcript : (progressMessage || assistantMessage || state)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="truncate text-[15px] font-medium text-white"
                    >
                      {state === 'idle' ? 'Say "Hey Nexa" or tap to speak' 
                        : state === 'listening' ? (transcript || 'Listening...')
                        : state === 'confirming' ? 'Say "Yes" to confirm or "No" to cancel'
                        : progressMessage ? (
                          <span className="flex items-center gap-2 italic text-gray-400">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
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
                      <Button onClick={cancelAction} variant="ghost" size="sm" className="rounded-full text-gray-400 hover:text-white hover:bg-white/10 h-9 px-4">
                        Cancel
                      </Button>
                      <Button onClick={confirmAction} size="sm" className="rounded-full bg-white text-black hover:bg-gray-200 h-9 px-4">
                        Confirm
                      </Button>
                    </>
                  ) : (
                    <button
                      onClick={close}
                      className="rounded-full p-2 text-gray-500 hover:bg-white/10 hover:text-white focus:outline-none transition-colors"
                      aria-label="Close Assistant"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
