import { describe, it, expect } from 'vitest';
import { buildDigest, dateBe, dateShort, digestFooter, digestHeader, entry, esc, icon, num, plural, selectFresh, shiftDays, title } from '../scripts/digest.mjs';

const SITE = 'https://elist.itbeard.com/';
const person = { id: 'p1', list: 'p', name: 'Ковалевский <Николай> & Co', translit: 'KAVALEUSKI', birth: '14.10.1983', address: 'Могилевская область, д. Лудчицы', citizenship: 'Республика Беларусь', articles: ['342', '<b>'], court: 'суда Быховского района', date: '2022-03-23', added: '2026-09-05' };
const formation = { id: 'f1', list: 'f', kind: 'organization', name: 'Экстремистская организация «ТУТ БАЙ МЕДИА»', decidedBy: 'court', date: '2022-06-14', added: '2026-09-05' };
const material = { id: 'm1', list: 'm', type: 'Информационная продукция', name: 'Telegram-канал "Свабода" с идентификатором https://t.me/svaboda', court: 'Решение суда Ленинского района г. Минска от 1 мая 2026 года.', date: '2026-05-01', added: '2026-09-05' };

describe('дапаможныя', () => {
  it('esc, даты, множны лік, лічбы', () => {
    expect(esc('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
    expect(dateBe('2026-09-05')).toBe('5 верасня 2026');
    expect(dateShort('2022-03-23')).toBe('23.03.2022');
    expect(dateShort(null)).toBe('');
    expect(shiftDays('2026-09-06', -7)).toBe('2026-08-30');
    expect([1, 2, 5, 11, 21, 22].map((n) => plural(n, 'запіс', 'запісы', 'запісаў'))).toEqual(['запіс', 'запісы', 'запісаў', 'запісаў', 'запіс', 'запісы']);
    expect(num(6038)).toBe('6 038');
    expect(num(999)).toBe('999');
  });
  it('эмодзі паводле спіса і тыпу рэсурсу; назва — адзін радок, абрэзаная', () => {
    expect([person, formation, material].map(icon)).toEqual(['👤', '🟣', '✈️']);
    expect(icon({ list: 'm', name: 'Книга «X»', type: 'Печатное издание' })).toBe('📚');
    expect(icon({ list: 'm', name: 'Нешта', type: '' })).toBe('📄');
    expect(title({ name: 'Назва  з\nпрабеламі;. ' })).toBe('Назва з прабеламі');
    const long = title({ name: 'слова '.repeat(60) });
    expect(long.length).toBeLessThanOrEqual(220);
    expect(long).toMatch(/…$/);
  });
});

describe('entry', () => {
  it('фізічная асоба: без даты нараджэння, адраса і грамадзянства; імя і артыкулы экранаваныя', () => {
    const e = entry(person, 3, SITE);
    expect(e).not.toContain('14.10.1983');
    expect(e).not.toContain('Лудчицы');
    expect(e).not.toContain('Беларусь');
    expect(e).toContain('👤 <b>3.</b> Ковалевский &lt;Николай&gt; &amp; Co');
    expect(e).toContain('<i>23.03.2022 · 👤 ст. 342, &lt;b&gt; УК · суд Быховского района</i>');
    expect(e).not.toContain('<b>b</b>');
    expect(e).toContain(`<a href="${SITE}#/r/p1">Адкрыць запіс →</a></blockquote>`);
  });
  it('фарміраванне і матэрыял; без даты і суда радка мэты няма', () => {
    expect(entry(formation, 1, SITE)).toContain('<i>14.06.2022 · 🟣 рашэнне суда · экстрэмісцкая арганізацыя</i>');
    expect(entry(material, 2, SITE)).toContain('<i>01.05.2026 · ⚖️ суд Ленинского района г. Минска</i>');
    expect(entry({ ...material, date: null, court: '' }, 2, SITE)).not.toContain('<i>');
  });
});

describe('digestHeader', () => {
  it('тры віды — змяшаная шапка з лічбамі і агульнай колькасцю матэрыялаў; дата — калі запісы трапілі ў базу', () => {
    expect(digestHeader([material, formation, person], { today: '2026-09-06', total: 6038 })).toBe(
      '🔴 <b>Экстрэмісцкія спісы: +3 новыя запісы</b>\n<i>5 верасня 2026 · матэрыялаў +1, фарміраванняў +1, асоб +1 · усяго матэрыялаў у спісе 6 038</i>',
    );
    expect(digestHeader([formation, person], { today: '2026-09-06', total: 6038 })).toBe('🔴 <b>Экстрэмісцкія спісы: +2 новыя запісы</b>\n<i>5 верасня 2026 · фарміраванняў +1, асоб +1</i>');
  });
  it('адзін від — свая шапка', () => {
    expect(digestHeader([person], { total: 6038 })).toBe('👤 <b>Пералік фізічных асоб, прычастных да экстрэмісцкай дзейнасці (МУС): +1 новы запіс</b>\n<i>5 верасня 2026</i>');
    expect(digestHeader([formation], { total: 6038 })).toBe('🟣 <b>Пералік экстрэмісцкіх фарміраванняў (МУС/КДБ): +1 новы запіс</b>\n<i>5 верасня 2026</i>');
    expect(digestHeader([material], { total: 6038 })).toBe('🔴 <b>Спіс экстрэмісцкіх матэрыялаў: +1 новы запіс</b>\n<i>5 верасня 2026 · усяго ў спісе 6 038</i>');
  });
  it('пробная шапка — сённяшняя дата', () => {
    expect(digestHeader([material], { test: true, today: '2026-09-06', total: 6038 })).toBe('🧪 <b>Пробнае паведамленне</b> — так будуць выглядаць дайджэсты\n<i>6 верасня 2026 · 6 038 запісаў у спісе</i>');
  });
});

describe('buildDigest — падзагалоўкі і разбіццё', () => {
  it('падзагалоўкі толькі ў змяшаным дайджэсце, без id; футэр у канцы', () => {
    const mixed = buildDigest([material, formation, person], { site: SITE, today: '2026-09-06', total: 1 });
    expect(mixed.messages).toHaveLength(1);
    expect(mixed.messages[0]).toContain('\n\n🟣 <b>Пералік экстрэмісцкіх фарміраванняў (МУС/КДБ)</b> — ');
    expect(mixed.messages[0]).toContain('\n\n👤 <b>Пералік фізічных асоб, прычастных да экстрэмісцкай дзейнасці (МУС)</b> — ');
    expect(mixed.ids).toEqual([['m1', 'f1', 'p1']]);
    expect(mixed.messages[0].endsWith(`\n\n${digestFooter(SITE)}`)).toBe(true);
    const single = buildDigest([person, { ...person, id: 'p2' }], { site: SITE, today: '2026-09-06', total: 1 });
    expect(single.messages[0]).not.toContain('(МУС)</b> — ');
    expect(single.ids).toEqual([['p1', 'p2']]);
  });
  it('доўгі дайджэст: часткі ≤ 4096, нумарацыя «(i/n)» на працягах, id паштучна, футэр толькі ў апошняй', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...material, id: `m${i}`, name: `${material.name} №${i} ${'x'.repeat(150)}` }));
    const { messages, ids } = buildDigest(many, { site: SITE, today: '2026-09-06', total: 1 });
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((m) => m.length <= 4096)).toBe(true);
    expect(ids).toHaveLength(messages.length);
    expect(ids.flat()).toEqual(many.map((x) => x.id));
    expect(messages[0]).toMatch(/^🔴 <b>Спіс экстрэмісцкіх матэрыялаў/);
    expect(messages[0]).not.toContain('Працяг дайджэсту');
    expect(messages[0]).not.toContain('RSS');
    messages.slice(1).forEach((m, i) => expect(m.startsWith(`<i>Працяг дайджэсту (${i + 2}/${messages.length})</i>\n\n`)).toBe(true));
    expect(messages[messages.length - 1]).toMatch(/RSS<\/a>$/);
    expect(messages.join('')).toContain('<b>40.</b>');
  });
});

describe('selectFresh', () => {
  const db = [
    { id: 'old', list: 'm', added: '2026-08-01', order: 0 },
    { id: 'm2', list: 'm', added: '2026-09-05', order: 5 },
    { id: 'm1', list: 'm', added: '2026-09-05', order: 2 },
    { id: 'p1', list: 'p', added: '2026-09-04', order: 0 },
    { id: 'f1', list: 'f', added: '2026-09-05', order: 0 },
    { id: 'sent', list: 'm', added: '2026-09-05', order: 1 },
    { id: 'fix', list: 'm', added: '2026-09-05', order: 9, editOf: 'sent0' },
    { id: 'fix2', list: 'm', added: '2026-09-05', order: 10, editOf: 'unsent0' },
    { id: 'none', list: 'm', added: null },
  ];
  it('акно, дасланыя, папярэднія версіі праўак; парадак: дата → спіс → месца', () => {
    expect(selectFresh(db, { sent: '2026-09-05', sent0: '2026-09-01' }, '2026-08-30').map((x) => x.id)).toEqual(['p1', 'm1', 'm2', 'fix2', 'f1']);
    expect(selectFresh(db, {}, '2026-09-06')).toEqual([]);
  });
});
