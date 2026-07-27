import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface CrawlProgress {
  pagesCrawled: number;
  currentUrl: string;
}

export function useCrawlSocket(jobId: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [progress, setProgress] = useState<CrawlProgress | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on(`crawl.progress.${jobId}`, (data: CrawlProgress) => {
      setProgress(data);
    });

    newSocket.on(`crawl.completed.${jobId}`, () => {
      setIsCompleted(true);
    });

    return () => {
      newSocket.close();
    };
  }, [jobId]);

  return { socket, progress, isCompleted };
}
