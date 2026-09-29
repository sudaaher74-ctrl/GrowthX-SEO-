"use client";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/lib/api-client";

/**
 * The agency console is a light-only design, so there is no theme provider.
 *
 * next-themes was removed deliberately: it injects an inline <script> to avoid
 * a flash of the wrong theme, and React 19 logs that as a console error on
 * every render. With a single theme there is nothing to prevent a flash of.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    /**
     * Tokens are spent on the server, out of sight of the screen that asked. So
     * the balance is re-read whenever something that could have spent some
     * finishes (any mutation: most are free, and one small read is cheaper than
     * a stale balance), and whenever a request is refused for want of them.
     */
    const refreshTokens = () => void queryClient.invalidateQueries({ queryKey: ["tokens"] });
    const refreshIfOutOfTokens = (error: unknown) => {
      if (error instanceof ApiError && error.isOutOfTokens) refreshTokens();
    };

    const queryClient: QueryClient = new QueryClient({
      queryCache: new QueryCache({ onError: refreshIfOutOfTokens }),
      mutationCache: new MutationCache({ onSuccess: refreshTokens, onError: refreshIfOutOfTokens }),
      defaultOptions: {
        queries: { staleTime: 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
      },
    });
    return queryClient;
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
