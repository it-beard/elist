import { describe, it, expect } from 'vitest';
import { ICON, NAME, buildDigest, dateBe, dateShort, digestFooter, digestHeader, entry, esc, num, plural, selectFresh, shiftDays, subheader, title } from '../scripts/digest.mjs';

const SITE = 'https://elist.itbeard.com/';
const TOTALS = { m: 6038, f: 377, p: 6874, w: 6680 }; // разам 19 969
const person = { id: 'p1', list: 'p', name: 'Ковалевский <Николай> & Co', translit: 'KAVALEUSKI', birth: '14.10.1983', address: 'Могилевская область, д. Лудчицы', citizenship: 'Республика Беларусь', articles: ['342', '<b>'], court: 'суда Быховского района', date: '2022-03-23', added: '2026-09-05' };
const formation = { id: 'f1', list: 'f', kind: 'organization', name: 'Экстремистская организация «ТУТ БАЙ МЕДИА»', decidedBy: 'court', date: '2022-06-14', added: '2026-09-05' };
const material = { id: 'm1', list: 'm', type: 'Информационная продукция', name: 'Telegram-канал "Свабода" с идентификатором https://t.me/svaboda', court: 'Решение суда Ленинского района г. Минска от 1 мая 2026 года.', date: '2026-05-01', added: '2026-09-05' };
const wanted = { id: 'w1', list: 'w', name: 'БАБАЯН АШОТ БАБКЕНОВИЧ', birthYear: 1980, agency: 'МВД', region: 'Гомельская область', date: '2026-09-04', added: '2026-09-04' };

