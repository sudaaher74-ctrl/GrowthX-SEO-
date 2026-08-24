"use client";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster, toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";

/**
 * The agency console is a light-only design, so there is no theme provider.
 *
 * next-themes was removed deliberately: it injects an inline <script> to avoid
 * a flash of the wrong theme, and React 19 logs that as a console error on
 * every render. With a single theme there is nothing to prevent a flash of.
 */

/** What to tell the user about a failed write. */
function describe(error: unknown): { message: string; detail?: string } {
  if (error instanceof ApiError) {
    // A plan refusal is not a failure the user should be alarmed by — the
    // pages that can hit one render an <UpgradePrompt /> explaining it, so the
    // toast stays quiet and factual rather than shouting "Something failed".
    if (error.isUpgradeRequired) {
      return { message: "Your plan doesn't include that", detail: error.message };
    }
    if (error.isUnauthorized) {
      return { message: "Your session expired", detail: "Sign in again to continue." };
    }
    return { message: "That didn't save", detail: error.message };
  }
  if (error instanceof Error && error.message) {
    return { message: "That didn't save", detail: error.message };
  }
  return { message: "That didn't save", detail: "Something went wrong. Please try again." };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
        },
        // Every mutation in the app reports its own failure through this, so a
        // write that fails can no longer look exactly like one that worked.
        // It lives on the cache rather than in `defaultOptions.mutations`
        // because a mutation that defines its own `onError` would override the
        // default; cache callbacks run in addition to it.
        mutationCache: new MutationCache({
          onError: (error) => {
            const { message, detail } = describe(error);
            toast.error(message, detail);
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
