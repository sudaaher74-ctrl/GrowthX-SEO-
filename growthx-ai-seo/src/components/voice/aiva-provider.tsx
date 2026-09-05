'use client';

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api-client';
import { io, Socket } from 'socket.io-client';
import { usePathname } from 'next/navigation';

// Sound generators using Web Audio API
const playTone = (frequency: number, type: OscillatorType, duration: number, volume: number, startTime = 0) => {
  try {
    if (typeof window === 'undefined') return;
    const AudioContext =
    window.AudioContext || (window as SpeechCapableWindow).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + startTime);
  
  gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
    osc.start(ctx.currentTime + startTime);
    osc.stop(ctx.currentTime + startTime + duration);
  } catch (err) {
    // Ignore AudioContext errors if blocked by browser
  }
};

const playWakeSound = () => {
  playTone(440, 'sine', 0.2, 0.1); // A4
  playTone(554.37, 'sine', 0.3, 0.1, 0.1); // C#5
};

const playSuccessSound = () => {
  playTone(523.25, 'sine', 0.2, 0.1); // C5
  playTone(659.25, 'sine', 0.4, 0.1, 0.15); // E5
};

export type AivaState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'confirming'
  | 'working'
  | 'speaking'
  | 'completed'
  | 'error';

interface ConfirmationRequired {
  message: string;
  blocking: boolean;
}

/**
 * The Web Speech API is not in TypeScript's DOM lib — it remains non-standard
 * and vendor-prefixed — so the parts this provider uses are declared here
 * rather than reaching for `any` at every call site.
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/** Both spellings the browsers ship. */
interface SpeechCapableWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  webkitAudioContext?: typeof AudioContext;
}

/**
 * The structured panel data a voice tool can return alongside its spoken
 * summary. Each variant mirrors exactly what `voice-tools.service.ts` emits on
 * the backend; the panel switches on `type` to decide what to draw.
 */
export type AivaUiPayload =
  | {
      type: 'crawl_status';
      domain: string;
      status: string;
      pagesCrawled: number;
      issuesFound: number;
      errorMessage?: string | null;
    }
  | { type: 'competitor_list'; competitors: Array<{ domain: string; label?: string | null }> }
  | {
      type: 'audit_summary';
      domain: string;
      pagesCrawled: number;
      totalIssues: number;
      criticalCount: number;
      highCount: number;
    }
  | {
      type: 'gap_insights';
      // Shape fixed by the JSON schema seo-competitors.service.ts asks the
      // model for: a prose paragraph plus exactly three content ideas.
      insights: string;
      recommendedContent: Array<{ title: string; type: string; targetKeyword: string }>;
      missingKeywords: string[];
    }
  | {
      // `contentPillars` and `campaignIdeas` are Json columns, so only the
      // fields the panel reads are claimed here.
      type: 'seo_strategy';
      pillars: Array<{ name: string; description: string }>;
      campaigns: Array<{ name: string; rationale: string }>;
    }
  | { type: 'blog_ideas'; topic: string; items: string[] }
  | { type: 'meta_tags'; targetUrl: string; title: string; description: string }
  | { type: 'competitor_scrape_result'; url: string; target: string; extractedData: string }
  | { type: 'social_draft'; trend: string; platform: string; postText: string };

interface VoiceAgentResult {
  success: boolean;
  tool: string | null;
  data: unknown;
  spokenSummary: string;
  navigateTo?: string;
  confirmationRequired?: ConfirmationRequired;
  error?: string;
  uiPayload?: AivaUiPayload;
}

interface AivaContextType {
  state: AivaState;
  isOpen: boolean;
  transcript: string;
  assistantMessage: string;
  toggleOpen: () => void;
  close: () => void;
  startListening: () => void;
  stopListening: () => void;
  confirmAction: () => void;
  cancelAction: () => void;
  progressMessage: string | null;
  uiPayload: AivaUiPayload | null;
}

const AivaContext = createContext<AivaContextType | undefined>(undefined);

