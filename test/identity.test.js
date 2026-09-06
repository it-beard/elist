import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { idNormalize, recordKey } from '../src/lib/identity.js';

describe('identity (замарожаная)', () => {
  it('усе id у базе адпавядаюць формуле — змена нармалізацыі зламала б спісы назірання', () => {
    const db = JSON.parse(readFileSync(new URL('../data/materials.json', import.meta.url)));
    const bad = db.filter((x) => createHash('sha1').update(recordKey(x.type, x.name, x.court)).digest('hex').slice(0, 12) !== x.id);
    expect(bad.length).toBe(0);
  });
  it('нармалізуе як і раней', () => {
    expect(idNormalize('  Радыё «Свабода» i\tX  ')).toBe('радые "свабода" і x');
  });
});

// --- другі і трэці спісы: id фарміраванняў і асоб лічацца праз тую ж замарожаную нармалізацыю (дапісана ў канец) ---
import { formationId } from '../scripts/parse-formations.mjs';
import { personId } from '../scripts/parse-persons.mjs';

describe('identity: фарміраванні і фізічныя асобы (замарожаныя)', () => {
  const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
  it('formations.json: id = formationId(name, basis) — першыя 200 запісаў', () => {
    const db = load('formations.json').slice(0, 200);
    expect(db.length).toBeGreaterThan(0);
    expect(db.filter((x) => formationId(x.name, x.basis) !== x.id).map((x) => x.id)).toEqual([]);
  });
  it('persons.json: id = personId(name, birth, included) — першыя 200 запісаў', () => {
    const db = load('persons.json').slice(0, 200);
    expect(db.length).toBeGreaterThan(0);
    expect(db.filter((x) => personId(x.name, x.birth, x.included) !== x.id).map((x) => x.id)).toEqual([]);
  });
  it('12 hex-сімвалаў; рэгістр, лапкі і прабелы не мяняюць id; імя ці першая дата — мяняюць', () => {
    expect(formationId('Ініцыятыва «Рабочы Рух»', 'Решение КГБ от 21.09.2021 № 9/2-2252')).toMatch(/^[0-9a-f]{12}$/);
    expect(personId('Іваноў Іван', '01.01.1990', '23.03.2022')).toMatch(/^[0-9a-f]{12}$/);
    expect(formationId('  Рабочы  Рух ', 'x')).toBe(formationId('рабочы рух', 'x'));
    expect(formationId('«Рабочы Рух»', 'x')).toBe(formationId('"рабочы рух"', 'x'));
    expect(formationId('Рабочы Рух', 'x')).not.toBe(formationId('Рабочы Рух', 'Решение МВД от 18.10.2021 № 1ЭК'));
    expect(personId('Іваноў Іван', '01.01.1990', '23.03.2022, 04.04.2025')).toBe(personId('ІВАНОЎ  ІВАН', '01.01.1990', '23.03.2022'));
    expect(personId('Іваноў Іван', '01.01.1990', '23.03.2022')).not.toBe(personId('Іваноў Іван', '01.01.1990', '04.04.2025'));
    expect(personId('Іваноў Іван', '01.01.1990', '23.03.2022')).not.toBe(personId('Іваноў Іван', '02.01.1990', '23.03.2022'));
    expect(personId('a b', '', '')).not.toBe(formationId('a b', ''));
  });
});
