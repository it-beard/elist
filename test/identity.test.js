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