export function AivaProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<AivaState>('idle');
  const [transcript, setTranscript] = useState('');
  const [assistantMessage, setAssistantMessage] = useState('How can I help you?');
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [uiPayload, setUiPayload] = useState<AivaUiPayload | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    tool: string;
    params: Record<string, unknown>;
  } | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  const stateRef = useRef<AivaState>(state);
  const confirmActionRef = useRef<() => void>(() => {});
  const cancelActionRef = useRef<() => void>(() => {});
  const setIsOpenRef = useRef(setIsOpen);
  // `speak` and `processTranscript` are declared further down but used by the
  // mount effect above them. Reaching back for the declaration directly pins
  // the effect to the very first render's copy, so later renders — and the
  // state those closures read — never reach the speech callbacks. Same ref
  // indirection `setIsOpenRef` already uses, kept current on every render.
  const speakRef = useRef<(text: string, callback?: () => void) => void>(() => {});
  const processTranscriptRef = useRef<() => void | Promise<void>>(() => {});
  const pathname = usePathname();
  
  useEffect(() => {
    stateRef.current = state;
    setIsOpenRef.current = setIsOpen;
  }, [state, setIsOpen]);

  // Initialize Speech APIs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const speechWindow = window as SpeechCapableWindow;
      const SpeechRecognition =
        speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let silenceTimeout: NodeJS.Timeout;

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          
          const lower = currentTranscript.toLowerCase();

          if (stateRef.current === 'idle') {
            if (lower.includes('hey nexa') || lower.includes('hi nexa')) {
              playWakeSound();
              setIsOpenRef.current(true);
              setTranscript(currentTranscript.replace(/hey nexa|hi nexa/gi, '').trim());
              setState('listening');
              setAssistantMessage('Listening...');
              if (synthRef.current) synthRef.current.cancel();
            }
          } else if (stateRef.current === 'confirming') {
            if (lower.includes('proceed') || lower.includes('yes') || lower.includes('confirm')) {
              confirmActionRef.current();
            } else if (lower.includes('cancel') || lower.includes('no') || lower.includes('stop')) {
              cancelActionRef.current();
            }
          } else if (stateRef.current === 'speaking') {
            if (lower.includes('hey nexa') || lower.includes('hi nexa') || lower.includes('nexa stop')) {
              if (synthRef.current) synthRef.current.cancel();
              playWakeSound();
              setIsOpenRef.current(true);
              setTranscript(currentTranscript.replace(/hey nexa|hi nexa|nexa stop/gi, '').trim());
              setState('listening');
              setAssistantMessage('Listening...');
            }
          } else if (stateRef.current === 'listening') {
            setTranscript(currentTranscript);
            
            // Auto-stop and transition to thinking after 2 seconds of silence
            clearTimeout(silenceTimeout);
            silenceTimeout = setTimeout(() => {
              if (stateRef.current === 'listening') {
                try { recognition.stop(); } catch (e) {}
              }
            }, 2000);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network') {
            return; // Ignore routine silences and background aborts
          }
          if (event.error === 'not-allowed') {
            console.error('Microphone access denied.');
            return;
          }
          console.error('Speech recognition error', event.error);
          setState('error');
          setAssistantMessage('I had trouble hearing you. Please try again.');
          speakRef.current('I had trouble hearing you. Please try again.');
          setTimeout(() => setState('idle'), 3000);
        };

        recognition.onend = () => {
          if (stateRef.current === 'listening') {
            setState('thinking');
          }
          // Always keep listening for wake word or confirmation
          setTimeout(() => {
            try {
              if (recognitionRef.current) recognitionRef.current.start();
            } catch (e) {}
          }, 100);
        };

        recognitionRef.current = recognition;
        // Start listening immediately in background for wake word
        try { recognition.start(); } catch (e) {}
        
        return () => {
          recognition.onend = null;
          recognition.onerror = null;
          recognition.onresult = null;
          try { recognition.stop(); } catch (e) {}
        };
      }
      synthRef.current = window.speechSynthesis;
    }
  }, []); // Only run once on mount

  // Watch for state transitions that should trigger processing
  useEffect(() => {
    if (state === 'thinking') {
      processTranscriptRef.current();
    }
  }, [state]);

  // Handle Voice Session & Socket Connection
  useEffect(() => {
    async function initSession() {
      try {
        const projectId = auth.getProjectId() || undefined;
        const res = await api.voice.createSession(projectId);
        setSessionId(res.sessionId);

        // Connect socket for real-time progress
        const token = localStorage.getItem('growthx_token');
        if (token) {
          const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          socketRef.current = io(socketUrl, {
            auth: { token },
            transports: ['websocket'],
          });
          socketRef.current.on(`aiva.progress.${res.sessionId}`, (payload: { message?: string }) => {
            setProgressMessage(payload.message ?? null);
          });
        }
      } catch (err) {
        console.error('Failed to init Aiva session:', err);
      }
    }
    if (isOpen && !sessionId) {
      initSession();
    }
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [isOpen, sessionId]);

  const speak = (text: string, callback?: () => void) => {
    if (!synthRef.current) return;
    synthRef.current.cancel(); // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    // Try to find a good English voice
    const voices = synthRef.current.getVoices();
    const voice = voices.find((v) => v.name.includes('Siri') || v.name.includes('Samantha') || (v.lang.startsWith('en') && v.name.includes('Female')));
    if (voice) utterance.voice = voice;
    utterance.rate = 1.05;

    utterance.onend = () => {
      if (callback) callback();
      else if (state === 'speaking') setState('idle');
    };
    synthRef.current.speak(utterance);
  };

  const processTranscript = async () => {
    const finalTranscript = transcript.trim();
    if (!finalTranscript) {
      setState('idle');
      return;
    }

    try {
      setAssistantMessage('Thinking...');
      const projectId = auth.getProjectId() || undefined;

      const res: VoiceAgentResult = await api.voice.chat({
        sessionId,
        projectId,
        text: finalTranscript,
        context: { path: pathname },
      });

      setAssistantMessage(res.spokenSummary);
      setUiPayload(res.uiPayload ?? null);
      setState('speaking');
      
      if (res.success && !res.confirmationRequired) {
        playSuccessSound();
      }

      speak(res.spokenSummary, () => {
        if (res.confirmationRequired) {
          setState('confirming');
          setPendingConfirmation({
            tool: res.tool!,
            params: (res.data as Record<string, unknown>) ?? {},
          });
        } else if (res.success) {
          setState('completed');
          setTimeout(() => setState('idle'), 2000);
        } else {
          setState('error');
          setTimeout(() => setState('idle'), 3000);
        }
      });

      if (res.navigateTo) {
        router.push(res.navigateTo);
      }
    } catch (err) {
      setState('error');
      const errorMsg = 'Sorry, I encountered an error.';
      setAssistantMessage(errorMsg);
      speak(errorMsg);
      setTimeout(() => setState('idle'), 3000);
    }
  };

  // Point the refs the effects above call through at this render's closures,
  // so the speech callbacks always see current state rather than mount-time
  // state. This has to sit below both declarations: reaching up to them from
  // an effect declared earlier is the same stale-closure capture it replaces.
  // Effects run after the commit, so the speech recognition callbacks — which
  // only fire once the browser reports a result or an error — always find a
  // current function here.
  useEffect(() => {
    speakRef.current = speak;
    processTranscriptRef.current = processTranscript;
  });

  const startListening = () => {
    if (recognitionRef.current) {
      setTranscript('');
      setProgressMessage(null);
      setState('listening');
      setAssistantMessage('Listening...');
      if (synthRef.current) synthRef.current.cancel();
      try {
        recognitionRef.current.start();
      } catch (err) {
        // Already started
      }
    } else {
      setAssistantMessage('Voice recognition is not supported in this browser.');
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && state === 'listening') {
      recognitionRef.current.stop();
      // onend will handle the transition to thinking
    }
  };

  const confirmAction = async () => {
    if (!pendingConfirmation) return;
    setState('working');
    setAssistantMessage('Working on it...');

    try {
      const projectId = auth.getProjectId() || undefined;

      const res: VoiceAgentResult = await api.voice.chat({
        sessionId,
        projectId,
        text: 'yes',
        confirmed: true,
        pendingTool: pendingConfirmation.tool,
        pendingParams: pendingConfirmation.params,
        context: { path: pathname },
      });

      setPendingConfirmation(null);
      setAssistantMessage(res.spokenSummary);
      setUiPayload(res.uiPayload ?? null);
      setState('speaking');
      
      if (res.success) {
        playSuccessSound();
      }

      speak(res.spokenSummary, () => {
        setState('completed');
        setTimeout(() => setState('idle'), 2000);
      });

      if (res.navigateTo) {
        router.push(res.navigateTo);
      }
    } catch (err) {
      setState('error');
      setAssistantMessage('Confirmation failed.');
      speak('Confirmation failed.');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  const cancelAction = () => {
    setPendingConfirmation(null);
    setState('idle');
    setAssistantMessage('Action cancelled.');
    speak('Action cancelled.');
  };

  useEffect(() => {
    confirmActionRef.current = confirmAction;
    cancelActionRef.current = cancelAction;
  }, [confirmAction, cancelAction]);

  const toggleOpen = () => setIsOpen((prev) => !prev);
  const close = () => {
    setIsOpen(false);
    if (synthRef.current) synthRef.current.cancel();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setState('idle');
  };

  return (
    <AivaContext.Provider
      value={{
        state,
        isOpen,
        transcript,
        assistantMessage,
        toggleOpen,
        close,
        startListening,
        stopListening,
        confirmAction,
        cancelAction,
        progressMessage,
        uiPayload,
      }}
    >
      {children}
    </AivaContext.Provider>
  );
}

export function useAiva() {
  const context = useContext(AivaContext);
  if (context === undefined) {
    throw new Error('useAiva must be used within an AivaProvider');
  }
  return context;
}
