import { describe, it, expect } from 'vitest';
import { mergeList, pairEdits } from '../scripts/merge.mjs';

// семантыка фарміраванняў: параўнанне палёў, без пар праўак
const FIELDS = ['kind', 'name', 'alias', 'links', 'address', 'basis', 'decidedBy', 'date', 'included', 'info', 'logo'];
const rec = (n, extra = {}) => ({ id: `f${n}`, kind: 'formation', name: `Экстремистское формирование «${n}»`, alias: '', links: '', address: '', basis: `Решение МВД от 01.01.2022 № ${n}ЭК`, decidedBy: 'mvd', date: '2022-01-01', included: '2022-01-01', info: '', logo: '', ...extra });
const parsed = (n) => Array.from({ length: n }, (_, i) => rec(i + 1));
const clone = (x) => JSON.parse(JSON.stringify(x));
const opts = (today, extra = {}) => ({ today, fields: FIELDS, maxAdded: 100, ...extra });
const byId = (out, id) => out.find((x) => x.id === id);

describe('mergeList — фарміраванні', () => {
  it('першы імпарт: added = null, order па крыніцы; паўтор — без змен', () => {
    const r1 = mergeList([], parsed(3), opts('2026-09-06'));
    expect(r1).toMatchObject({ added: 3, removed: 0, edited: 0, edits: [], initial: true });
    expect(r1.out.map((x) => [x.id, x.order, x.added])).toEqual([['f1', 0, null], ['f2', 1, null], ['f3', 2, null]]);
    const r2 = mergeList(clone(r1.out), parsed(3), opts('2026-09-07'));
    expect(r2).toMatchObject({ added: 0, removed: 0, edited: 0, initial: false });
    expect(r2.out.every((x) => x.added === null && !x.edited && !x.removed)).toBe(true);
  });
  it('змена поля — праўка моўчкі (edited); новы — added сёння; свежы парадак; зніклы — removed; вярнуўся — зноў жывы і не «новы»', () => {
    const db = clone(mergeList([], parsed(3), opts('2026-09-06')).out);
    const next = [rec(1, { info: 'Дапоўнена' }), rec(3), rec(2), rec(4)];
    const r = mergeList(db, next, opts('2026-09-07'));
    expect(r).toMatchObject({ added: 1, removed: 0, edited: 1 });
    expect(r.out.map((x) => x.id)).toEqual(['f1', 'f3', 'f2', 'f4']);
    expect(r.out[0]).toMatchObject({ info: 'Дапоўнена', edited: '2026-09-07', added: null });
    expect(r.out[1]).not.toHaveProperty('edited');
    expect(r.out[3]).toMatchObject({ added: '2026-09-07', order: 3 });
    const gone = mergeList(clone(r.out), [rec(1, { info: 'Дапоўнена' }), rec(3), rec(4)], opts('2026-09-08'));
    expect(gone).toMatchObject({ added: 0, removed: 1, edited: 0 });
    expect(byId(gone.out, 'f2').removed).toBe('2026-09-08');
    expect(gone.out).toHaveLength(4); // зніклы застаецца ў базе
    const back = mergeList(clone(gone.out), next, opts('2026-09-09'));
    expect(back).toMatchObject({ added: 0, removed: 0, edited: 0 });
    expect(byId(back.out, 'f2')).not.toHaveProperty('removed');
    expect(byId(back.out, 'f2').added).toBe(null);
    // null і адсутнае поле — тое самае, а не праўка; пусты радок і null — праўка (як і раней)
    const dbNull = clone(back.out).map((x) => ({ ...x, logo: null }));
    expect(mergeList(dbNull, next.map(({ logo, ...x }) => x), opts('2026-09-10')).edited).toBe(0);
    expect(mergeList(clone(back.out), next.map((x) => ({ ...x, logo: null })), opts('2026-09-10')).edited).toBe(4);
  });
  it('засцярогі: знікла больш за max(minRemoved, 5 %) — памылка нават з force; зашмат новых — памылка без force', () => {
    const db = clone(mergeList([], parsed(100), opts('2026-09-06')).out);
    expect(() => mergeList(clone(db), parsed(70), opts('2026-09-07'))).toThrow(/30 запісаў знікла з крыніцы, 0 дададзена/);
    expect(() => mergeList(clone(db), parsed(70), opts('2026-09-07', { force: true }))).toThrow(/знікла/);
    expect(mergeList(clone(db), parsed(80), opts('2026-09-07'))).toMatchObject({ removed: 20 });
    expect(() => mergeList(clone(db), parsed(79), opts('2026-09-07'))).toThrow(/21 запісаў знікла/);
    expect(mergeList(clone(db), parsed(79), opts('2026-09-07', { minRemoved: 50 }))).toMatchObject({ removed: 21 });
    expect(() => mergeList(clone(db), parsed(104), opts('2026-09-07', { maxAdded: 3 }))).toThrow(/4 новых запісаў за адзін раз \(ліміт 3\)/);
    expect(mergeList(clone(db), parsed(104), opts('2026-09-07', { maxAdded: 3, force: true }))).toMatchObject({ added: 4 });
    expect(mergeList(clone(db), parsed(103), opts('2026-09-07', { maxAdded: 3 }))).toMatchObject({ added: 3 });
    // пры памылцы зніклыя не пазначаюцца
    const db2 = clone(db);
    expect(() => mergeList(db2, parsed(70), opts('2026-09-07'))).toThrow();
    expect(db2.every((x) => !x.removed)).toBe(true);
    // першы імпарт — без засцярог
    expect(mergeList([], parsed(500), opts('2026-09-07', { maxAdded: 3 }))).toMatchObject({ added: 500, initial: true });
  });
  it('primary: false (запасное люстэрка) — зніклыя не пазначаюцца, removed не здымаецца', () => {
    const db = clone(mergeList([], parsed(3), opts('2026-09-06')).out);
    db[1].removed = '2026-09-01';
    const r = mergeList(clone(db), [rec(1)], opts('2026-09-07', { primary: false }));
    expect(r).toMatchObject({ added: 0, removed: 0 });
    expect(byId(r.out, 'f3')).not.toHaveProperty('removed');
    const r2 = mergeList(clone(db), parsed(3), opts('2026-09-07', { primary: false }));
    expect(byId(r2.out, 'f2').removed).toBe('2026-09-01');
    expect(byId(mergeList(clone(db), parsed(3), opts('2026-09-07')).out, 'f2')).not.toHaveProperty('removed');
  });
  it('дублі id у крыніцы: застаецца апошні на сваім месцы, пры паўторах праўка не пазначаецца', () => {
    const src = [rec(1), rec(2, { info: 'A' }), rec(3), rec(2, { info: 'B' })];
    const r1 = mergeList([], src, opts('2026-09-06'));
    expect(r1.added).toBe(3);
    expect(r1.out.map((x) => [x.id, x.order, x.info])).toEqual([['f1', 0, ''], ['f3', 2, ''], ['f2', 3, 'B']]);
    expect(r1.out.every((x) => !x.edited)).toBe(true);
    const r2 = mergeList(clone(r1.out), src, opts('2026-09-07'));
    expect(r2).toMatchObject({ added: 0, removed: 0, edited: 0 });
    const r3 = mergeList(clone(r2.out), src, opts('2026-09-08'));
    expect(r3).toMatchObject({ added: 0, removed: 0, edited: 0 });
    expect(byId(r3.out, 'f2')).toMatchObject({ info: 'B', order: 3 });
    expect(byId(r3.out, 'f2')).not.toHaveProperty('edited');
  });
  it('без fields (матэрыялы) палі не параўноўваюцца і не абнаўляюцца', () => {
    const db = clone(mergeList([], parsed(2), { today: '2026-09-06' }).out);
    const r = mergeList(db, [rec(1, { info: 'зменена' }), rec(2)], { today: '2026-09-07' });
    expect(r).toMatchObject({ added: 0, removed: 0, edited: 0 });
    expect(r.out[0].info).toBe('');
  });
  it('пары праўак праз isEdit: новы наследуе added і атрымлівае edited/editOf, стары — removed/replacedBy; вярнуўся — чыстыя; maxPairs', () => {
    const same = (a, b) => a.name === b.name;
    const db = clone(mergeList([], parsed(3), opts('2026-09-06')).out);
    db[1].added = '2026-08-01';
    const fixed = rec(2, { id: 'f2x', basis: 'Решение МВД от 02.02.2022 № 2ЭК' });
    const r = mergeList(db, [rec(1), fixed, rec(3)], opts('2026-09-07', { isEdit: same }));
    expect(r).toMatchObject({ added: 0, removed: 0, edited: 0 });
    expect(r.edits.map(([o, n]) => [o.id, n.id])).toEqual([['f2', 'f2x']]);
    expect(byId(r.out, 'f2x')).toMatchObject({ added: '2026-08-01', edited: '2026-09-07', editOf: 'f2' });
    expect(byId(r.out, 'f2')).toMatchObject({ removed: '2026-09-07', replacedBy: 'f2x' });
    const back = mergeList(clone(r.out), [rec(1), rec(2), fixed, rec(3)], opts('2026-09-08', { isEdit: same }));
    expect(byId(back.out, 'f2')).not.toHaveProperty('removed');
    expect(byId(back.out, 'f2')).not.toHaveProperty('replacedBy');
    // зніклых больш за maxPairs — не праўкі; на першым імпарце пар няма
    const db5 = clone(mergeList([], parsed(5), opts('2026-09-06')).out);
    const src = [rec(1), rec(2), ...parsed(5).slice(2).map((x) => ({ ...x, id: `${x.id}x` }))];
    expect(mergeList(clone(db5), src, opts('2026-09-07', { isEdit: same, maxPairs: 2, minRemoved: 50 }))).toMatchObject({ removed: 3, added: 3, edits: [] });
    expect(mergeList(clone(db5), src, opts('2026-09-07', { isEdit: same, maxPairs: 3, minRemoved: 50 }))).toMatchObject({ removed: 0, added: 0 });
    expect(mergeList([], src, opts('2026-09-07', { isEdit: same })).edits).toEqual([]);
  });
});

describe('pairEdits — свой isEdit і maxPairs', () => {
  const same = (o, n) => o.name === n.name;
  it('пары па перададзеным крытэрыі; больш зніклых за maxPairs — пуста', () => {
    const a = { id: 'a', name: 'x' }, b = { id: 'b', name: 'x' }, c = { id: 'c', name: 'y' };
    expect(pairEdits([a], [b], same, 1)).toEqual([[a, b]]);
    expect(pairEdits([a, c], [b], same, 1)).toEqual([]);
    expect(pairEdits([a, c], [b], same, 2)).toEqual([[a, b]]);
    expect(pairEdits([a], [b, { id: 'd', name: 'x' }], same)).toEqual([]); // неадназначнасць
  });
});
