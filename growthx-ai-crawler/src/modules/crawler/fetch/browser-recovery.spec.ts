jest.mock('playwright', () => ({ chromium: { launch: jest.fn() } }));
jest.mock('./memory-budget', () => ({ renderBudget: () => ({ allowed: true }) }));
import { chromium } from 'playwright';
import { BrowserPoolService } from './browser-pool.service';

describe('browser lifecycle recovery', () => {
  afterEach(() => jest.clearAllMocks());
  it('keeps the replacement usable when the old browser disconnects late', async () => {
    let disconnectOld!: () => void;
    const oldContext = {}, freshContext = {};
    const oldBrowser = { on: (_event: string, cb: () => void) => { disconnectOld = cb; }, newContext: async () => oldContext };
    const freshBrowser = { on: jest.fn(), newContext: async () => freshContext, isConnected: () => true };
    (chromium.launch as jest.Mock).mockResolvedValueOnce(oldBrowser).mockResolvedValueOnce(freshBrowser);
    const pool: any = new BrowserPoolService();
    await pool.ensureContext('agent');
    pool.browser = undefined; pool.context = undefined;
    await pool.ensureContext('agent');
    disconnectOld();
    expect(await pool.ensureContext('agent')).toBe(freshContext);
    expect(chromium.launch).toHaveBeenCalledTimes(2);
  });
  it('recovers a transient launch failure after its cooldown', async () => {
    (chromium.launch as jest.Mock).mockRejectedValueOnce(new Error('Temporary launch failure'));
    const pool: any = new BrowserPoolService();
    expect(await pool.ensureContext('agent')).toBeUndefined();
    expect(await pool.ensureContext('agent')).toBeUndefined();
    const context = {};
    (chromium.launch as jest.Mock).mockResolvedValueOnce({ on: jest.fn(), newContext: async () => context });
    pool.launchRetryAt = 0;
    expect(await pool.ensureContext('agent')).toBe(context);
    expect(chromium.launch).toHaveBeenCalledTimes(2);
  });
});
