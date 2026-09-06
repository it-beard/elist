import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FormatError, UA, downloadBuffer, expectedLength, findLinks, isComplete, readJson, runMain, writeSourceError } from '../scripts/common.mjs';
import { findPersonDocs } from '../scripts/update-persons.mjs';
import { findXlsxUrl } from '../scripts/update-formations.mjs';

const page = 'https://www.mvd.gov.by/ru/news/8642';

describe('findLinks', () => {
  it('абсалютны url з папраўкай &amp;, подпіс без тэгаў у адзін радок, парадак на старонцы; фільтр па пашырэнні', () => {
    const html = `<p><a class="f" href="/uploads/p&amp;1.docx"><span>Перечень граждан.</span>
      <b>Часть 1</b></a></p>
      <a href='https://x.by/other.xlsx'>Перечень организаций</a>
      <a href="/uploads/p2.DOC">Перечень граждан. Часть 2</a>
      <a href="/f.pdf">pdf</a><a name="якар">без href</a>`;
    expect(findLinks(html, page, /\.docx?$/i)).toEqual([
      { url: 'https://www.mvd.gov.by/uploads/p&1.docx', label: 'Перечень граждан. Часть 1', i: 0 },
      { url: 'https://www.mvd.gov.by/uploads/p2.DOC', label: 'Перечень граждан. Часть 2', i: 1 },
    ]);
    expect(findLinks(html, page, /\.xlsx$/i)).toEqual([{ url: 'https://x.by/other.xlsx', label: 'Перечень организаций', i: 0 }]);
    expect(findLinks(html, page, /\.zip$/i)).toEqual([]);
  });
  it('findPersonDocs: .docx, &amp; у href, паўторная спасылка на той жа файл — адзін раз, парадак па частках', () => {
    const html = `<a href="/u/p2.docx">Перечень граждан … Часть 2</a>
      <a href="/u/p&amp;1.doc">Перечень граждан … Часть 1</a>
      <a href="/u/p2.docx"><b>Перечень граждан … Часть 2</b> (паўтор)</a>
      <a href="/u/org.xlsx">Перечень организаций</a>`;
    expect(findPersonDocs(html, page)).toEqual([
      { url: 'https://www.mvd.gov.by/u/p&1.doc', label: 'Перечень граждан … Часть 1' },
      { url: 'https://www.mvd.gov.by/u/p2.docx', label: 'Перечень граждан … Часть 2 (паўтор)' },
    ]);
  });
  it('findXlsxUrl: &amp; у href, подпіс з тэгамі', () => {
    expect(findXlsxUrl('<a href="/u/a.xlsx">x</a><a href="/u/b&amp;c.xlsx"><i>Перечень</i> организаций</a>', page)).toBe('https://www.mvd.gov.by/u/b&c.xlsx');
  });
});

describe('isComplete / expectedLength', () => {
  const h = (o) => new Headers(o);
  it('сціснуты адказ — заўсёды поўны (content-length пра сціснутае цела, fetch аддае распакаванае)', () => {
    expect(isComplete(h({ 'content-encoding': 'gzip', 'content-length': '100' }), 5)).toBe(true);
    expect(isComplete(h({ 'content-encoding': 'br', 'content-length': '100' }), 5)).toBe(true);
    expect(expectedLength(h({ 'content-encoding': 'gzip', 'content-length': '100' }))).toBe(null);
  });
  it('без сціску (ці identity): несупадзенне — абарваны', () => {
    expect(isComplete(h({ 'content-length': '100' }), 99)).toBe(false);
    expect(isComplete(h({ 'content-length': '100' }), 100)).toBe(true);
    expect(isComplete(h({ 'content-encoding': 'identity', 'content-length': '100' }), 99)).toBe(false);
    expect(expectedLength(h({ 'content-length': '100' }))).toBe(100);
  });
  it('без загалоўка — праверыць нельга, лічым поўным; просты аб’ект замест Headers — таксама працуе', () => {
    expect(isComplete(h({}), 5)).toBe(true);
    expect(expectedLength(h({}))).toBe(null);
    expect(isComplete({ 'content-length': '7' }, 7)).toBe(true);
    expect(isComplete({ 'content-length': '7' }, 6)).toBe(false);
    expect(isComplete(undefined, 6)).toBe(true);
  });
});