describe('дапаможныя', () => {
  it('esc, даты, множны лік, лічбы', () => {
    expect(esc('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
    expect(dateBe('2026-09-05')).toBe('5 верасня 2026');
    expect(dateShort('2022-03-23')).toBe('23.03.2022');
    expect(dateShort(null)).toBe('');
    expect(shiftDays('2026-09-06', -7)).toBe('2026-08-30');
    expect([1, 2, 5, 11, 21, 22].map((n) => plural(n, 'запіс', 'запісы', 'запісаў'))).toEqual(['запіс', 'запісы', 'запісаў', 'запісаў', 'запіс', 'запісы']);
    expect(num(6038)).toBe('6 038');
    expect(num(999)).toBe('999');
  });
  it('адно эмодзі на спіс, чатыры розныя; назва — адзін радок, абрэзаная', () => {
    expect(Object.keys(ICON).sort()).toEqual(['f', 'm', 'p', 'w']);
    expect(new Set(Object.values(ICON)).size).toBe(4);
    expect(Object.keys(NAME).sort()).toEqual(['f', 'm', 'p', 'w']);
    expect(title({ name: 'Назва  з\nпрабеламі;. ' })).toBe('Назва з прабеламі');
    expect(title(wanted)).toBe('Бабаян Ашот Бабкенович');
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
    expect(e).toContain(`${ICON.p} <b>3.</b> Ковалевский &lt;Николай&gt; &amp; Co`);
    expect(e).toContain('<i>23.03.2022 · ст. 342, &lt;b&gt; УК · суд Быховского района</i>');
    expect(e).not.toContain('<b>b</b>');
    expect(e).toContain(`<a href="${SITE}#/r/p1">Адкрыць запіс →</a></blockquote>`);
  });
  it('фарміраванне і матэрыял; без даты і суда радка мэты няма', () => {
    expect(entry(formation, 1, SITE)).toContain(`${ICON.f} <b>1.</b> Экстремистская организация «ТУТ БАЙ МЕДИА»\n<i>14.06.2022 · рашэнне суда · экстрэмісцкая арганізацыя</i>`);
    expect(entry(material, 2, SITE)).toContain(`${ICON.m} <b>2.</b> Telegram-канал "Свабода" с идентификатором https://t.me/svaboda\n<i>01.05.2026 · суд Ленинского района г. Минска</i>`);
    expect(entry({ ...material, date: null, court: '' }, 2, SITE)).not.toContain('<i>');
  });
  it('вышук РФ: імя ў звычайным рэгістры, без года нараджэння; эмодзі спіса — адно на запіс', () => {
    const e = entry(wanted, 10, SITE);
    expect(e).toContain(`${ICON.w} <b>10.</b> Бабаян Ашот Бабкенович\n<i>04.09.2026 · па запыце МВД · Гомельская область</i>`);
    expect(e).not.toContain('1980');
    expect(e.split(ICON.w)).toHaveLength(2);
    expect(entry({ ...wanted, agency: '', region: '' }, 1, SITE)).toContain('<i>04.09.2026 · база вышуку МУС РФ</i>');
    // ніводны запіс не нясе іншых эмодзі, апроч эмодзі свайго спіса
    for (const x of [person, formation, material, wanted]) expect(entry(x, 1, SITE).replace(ICON[x.list], '')).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('digestHeader', () => {
  it('некалькі спісаў — разбіўка новых па спісах і сума па ўсіх чатырох; дата — калі запісы трапілі ў базу; без эмодзі', () => {
    expect(digestHeader([material, formation, person, wanted], { today: '2026-09-06', totals: TOTALS })).toBe(
      '<b>Экстрэмісцкія спісы Беларусі: +4 новыя запісы</b>\n<i>5 верасня 2026 · матэрыялаў +1, фарміраванняў +1, асоб +1, у вышуку РФ +1 · ва ўсіх чатырох спісах 19 969</i>',
    );
    expect(digestHeader([wanted, wanted, material], { today: '2026-09-06', totals: TOTALS })).toBe(
      '<b>Экстрэмісцкія спісы Беларусі: +3 новыя запісы</b>\n<i>5 верасня 2026 · матэрыялаў +1, у вышуку РФ +2 · ва ўсіх чатырох спісах 19 969</i>',
    );
  });
  it('адзін спіс — яго назва, памер і сума па ўсіх', () => {
    expect(digestHeader([person], { totals: TOTALS })).toBe(`<b>${NAME.p}: +1 новы запіс</b>\n<i>5 верасня 2026 · у спісе 6 874, ва ўсіх чатырох спісах 19 969</i>`);
    expect(digestHeader([formation], { totals: TOTALS })).toBe(`<b>${NAME.f}: +1 новы запіс</b>\n<i>5 верасня 2026 · у спісе 377, ва ўсіх чатырох спісах 19 969</i>`);
    expect(digestHeader([material], { totals: TOTALS })).toBe(`<b>${NAME.m}: +1 новы запіс</b>\n<i>5 верасня 2026 · у спісе 6 038, ва ўсіх чатырох спісах 19 969</i>`);
    expect(digestHeader([wanted], { totals: TOTALS })).toBe(`<b>${NAME.w}: +1 новы запіс</b>\n<i>4 верасня 2026 · у спісе 6 680, ва ўсіх чатырох спісах 19 969</i>`);
  });
  it('пробная шапка — пазнака зверху, далей звычайная шапка з сённяшняй датай', () => {
    expect(digestHeader([material], { test: true, today: '2026-09-06', totals: TOTALS })).toBe(
      `🧪 <i>Пробнае паведамленне — так будуць выглядаць дайджэсты</i>\n\n<b>${NAME.m}: +1 новы запіс</b>\n<i>6 верасня 2026 · у спісе 6 038, ва ўсіх чатырох спісах 19 969</i>`,
    );
  });
});

describe('buildDigest — падзагалоўкі і разбіццё', () => {
  it('падзагалоўкі перад кожнай групай толькі ў змяшаным дайджэсце; футэр у канцы', () => {
    const mixed = buildDigest([material, formation, person, wanted], { site: SITE, today: '2026-09-06', totals: TOTALS });
    expect(mixed.messages).toHaveLength(1);
    for (const l of ['m', 'f', 'p', 'w']) expect(mixed.messages[0]).toContain(`\n\n${ICON[l]} <b>${NAME[l]}: +1</b>\n\n<blockquote>${ICON[l]} <b>`);
    expect(subheader('w', 74)).toBe(`${ICON.w} <b>${NAME.w}: +74</b>`);
    expect(mixed.ids).toEqual([['m1', 'f1', 'p1', 'w1']]);
    expect(mixed.messages[0].endsWith(`\n\n${digestFooter(SITE)}`)).toBe(true);
    const single = buildDigest([person, { ...person, id: 'p2' }], { site: SITE, today: '2026-09-06', totals: TOTALS });
    expect(single.messages[0]).not.toContain(`${NAME.p}: +2</b>`); // падзагалоўка няма
    expect(single.messages[0].split(NAME.p)).toHaveLength(2); // толькі ў шапцы
    expect(single.ids).toEqual([['p1', 'p2']]);
  });
  it('доўгі дайджэст: часткі ≤ 4096, нумарацыя «(i/n)» на працягах, id паштучна, футэр толькі ў апошняй', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...material, id: `m${i}`, name: `${material.name} №${i} ${'x'.repeat(150)}` }));
    const { messages, ids } = buildDigest(many, { site: SITE, today: '2026-09-06', totals: TOTALS });
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((m) => m.length <= 4096)).toBe(true);
    expect(ids).toHaveLength(messages.length);
    expect(ids.flat()).toEqual(many.map((x) => x.id));
    expect(messages[0]).toMatch(/^<b>Спіс экстрэмісцкіх матэрыялаў/);
    expect(messages[0]).not.toContain('Працяг дайджэсту');
    expect(messages[0]).not.toContain('RSS');
    messages.slice(1).forEach((m, i) => expect(m.startsWith(`<i>Працяг дайджэсту (${i + 2}/${messages.length})</i>\n\n`)).toBe(true));
    expect(messages[messages.length - 1]).toMatch(/RSS<\/a>$/);
    expect(messages.join('')).toContain('<b>40.</b>');
  });
  it('падзагаловак групы не адрываецца ад першага запісу пры разбіцці', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...material, id: `m${i}`, name: `${material.name} №${i} ${'x'.repeat(150)}` }));
    const { messages } = buildDigest([...many, wanted], { site: SITE, today: '2026-09-06', totals: TOTALS });
    const sub = subheader('w', 1);
    const part = messages.find((m) => m.includes(sub));
    expect(part).toContain(`${sub}\n\n<blockquote>${ICON.w} <b>31.</b>`);
    expect(messages.every((m) => !m.endsWith(sub))).toBe(true);
  });
});

