'use client';

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api-client';
import { io, Socket } from 'socket.io-client';

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

interface VoiceAgentResult {
  success: boolean;
  tool: string | null;
  data: any;
  spokenSummary: string;
  navigateTo?: string;
  confirmationRequired?: ConfirmationRequired;
  error?: string;
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
}

const AivaContext = createContext<AivaContextType | undefined>(undefined);

export function AivaProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<AivaState>('idle');
  const [transcript, setTranscript] = useState('');
  const [assistantMessage, setAssistantMessage] = useState('How can I help you?');
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{ tool: string; params: any } | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  const stateRef = useRef<AivaState>(state);
  
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Initialize Speech APIs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setState('error');
          setAssistantMessage('I had trouble hearing you. Please try again.');
          speak('I had trouble hearing you. Please try again.');
          setTimeout(() => setState('idle'), 3000);
        };

        recognition.onend = () => {
          if (stateRef.current === 'listening') {
            setState('thinking');
            // We need to call processTranscript but it depends on state. We can use a trick:
            // or we just call a stable function. Wait, processTranscript reads `transcript` from state which is also stale.
            // Let's dispatch a custom event or just let a separate effect handle it.
          }
        };

        recognitionRef.current = recognition;
      }
      synthRef.current = window.speechSynthesis;
    }
  }, []); // Only run once on mount

  // Watch for state transitions that should trigger processing
  useEffect(() => {
    if (state === 'thinking') {
      processTranscript();
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
          socketRef.current.on(`aiva.progress.${res.sessionId}`, (payload: any) => {
            setProgressMessage(payload.message);
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
      });

      setAssistantMessage(res.spokenSummary);
      setState('speaking');
      speak(res.spokenSummary, () => {
        if (res.confirmationRequired) {
          setState('confirming');
          setPendingConfirmation({ tool: res.tool!, params: res.data ?? {} });
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
      });

      setPendingConfirmation(null);
      setAssistantMessage(res.spokenSummary);
      setState('speaking');
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
