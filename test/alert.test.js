import { describe, it, expect } from 'vitest';
import { esc, sourceMessages } from '../scripts/alert-logic.mjs';

describe('sourceMessages — пераходы стану крыніц', () => {
  it('стан не змяніўся — нічога (і калі памылка проста іншая)', () => {
    expect(sourceMessages()).toEqual([]);
    expect(sourceMessages({})).toEqual([]);
    expect(sourceMessages({ cur: { sourceError: 'x' }, prev: { sourceError: 'y' }, curF: { sourceError: 'a' }, prevF: { sourceError: 'b' }, curP: { sourceError: 'c' }, prevP: { sourceError: 'd' } })).toEqual([]);
    expect(sourceMessages({ cur: { sourceError: null, fallback: false }, prev: {} })).toEqual([]);
  });
  it('матэрыялы: крыніца ўпала / аднавілася; запасная ўключылася / выключылася (з экранаваннем)', () => {
    expect(sourceMessages({ cur: { sourceError: 'HTTP 503 <x>' }, prev: {} })).toEqual(['⚠️ Крыніца не адказвае: HTTP 503 &lt;x&gt;']);
    expect(sourceMessages({ cur: { sourceError: null }, prev: { sourceError: 'HTTP 503' } })).toEqual(['✅ Крыніца зноў адказвае.']);
    expect(sourceMessages({ cur: { fallback: true, sourcePage: 'https://zviazda.by/?a=1&b=2' }, prev: { fallback: false } })).toEqual(['⚠️ Афіцыйная крыніца недаступная, узятая запасная: https://zviazda.by/?a=1&amp;b=2']);
    expect(sourceMessages({ cur: { fallback: false }, prev: { fallback: true } })).toEqual(['✅ Зноў афіцыйная крыніца.']);
    expect(sourceMessages({ cur: { sourceError: 'x', fallback: true }, prev: {} })).toHaveLength(2);
  });
  it('пералікі МУС: перастаў / зноў абнаўляецца', () => {
    expect(sourceMessages({ curF: { sourceError: 'Падазрона' }, prevF: {} })).toEqual(['⚠️ Пералік фарміраванняў (МУС) не абнаўляецца: Падазрона']);
    expect(sourceMessages({ curF: { sourceError: null }, prevF: { sourceError: 'x' } })).toEqual(['✅ Пералік фарміраванняў (МУС) зноў абнаўляецца.']);
    expect(sourceMessages({ curP: { sourceError: 'Падазрона' }, prevP: {} })).toEqual(['⚠️ Пералік фізічных асоб (МУС) не абнаўляецца: Падазрона']);
    expect(sourceMessages({ curP: { sourceError: null }, prevP: { sourceError: 'x' } })).toEqual(['✅ Пералік фізічных асоб (МУС) зноў абнаўляецца.']);
  });
  it('крок упаў ці забіты таймаўтам, а sourceError у меце няма — асобнае папярэджанне; з sourceError — не дубль', () => {
    expect(sourceMessages({ steps: { persons: 'failure' } })).toEqual(['⚠️ Крок абнаўлення пераліку фізічных асоб (МУС) не завяршыўся (таймаўт ці збой да запісу меты).']);
    expect(sourceMessages({ steps: { formations: 'cancelled' } })).toEqual(['⚠️ Крок абнаўлення пераліку фарміраванняў (МУС) не завяршыўся (таймаўт ці збой да запісу меты).']);
    expect(sourceMessages({ steps: { persons: 'failure' }, curP: { sourceError: 'Падазрона' }, prevP: {} })).toEqual(['⚠️ Пералік фізічных асоб (МУС) не абнаўляецца: Падазрона']);
    expect(sourceMessages({ steps: { persons: 'failure' }, curP: { sourceError: 'старая' }, prevP: { sourceError: 'старая' } })).toEqual([]);
    expect(sourceMessages({ steps: { persons: 'success', formations: 'skipped' } })).toEqual([]);
    expect(sourceMessages({ steps: { persons: '', formations: undefined } })).toEqual([]);
  });
  it('усё адразу — у парадку спісаў', () => {
    const msgs = sourceMessages({ cur: { sourceError: 'a' }, curF: { sourceError: 'b' }, steps: { persons: 'failure' } });
    expect(msgs.map((m) => m.slice(0, 12))).toEqual(['⚠️ Крыніца н', '⚠️ Пералік ф', '⚠️ Крок абна']);
  });
  it('esc', () => expect(esc('<a href="x">&</a>')).toBe('&lt;a href="x"&gt;&amp;&lt;/a&gt;'));
});
