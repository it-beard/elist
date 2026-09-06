import { describe, it, expect } from 'vitest';
import { variants } from '../src/lib/translit.js';

// Токены прыходзяць ужо нармалізаванымі (ніжні рэгістр, лацінская i → «і»), як і індэкс.
describe('variants (транслітарацыя)', () => {
  it('лацінка з дыякрытыкай (ž č š ŭ) → кірыліца', () => {
    expect(variants('naša')).toContain('наша');
    expect(variants('čas')).toContain('час');
    expect(variants('voŭk')).toContain('воўк');
    expect(variants('žodzіna')).toContain('жодзіна');
  });
  it('кірыліца → лацінка ў абодвух стылях: г → g і h, ж → zh і ž-без-дыякрытыкі (z)', () => {
    const g = variants('гродна');
    expect(g).toContain('grodna');
    expect(g).toContain('hrodna');
    const z = variants('жодзіна');
    expect(z).toContain('zhodzіna');
    expect(z).toContain('zodzіna');
  });
  it('апостраф: у лацінцы знікае, з лацінкі → ь', () => {
    const v = variants("сям'я");
    expect(v).toContain('syamya');
    expect(v).toContain('sjamja');
    expect(variants("kon'")).toContain('конь');
  });
  it('карацейшыя за 3 сімвалы не транслітаруюцца — толькі і ↔ и; закароткі варыянт адкідаецца', () => {
    expect(variants('ab')).toEqual(['ab']);
    expect(variants('да')).toEqual(['да']);
    expect(variants('і')).toEqual(['і', 'и']);
    expect(variants('и')).toEqual(['и', 'і']);
    expect(variants('ьыь')).toEqual(['ьыь']); // варыянт «y» карацейшы за 3 — не дадаецца
  });
  it('змешаныя пісьмы, лічбы і спасылкі — без варыянтаў', () => {
    expect(variants('abcд')).toEqual(['abcд']);
    expect(variants('2026')).toEqual(['2026']);
    expect(variants('t.me/x')).toEqual(['t.me/x']);
  });
  it('першы варыянт — сам токен, без паўтораў', () => {
    const v = variants('мінск');
    expect(v[0]).toBe('мінск');
    expect(new Set(v).size).toBe(v.length);
    expect(v).toContain('минск');
    expect(v).toContain('mіnsk');
  });
});
