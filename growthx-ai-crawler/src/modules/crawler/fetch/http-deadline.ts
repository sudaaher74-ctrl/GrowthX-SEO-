/**
 * A hard wall-clock cap for an HTTP request.
 *
 * axios's own `timeout` is a response timeout: it starts once a socket is
 * connected and measures idleness, so a request wedged earlier than that — a
 * TCP connect that never completes, a forward proxy holding a CONNECT open for
 * a host that does not resolve — is not bounded by it at all and hangs for as
 * long as the socket stays open. A crawl that stalls on one unreachable URL
 * stalls entirely, which is how a worker ends up abandoned and a job sits at
 * RUNNING until a sweeper finds it.
 *
 * Passed as `signal` alongside `timeout`, so both the idle case and the wedged
 * case are covered.
 */
export function deadlineSignal(ms: number): AbortSignal {
  // AbortSignal.timeout exists from Node 17.3; the manual form is kept as a
  // fallback so this never silently returns an un-aborting signal.
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  timer.unref?.();
  return controller.signal;
}
