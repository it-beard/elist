import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useCopy } from '../src/hooks/useCopy.js';

// SSR-збруя, як у useLocalStorage: хук аддае [copied, copy]; copy — async, вынік залежыць толькі ад navigator.clipboard
let api;
function Probe() { const [copied, copy] = useCopy(); api = { copied, copy }; return <i>{String(copied)}</i>; }

describe('useCopy', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('піша тэкст у буфер і вяртае true; без доступу да буфера (адмова, стары браўзер) — false, без выключэння', async () => {
    const written = [];
    vi.stubGlobal('navigator', { clipboard: { writeText: async (s) => { written.push(s); } } });
    expect(renderToStaticMarkup(<Probe />)).toBe('<i>false</i>');
    await expect(api.copy('https://elist.test/#/r/x')).resolves.toBe(true);
    expect(written).toEqual(['https://elist.test/#/r/x']);
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('denied'); } } });
    await expect(api.copy('x')).resolves.toBe(false);
    vi.stubGlobal('navigator', {});
    await expect(api.copy('x')).resolves.toBe(false);
  });
});