describe('downloadBuffer', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (body, headers, status = 200) => {
    const fn = vi.fn(async () => ({ ok: status < 400, status, headers: new Headers(headers), arrayBuffer: async () => Uint8Array.from(body).buffer }));
    vi.stubGlobal('fetch', fn);
    return fn;
  };
  const body = Array.from({ length: 20_000 }, (_, i) => i % 256);
  it('поўны файл — { buf, res }; UA нашага праекта', async () => {
    const f = stub(body, { 'content-length': '20000', 'last-modified': 'x' });
    const { buf, res } = await downloadBuffer('https://x.by/f.doc', { timeout: 1000 });
    expect(buf.length).toBe(20_000);
    expect(res.headers.get('last-modified')).toBe('x');
    expect(f.mock.calls[0][1].headers['user-agent']).toBe(UA);
    expect(UA).toContain('github.com/it-beard/elist');
  });
  it('абарваны файл, малы файл, HTTP-памылка — памылкі; gzip з «няправільным» content-length — не абарваны', async () => {
    stub(body.slice(0, 19_000), { 'content-length': '20000' });
    await expect(downloadBuffer('https://x.by/f.doc')).rejects.toThrow('абарваны файл (19000 з 20000 байт)');
    stub(body, { 'content-length': '999', 'content-encoding': 'gzip' });
    await expect(downloadBuffer('https://x.by/f.doc')).resolves.toBeTruthy();
    stub(body.slice(0, 5000), {});
    await expect(downloadBuffer('https://x.by/f.doc')).rejects.toThrow('файл падазрона малы');
    await expect(downloadBuffer('https://x.by/f.doc', { minBytes: 100 })).resolves.toBeTruthy();
    stub(body, {}, 503);
    await expect(downloadBuffer('https://x.by/f.doc')).rejects.toThrow('HTTP 503');
  });
});

describe('readJson / writeSourceError / runMain / FormatError', () => {
  it('readJson — fallback, калі файла няма ці ён не JSON', async () => {
    expect(await readJson('/няма/такога.json', { a: 1 })).toEqual({ a: 1 });
    expect(await readJson(new URL(import.meta.url).pathname, [])).toEqual([]);
  });
  it('writeSourceError дапісвае sourceError/checked/checkedAt да існай меты', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'elist-'));
    const file = path.join(dir, 'meta.json');
    await fs.writeFile(file, JSON.stringify({ updated: '2026-09-01', total: 5, sourceError: null }));
    await writeSourceError(file, 'HTTP 503', '2026-09-06T10:00:00.000Z');
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({ updated: '2026-09-01', total: 5, sourceError: 'HTTP 503', checked: '2026-09-06', checkedAt: '2026-09-06T10:00:00.000Z' });
    await writeSourceError(path.join(dir, 'new.json'), 'x');
    expect(JSON.parse(await fs.readFile(path.join(dir, 'new.json'), 'utf8'))).toMatchObject({ sourceError: 'x' });
    await fs.rm(dir, { recursive: true, force: true });
  });
  it('runMain не запускае main пры імпарце (argv[1] — не гэты файл)', async () => {
    const main = vi.fn(async () => {});
    runMain(import.meta.url, main);
    await new Promise((r) => setTimeout(r, 10));
    expect(main).not.toHaveBeenCalled();
  });
  it('FormatError — асобны клас памылкі', () => {
    const e = new FormatError('фармат');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(FormatError);
    expect(e.name).toBe('FormatError');
    expect(e.message).toBe('фармат');
    expect(new Error('x')).not.toBeInstanceOf(FormatError);
  });
});
