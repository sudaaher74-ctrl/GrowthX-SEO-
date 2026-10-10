export type RefreshResult = 'refreshed' | 'expired' | 'temporary-error';

export interface RefreshDependencies {
  version: () => string;
  publish: () => void;
  refresh: () => Promise<RefreshResult>;
  lock?: (run: () => Promise<RefreshResult>) => Promise<RefreshResult>;
}

/** One rotation per browser session, shared by requests and cooperating tabs. */
export function createSessionRefresh(dependencies: RefreshDependencies) {
  let pending: Promise<RefreshResult> | null = null;
  return (observedVersion: string): Promise<RefreshResult> => {
    if (pending) return pending;
    const rotate = async (): Promise<RefreshResult> => {
      if (dependencies.version() !== observedVersion) return 'refreshed';
      try {
        const result = await dependencies.refresh();
        if (result === 'refreshed') dependencies.publish();
        return result;
      } catch { return 'temporary-error'; }
    };
    const work = Promise.resolve().then(() => dependencies.lock ? dependencies.lock(rotate) : rotate());
    pending = work.catch(() => 'temporary-error' as const).finally(() => { pending = null; });
    return pending;
  };
}
