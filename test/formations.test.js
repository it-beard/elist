import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readXlsx, sheetRows, sharedStrings, excelDate, unescapeXml } from '../scripts/xlsx.mjs';
import { parseFormations, firstDecision, formationId, anyDate, decidedBy } from '../scripts/parse-formations.mjs';
import { findXlsxUrl } from '../scripts/update-formations.mjs';
import { search } from '../src/lib/search.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'formations-sample.xlsx');

describe('xlsx.mjs', () => {
  const rows = readXlsx(fs.readFileSync(FIXTURE));
  it('чытае ZIP (stored і deflate) і аддае радкі з ячэйкамі па літарах калонак', () => {
    expect(rows.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(rows[2].cells.A).toBe('1.');           // inlineStr
    expect(rows[2].cells.B).toMatch(/^Экстремистское формирование/); // shared string
    expect(rows[2].cells.G).toBe('44487');        // лічба застаецца радком
    expect(rows[3].cells.C).toBeUndefined();      // пустая ячэйка прапускаецца
    expect(rows[6].cells).toEqual({});
  });
  it('склейвае рытч-тэкст і разэкраноўвае сутнасці', () => {
    expect(rows[4].cells.I).toBe('Rich & <text>');
    expect(unescapeXml('a &amp; b &#1072;&#x430; &quot;')).toBe('a & b аа "');
    expect(sharedStrings('<sst><si><t>x</t></si><si><r><t>y</t></r><r><t>z</t></r></si></sst>')).toEqual(['x', 'yz']);
    expect(sheetRows('<row r="9"><c r="B9" t="s"><v>1</v></c><c r="C9"/></row>', ['a', 'b'])).toEqual([{ n: 9, cells: { B: 'b' } }]);
  });
  it('серыял даты Excel → ISO', () => {
    expect(excelDate('44487')).toBe('2021-10-18');
    expect(excelDate(45000.5)).toBe('2023-03-15');
    expect(excelDate('29.10.2021')).toBe(null);
    expect(excelDate('')).toBe(null);
  });
});

describe('parseFormations', () => {
  const items = parseFormations(readXlsx(fs.readFileSync(FIXTURE)));
  it('бярэ толькі пранумараваныя радкі', () => {
    expect(items).toHaveLength(4);
    expect(items.map((x) => x.name)).toEqual([
      'Экстремистское формирование «dze.chat»',
      'Экстремистское формирование «Кибер-Партизаны» / «Кибер-сливы»',
      'Экстремистское формирование «ХАТА»',
      'Экстремистская организация «ТУТ БАЙ МЕДИА»',
    ]);
  });
  it('раскладвае палі, даты і хто прыняў рашэнне', () => {
    const [a, b, c, d] = items;
    expect(a).toMatchObject({ kind: 'formation', alias: '«dze.chat»', links: 'https://dze.chat', decidedBy: 'mvd', date: '2021-10-18', included: '2021-10-18' });
    expect(a.info).toMatch(/^Группа граждан/);
    expect(a.logo).toMatch(/^Логотип\nв виде/);
    expect(b.links).toBe('https://t.me/cpartisans\n\nhttps://t.me/cpartisans_dumps');
    expect(b.basis).toContain('№ 15ЭК');
    // аб’яднаныя ячэйкі: спасылак няма, дата — з тэксту з дзвюма датамі (першая)
    expect(c).toMatchObject({ links: '', address: '', decidedBy: 'kgb', date: '2021-10-29', included: '2022-08-09' });
    expect(d).toMatchObject({ kind: 'organization', decidedBy: 'court', date: '2022-06-14', included: '2022-06-18' });
  });
  it('id стабільны: назва + першае рашэнне; дапісанае рашэнне ці праўка даведкі яго не мяняюць', () => {
    expect(items[0].id).toMatch(/^[0-9a-f]{12}$/);
    const basis1 = 'Решение МВД от 21.10.2021 № 4ЭК\n«О признании…»';
    const basis2 = `${basis1} Решение МВД от 20.08.2026 № 15ЭК "О внесении дополнений"`;
    expect(firstDecision(basis1)).toBe('21.10.2021 4ЭК');
    expect(firstDecision(basis2)).toBe('21.10.2021 4ЭК');
    expect(firstDecision('Решение КГБ\nот 04.08.2022 № 4/8-1279')).toBe('04.08.2022 4/8-1279');
    expect(firstDecision('Решение Экономического суда г. Минска\nот 14.06.2022')).toBe('14.06.2022');
    expect(formationId('Экстремистское формирование «X»', basis1)).toBe(formationId('Экстремистское  формирование «X»', basis2));
    expect(formationId('Экстремистское формирование «X»', basis1)).not.toBe(formationId('Экстремистское формирование «Y»', basis1));
    // не перасякаецца з id матэрыялаў таго ж тэксту (іншы прэфікс ключа)
    expect(formationId('a', '')).not.toBe(formationId('b', ''));
  });
  it('дапаможныя функцыі', () => {
    expect(anyDate('23.09.2022 13.04.2023')).toBe('2022-09-23');
    expect(anyDate('44460')).toBe('2021-09-21');
    expect(anyDate('')).toBe(null);
    expect(decidedBy('Решение Комитета государственной безопасности')).toBe('kgb');
    expect(decidedBy('Решение Министерства внутренних дел')).toBe('mvd');
    expect(decidedBy('')).toBe(null);
  });
});

describe('findXlsxUrl', () => {
  const page = 'https://www.mvd.gov.by/ru/news/8642';
  it('бярэ xlsx з подпісам пра арганізацыі, адносныя спасылкі робіць абсалютнымі', () => {
    const html = `<a href="/uploads/news/8642/aaa.doc">Перечень граждан … Часть 1</a>
      <a class="x" href="/uploads/news/8642/other.xlsx"><span>Нешта іншае</span></a>
      <a href="/uploads/news/8642/bbb.xlsx">Перечень организаций, формирований, индивидуальных предпринимателей_25.08.2026</a>`;
    expect(findXlsxUrl(html, page)).toBe('https://www.mvd.gov.by/uploads/news/8642/bbb.xlsx');
  });
  it('без подпісу — першы xlsx; без xlsx — памылка', () => {
    expect(findXlsxUrl('<a href="https://x.by/f.xlsx">файл</a>', page)).toBe('https://x.by/f.xlsx');
    expect(() => findXlsxUrl('<a href="/f.doc">doc</a>', page)).toThrow(/xlsx/);
  });
});

describe('пошук па двух спісах', () => {
  const items = [
    { i: 0, id: 'm1', list: 'm', date: '2026-01-01', h: 'канал "свабода" https://t.me/svaboda' },
    { i: 1, id: 'f1', list: 'f', date: '2026-02-01', h: 'экстремистское формирование «свабода» https://t.me/svaboda_chat\nрешение мвд' },
    { i: 2, id: 'm2', date: '2026-03-01', h: 'газета "наша ніва"' }, // стары індэкс без поля list = матэрыял
  ];
  it('без фільтра выдача змяшаная, з фільтрам — адзін спіс', () => {
    expect(search(items, ['свабода']).map((x) => x.id)).toEqual(['f1', 'm1']);
    expect(search(items, ['свабода'], { list: 'm' }).map((x) => x.id)).toEqual(['m1']);
    expect(search(items, ['свабода'], { list: 'f' }).map((x) => x.id)).toEqual(['f1']);
    expect(search(items, [], { list: 'm' }).map((x) => x.id)).toEqual(['m2', 'm1']);
  });
});
