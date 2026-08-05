"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * The agency console is a light-only design, so there is no theme provider.
 *
 * next-themes was removed deliberately: it injects an inline <script> to avoid
 * a flash of the wrong theme, and React 19 logs that as a console error on
 * every render. With a single theme there is nothing to prevent a flash of.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