describe('selectFresh', () => {
  const db = [
    { id: 'old', list: 'm', added: '2026-08-01', order: 0 },
    { id: 'm2', list: 'm', added: '2026-09-05', order: 5 },
    { id: 'm1', list: 'm', added: '2026-09-05', order: 2 },
    { id: 'p1', list: 'p', added: '2026-09-04', order: 0 },
    { id: 'f1', list: 'f', added: '2026-09-05', order: 0 },
    { id: 'w1', list: 'w', added: '2026-09-05', order: 1 },
    { id: 'w0', list: 'w', added: '2026-09-04', order: 7 },
    { id: 'sent', list: 'm', added: '2026-09-05', order: 1 },
    { id: 'fix', list: 'm', added: '2026-09-05', order: 9, editOf: 'sent0' },
    { id: 'fix2', list: 'm', added: '2026-09-05', order: 10, editOf: 'unsent0' },
    { id: 'none', list: 'm', added: null },
  ];
  it('акно, дасланыя, папярэднія версіі праўак; парадак: спіс → дата → месца', () => {
    expect(selectFresh(db, { sent: '2026-09-05', sent0: '2026-09-01' }, '2026-08-30').map((x) => x.id)).toEqual(['m1', 'm2', 'fix2', 'f1', 'p1', 'w0', 'w1']);
    expect(selectFresh(db, {}, '2026-09-06')).toEqual([]);
  });
});
