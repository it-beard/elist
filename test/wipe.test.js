import { describe, it, expect, vi, afterEach } from 'vitest';
import { wipeBrowserData } from '../src/lib/wipe.js';

afterEach(() => vi.unstubAllGlobals());

describe('wipeBrowserData («Ачысціць усё»)', () => {
  it('чысціць localStorage і sessionStorage, history.state, усе кэшы і service worker-ы', async () => {
    const ls = { clear: vi.fn() }, ss = { clear: vi.fn() };
    const replaceState = vi.fn();
    const del = vi.fn(async () => true);
    const unregister = vi.fn(async () => true);
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('sessionStorage', ss);
    vi.stubGlobal('history', { state: { q: 'сакрэтны запыт' }, replaceState });
    vi.stubGlobal('location', { pathname: '/elist/', hash: '#/new', search: '?x=1' });
    vi.stubGlobal('caches', { keys: vi.fn(async () => ['elist-v1', 'elist-v2']), delete: del });
    vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: vi.fn(async () => [{ unregister }, { unregister }]) } });
    await expect(wipeBrowserData()).resolves.toBeUndefined();
    expect(ls.clear).toHaveBeenCalledOnce();
    expect(ss.clear).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/elist/#/new'); // state → null, адрас без ?x=1
    expect(del.mock.calls.map(([k]) => k)).toEqual(['elist-v1', 'elist-v2']);
    expect(unregister).toHaveBeenCalledTimes(2);
  });

  it('памылка на любым кроку не спыняе астатнія і не кідаецца вонкі', async () => {
    const ss = { clear: vi.fn() };
    const unregister = vi.fn(async () => true);
    vi.stubGlobal('localStorage', { clear: () => { throw new Error('SecurityError'); } });
    vi.stubGlobal('sessionStorage', ss);
    vi.stubGlobal('history', { replaceState: () => { throw new Error('SecurityError'); } });
    vi.stubGlobal('location', { pathname: '/', hash: '' });
    vi.stubGlobal('caches', { keys: vi.fn(async () => ['a']), delete: vi.fn(async () => { throw new Error('quota'); }) });
    vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: vi.fn(async () => [{ unregister }]) } });
    await expect(wipeBrowserData()).resolves.toBeUndefined();
    expect(ss.clear).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledOnce();
  });

  it('без sessionStorage, Cache API і service worker (стары браўзер) — проста завяршаецца', async () => {
    const ls = { clear: vi.fn() };
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('history', { replaceState: vi.fn() });
    vi.stubGlobal('location', { pathname: '/', hash: '' });
    vi.stubGlobal('navigator', {});
    await expect(wipeBrowserData()).resolves.toBeUndefined();
    expect(ls.clear).toHaveBeenCalledOnce();
  });

  it('getRegistrations адхіляе — кэшы ўсё роўна выдаленыя', async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal('localStorage', { clear: vi.fn() });
    vi.stubGlobal('sessionStorage', { clear: vi.fn() });
    vi.stubGlobal('history', { replaceState: vi.fn() });
    vi.stubGlobal('location', { pathname: '/', hash: '' });
    vi.stubGlobal('caches', { keys: vi.fn(async () => ['a']), delete: del });
    vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: vi.fn(async () => { throw new Error('no SW'); }) } });
    await expect(wipeBrowserData()).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith('a');
  });
});
