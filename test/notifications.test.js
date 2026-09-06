import { describe, it, expect, vi, afterEach } from 'vitest';
import { showNotification } from '../src/lib/notifications.js';

const OPTS = { body: 'Новыя супадзенні: 2', icon: `${import.meta.env.BASE_URL}icon-192.png`, tag: 'elist-watch', renotify: true };
// Старонкавае Notification — клас, каб «new» працаваў як у браўзеры
const calls = [];
class FakeNotification { constructor(title, opts) { calls.push([title, opts]); } }

afterEach(() => { vi.unstubAllGlobals(); calls.length = 0; });

describe('showNotification', () => {
  it('праз service worker: reg.showNotification з tag=elist-watch і renotify; старонкавае Notification не ствараецца', async () => {
    const show = vi.fn(async () => {});
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn(async () => ({ showNotification: show })) } });
    vi.stubGlobal('Notification', FakeNotification);
    await showNotification('Спіс назірання', OPTS.body);
    expect(show).toHaveBeenCalledWith('Спіс назірання', OPTS);
    expect(calls).toEqual([]);
  });

  it('без рэгістрацыі SW — new Notification з тымі ж опцыямі', async () => {
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn(async () => undefined) } });
    vi.stubGlobal('Notification', FakeNotification);
    await showNotification('Спіс назірання', OPTS.body);
    expect(calls).toEqual([['Спіс назірання', OPTS]]);
  });

  it('рэгістрацыя без showNotification ці наогул без navigator.serviceWorker (стары браўзер) — старонкавае', async () => {
    vi.stubGlobal('Notification', FakeNotification);
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn(async () => ({})) } });
    await showNotification('a', 'b');
    vi.stubGlobal('navigator', {});
    await showNotification('c', 'd');
    expect(calls.map(([title]) => title)).toEqual(['a', 'c']);
  });

  it('памылка ў SW (getRegistration адхіляе, showNotification кідае) — старонкавае', async () => {
    vi.stubGlobal('Notification', FakeNotification);
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn(async () => { throw new Error('no SW'); }) } });
    await showNotification('a', 'b');
    const broken = { showNotification: vi.fn(async () => { throw new TypeError('renotify without tag'); }) };
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn(async () => broken) } });
    await showNotification('c', 'd');
    expect(broken.showNotification).toHaveBeenCalledOnce();
    expect(calls.map(([title]) => title)).toEqual(['a', 'c']);
  });
});
