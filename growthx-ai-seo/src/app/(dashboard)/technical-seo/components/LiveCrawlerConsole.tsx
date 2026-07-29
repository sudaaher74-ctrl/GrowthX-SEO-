"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Activity, FileText, CheckCircle2, AlertTriangle, RefreshCw, XCircle, Settings, Download } from "lucide-react";

export function LiveCrawlerConsole({ progress, isCrawling }: { progress: any, isCrawling: boolean }) {
  const [logs, setLogs] = useState<{ id: string; type: 'info' | 'success' | 'warn' | 'error'; message: string; timestamp: Date }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Simulate incoming logs if crawling, or just mock data
  useEffect(() => {
    if (!isCrawling) return;
    
    let counter = 0;
    const interval = setInterval(() => {
      counter++;
      const types: ('info' | 'success' | 'warn' | 'error')[] = ['info', 'success', 'info', 'warn', 'success'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      let message = "";
      if (type === 'info') message = `Fetching https://example.com/page-${counter} [200 OK]`;
      else if (type === 'success') message = `Extracted 42 internal links and 15 images from /page-${counter}`;
      else if (type === 'warn') message = `[WARN] Missing canonical tag on /page-${counter}`;
      else message = `[ERROR] Timeout waiting for DOM on /page-${counter}`;

      setLogs(prev => [...prev, {
        id: `log-${Date.now()}-${Math.random()}`,
        type,
        message,
        timestamp: new Date()
      }].slice(-50)); // Keep last 50 logs
    }, 800);

    return () => clearInterval(interval);
  }, [isCrawling]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const percentage = Math.min(100, Math.round(((progress?.pagesCrawled || 0) / Math.max(1, (progress?.totalPages || 100))) * 100));

  return (
    <div className="bg-[#0D0D0D] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[500px] relative font-mono text-sm group">
      
      {/* Top Window Bar */}
      <div className="bg-[#1A1A1A] px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80 border border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80 border border-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
          </div>
          <div className="flex items-center gap-2 ml-2 text-gray-400">
            <Terminal size={14} />
            <span className="font-semibold text-xs tracking-wider uppercase text-gray-300">Crawler.Engine_v4.2</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-2 text-xs font-bold ${isCrawling ? 'text-emerald-400' : 'text-gray-500'}`}>
            <span className="relative flex h-2 w-2">
              {isCrawling && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isCrawling ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
            </span>
            {isCrawling ? 'SYSTEM ACTIVE' : 'IDLE'}
          </span>
          <div className="h-4 w-px bg-gray-700"></div>
          <button className="text-gray-400 hover:text-white transition-colors"><Settings size={14} /></button>
          <button className="text-gray-400 hover:text-white transition-colors"><Download size={14} /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Side: Terminal Output */}
        <div 
          ref={scrollRef}
          className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent space-y-1.5"
        >
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 opacity-50 gap-4">
              <Terminal size={48} strokeWidth={1} />
              <p>Waiting for crawler to initialize...</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {logs.map((log) => (
                <motion.div 
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3"
                >
                  <span className="text-gray-600 shrink-0 text-xs mt-0.5">
                    {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }) + '.' + log.timestamp.getMilliseconds().toString().padStart(3, '0')}
                  </span>
                  
                  <div className="shrink-0 mt-0.5">
                    {log.type === 'info' && <Activity size={14} className="text-blue-400" />}
                    {log.type === 'success' && <CheckCircle2 size={14} className="text-emerald-400" />}
                    {log.type === 'warn' && <AlertTriangle size={14} className="text-yellow-400" />}
                    {log.type === 'error' && <XCircle size={14} className="text-red-400" />}
                  </div>

                  <span className={`
                    ${log.type === 'info' && 'text-gray-300'}
                    ${log.type === 'success' && 'text-emerald-300'}
                    ${log.type === 'warn' && 'text-yellow-300'}
                    ${log.type === 'error' && 'text-red-300'}
                  `}>
                    {log.message}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Right Side: Telemetry Metrics Overlay */}
        <div className="w-64 border-l border-gray-800 bg-[#121212] p-6 flex flex-col items-center justify-center relative z-10">
          
          <div className="relative w-36 h-36 flex items-center justify-center mb-8">
            {/* SVG Progress Ring */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#222" strokeWidth="8" />
              <motion.circle 
                cx="50" cy="50" r="45" fill="none" 
                stroke="url(#gradient)" strokeWidth="8"
                strokeDasharray="283"
                initial={{ strokeDashoffset: 283 }}
                animate={{ strokeDashoffset: 283 - (283 * percentage) / 100 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-white tracking-tighter">
                {percentage}%
              </span>
              <span className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mt-1">COMPLETE</span>
            </div>
          </div>

          <div className="w-full space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a1a] border border-gray-800/50">
              <div className="flex items-center gap-2 text-gray-400">
                <FileText size={14} />
                <span className="text-xs uppercase font-bold">Pages</span>
              </div>
              <span className="text-white font-bold">{progress?.pagesCrawled || 0}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a1a] border border-gray-800/50">
              <div className="flex items-center gap-2 text-gray-400">
                <AlertTriangle size={14} />
                <span className="text-xs uppercase font-bold">Issues</span>
              </div>
              <span className="text-yellow-400 font-bold">{progress?.issuesFound || 0}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a1a] border border-gray-800/50">
              <div className="flex items-center gap-2 text-gray-400">
                <Activity size={14} />
                <span className="text-xs uppercase font-bold">Speed</span>
              </div>
              <span className="text-emerald-400 font-bold">
                {isCrawling ? '12.4 p/s' : '0.0 p/s'}
              </span>
            </div>
          </div>

        </div>
      </div>
      
      {/* Glossy Reflection Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
    </div>
  );
}
