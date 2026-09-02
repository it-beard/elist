import { describe, it, expect } from 'vitest';
import { parseRows } from '../scripts/parse.mjs';
import { isEdit, pairEdits } from '../scripts/merge.mjs';

// Фрагмент цела .doc як яго аддае word-extractor: радкі — «\t\n», ячэйкі — «\t».
const HEADER = 'РЕСПУБЛИКАНСКИЙ СПИСОК ЭКСТРЕМИСТСКИХ МАТЕРИАЛОВ\n\nВид экстремистских материалов (символика и атрибутика, информационная продукция)\tНаименование, автор, изготовитель символики и атрибутики, информационной продукции\tНаименование суда, вынесшего решение, и дата вступления его в силу';
const ROW1 = 'Информационная продукция\tCD-R диски:\n     "Урок Беларускае мовы";\n     "MEGAUS MEG 16753"\n(изъяты у гр-на Н.) \n\tРешение суда Октябрьского района г. Гродно от 4 сентября 2008 года, вступило в законную силу 16 сентября 2008 года';
const ROW2 = 'Информационная продукция\n\tTikTok-аккаунта "belarus_bez" с идентификатором https://www.tiktok.com/@belarus_bez\n\tРешение суда Лидского района Гродненской области от 8 августа 2024 года.\nПодлежит немедленному исполнению в соответствии с 314 статьей Гражданского процессуального кодекса';
const ROW3 = 'Информационная продукция\tКанал видеохостинга "YouTube" под названием "belarusworld", имеющий идентификатор https://www.youtube.com/@belarusworld/featured.\tРешение суда Центрального района г. Минска \nот 21 августа 2026 года.\nПодлежит немедленному исполнению в соответствии со статьей 302 Кодекса гражданского судопроизводства Республики Беларусь';
const BODY = [HEADER, ROW1, ROW2, ROW3, '\n'].join('\t\n');

describe('parseRows', () => {
  const rows = parseRows(BODY);
  it('прапускае загаловак і пусты хвост', () => expect(rows).toHaveLength(3));
  it('раскладвае тып / назву / суд і дату', () => {
    expect(rows[0].type).toBe('Информационная продукция');
    expect(rows[0].name.startsWith('CD-R диски:')).toBe(true);
    expect(rows[0].date).toBe('2008-09-04');
    expect(rows[1].type).toBe('Информационная продукция');
    expect(rows[1].name.startsWith('TikTok-аккаунта')).toBe(true);
    expect(rows[2].court).toMatch(/^Решение суда Центрального района/);
    expect(rows[2].date).toBe('2026-08-21');
  });
  it('id стабільны і залежыць ад тэксту', () => {
    expect(rows[0].id).toMatch(/^[0-9a-f]{12}$/);
    expect(parseRows(BODY)[0].id).toBe(rows[0].id);
    expect(parseRows(BODY.replace('MEGAUS', 'MEGAUX'))[0].id).not.toBe(rows[0].id);
  });
});

describe('pairEdits', () => {
  const court = 'Решение суда\nБарановичского района и г.Барановичи\nот 29 июля 2026 года.';
  const type = 'Информационная продукция';
  const old = { id: 'a', type, name: 'Threads-аккаунт "belarusiancorps" с идентификатором  https://www.threads.com/ belarusiancorps.', court };
  const fixed = { id: 'b', type, name: 'Threads-аккаунт "belarusiancorps" с идентификатором  https://www.threads.com/belarusiancorps.', court };
  const other = { id: 'c', type, name: 'Telegram-канал "Свабода" с идентификатором https://t.me/svaboda', court };
  it('пазнае выпраўленую памылку друку (рэальны выпадак з базы)', () => {
    expect(pairEdits([old], [fixed, other])).toEqual([[old, fixed]]);
  });
  it('абрэзаны радок — таксама праўка', () => {
    const cut = { ...old, id: 'd', name: old.name.slice(0, 50), court: 'Решение суда\nБарановичского района и г.Барановичи\nот 29 июля' };
    expect(pairEdits([cut], [fixed])).toEqual([[cut, fixed]]);
  });
  it('іншы суд, іншы тып ці іншая назва — не праўка', () => {
    expect(isEdit(old, { ...fixed, court: 'Решение суда Ленинского района г. Минска от 1 мая 2026 года.' })).toBe(false);
    expect(isEdit(old, { ...fixed, type: 'Символика и атрибутика' })).toBe(false);
    expect(pairEdits([old], [other])).toEqual([]);
  });
  it('неадназначнасць — не рызыкуем', () => {
    expect(pairEdits([old], [fixed, { ...fixed, id: 'e' }])).toEqual([]);
  });
  it('масавае знікненне — гэта не праўкі', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ ...old, id: `o${i}` }));
    expect(pairEdits(many, [fixed])).toEqual([]);
  });
});
