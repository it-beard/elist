import { describe, it, expect } from 'vitest';
import { parseIndex } from '../src/lib/api.js';

// Радок індэкса: [тып, суд, дата, дададзена, выдалена, назва, id, артыкул, editOf, replacedBy, спіс (0/1/2), № у крыніцы]
const IDX = {
  chunk: 200,
  types: ['информационная продукция', 'экстремистское формирование', 'ст. 342 ук'],
  courts: ['суда ленинского района г.гродно', 'решение мвд', 'суда быховского района'],
  dates: { '2026-08-20': '20 августа 2026 20.08.2026' },
  items: [
    [0, 0, '2026-08-20', '', '', 'канал "свабода"', 'm1', 2, '', '', 0],
    [0, 0, '2026-08-20', '', '', 'стары радок без поля спіса', 'm2', 0],
    [1, 1, '2021-10-18', '', '', 'экстремистское формирование «dze.chat»', 'f1', 1, '', '', 1],
    [2, 2, '2022-03-23', '', '', 'ковалевский николай николаевич\nkavaleuski mikalai\n14.10.1983', 'p1', 1, '', '', 2, 1],
    [2, 2, '2026-09-04', '', '', 'байбак юрий юрьевич\nbaibak yury\n05.08.1969', 'p2', 2, '', '', 2, 0],
  ],
};

describe('parseIndex', () => {
  const { items, counts, chunkSize } = parseIndex(IDX);
  it('вызначае спіс, серыю статыстыкі і нумар у сваім спісе', () => {
    expect(chunkSize).toBe(200);
    expect(items.map((x) => x.list)).toEqual(['m', 'm', 'f', 'p', 'p']);
    expect(items.map((x) => x.art)).toEqual(['kgs', 'none', 'mvd', 'protest', 'speech']);
    // матэрыялы і фарміраванні — пазіцыя; фізічныя асобы — афіцыйны №, а без яго (свежае дапаўненне) — null:
    // пазіцыя супадала б з чужымі афіцыйнымі нумарамі
    expect(items.map((x) => x.n)).toEqual([1, 2, 1, 1, null]);
    expect(counts).toEqual({ m: 2, f: 1, p: 2 });
  });
  it('радок пошуку змяшчае назву, тып, суд і дату словамі', () => {
    expect(items[0].h).toContain('20 августа 2026');
    expect(items[3].h).toContain('kavaleuski');
    expect(items[3].h).toContain('ст. 342 ук');
    expect(items[3].h).toContain('суда быховского района');
  });
});

describe('fetchChunk — свежы перачытванне фрагмента', () => {
  it('пасля несупадзення з індэксам фрагмент перачытваецца з сеткі адзін раз; clearChunks дазваляе зноў', async () => {
    const { fetchChunk, clearChunks } = await import('../src/lib/api.js');
    const calls = [];
    globalThis.fetch = async (url, init) => { calls.push([url, init?.cache]); return { ok: true, json: async () => [{ id: `r${calls.length}` }] }; };
    clearChunks();
    const a = await fetchChunk(3);
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toBeUndefined();
    // тры карткі адной старонкі адначасова просяць свежы фрагмент — адзін запыт з cache: 'reload', той жа promise
    const [b, c, d] = await Promise.all([fetchChunk(3, true), fetchChunk(3, true), fetchChunk(3, true)]);
    expect(calls).toHaveLength(2);
    expect(calls[1][1]).toBe('reload');
    expect(b).toBe(c); expect(c).toBe(d);
    expect(b).not.toBe(a);
    // звычайны і свежы запыт цяпер аддаюць перачытаны фрагмент без сеткі
    expect(await fetchChunk(3)).toBe(b);
    expect(await fetchChunk(3, true)).toBe(b);
    expect(calls).toHaveLength(2);
    // індэкс перазагружаны — можна перачытаць зноў
    clearChunks();
    await fetchChunk(3, true);
    expect(calls).toHaveLength(3);
    // няўдалы свежы запыт не блакуе паўтор
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    clearChunks();
    await expect(fetchChunk(4, true)).rejects.toThrow(/503/);
    globalThis.fetch = async () => ({ ok: true, json: async () => [] });
    await expect(fetchChunk(4, true)).resolves.toEqual([]);
    delete globalThis.fetch;
  });
});
