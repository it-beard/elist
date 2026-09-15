/**
 * Разбор пераліку КДБ «организаций и физических лиц, причастных к террористической деятельности» (.xlsx → запісы)
 * і зліццё з базай. Чыстыя функцыі без сеткі і файлаў.
 *
 * Кніга з трох лістоў: «Перечень физических лиц», «Перечень организаций», «Перечень террорист. организаций»; бярэцца
 * ліст фізічных асоб (па назве). Калонкі: A № п/п (пастаянны нумар — нумары выключаных не перавыкарыстоўваюцца),
 * B ФІО (руская), C транслітарацыя (часам з дапіскай «может быть известен как …»), D грамадзянства, E дата нараджэння
 * (серыял Excel ці тэкст), F адрас, G падстава («Вступил в законную силу приговор суда … ст. 295 УК» або
 * «Обвиняется по ст. 289 УК» — прысуду яшчэ няма), H даведка. Дат уключэння ў пералік няма. Каля паловы радкоў —
 * замежнікі з санкцыйных пералікаў ААН (падстава «Санкционный перечень … ООН»): яны прапускаюцца. «д/о» — пустое поле.
 *
 * Крыніца — чужы файл: ячэйкі абразаюцца да MAX_CELL, у запіс трапляюць толькі вядомыя калонкі.
 */
import crypto from 'node:crypto';
import { idNormalize } from '../src/lib/identity.js';
import { levenshtein } from '../src/lib/fuzzy.js';
import { extractArticles } from '../src/lib/person.js';
import { UN_BASIS } from '../src/lib/terror.js';
import { excelDate } from './xlsx.mjs';
import { mergeList, pairEdits } from './merge.mjs';

const MAX_CELL = 2000;
const NA = /^д\s*\/\s*о\.?$/i; // «д/о» — даных няма
const AKA = /\s*,?\s*(?:на основании[^:]*?|может быть также|может быть)\s*(?:известен|известна|известны)\s+как:?\s*/i;
const MAX_PAIRS = 60;

/** Ячэйка → адзін радок без лішніх прабелаў, абрэзаная. */
export const oneLine = (s) => String(s ?? '').slice(0, MAX_CELL).replace(/\s+/g, ' ').replace(/ ,/g, ',').trim();
const field = (s) => { const v = oneLine(s); return NA.test(v) ? '' : v; };

/** id = sha1 ад імя і даты нараджэння (замарожаная нармалізацыя identity.js); нумар КДБ у id не ідзе — перанумарацыя не зробіць усіх «новымі». */
export const terrorId = (name, birth) =>
  crypto.createHash('sha1').update(`terror|${idNormalize(oneLine(name))}|${oneLine(birth)}`).digest('hex').slice(0, 12);

/** Дата нараджэння: серыял Excel (ад 1900 года — у пераліку ёсць людзі 1930–1950-х) ці «дд.мм.гггг» у тэксце → «дд.мм.гггг»; іншае — як ёсць. */
export function birthText(v) {
  const iso = excelDate(v, 1);
  if (iso) return iso.split('-').reverse().join('.');
  const s = oneLine(v);
  const m = s.match(/(\d{1,2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[1].padStart(2, '0')}.${m[2]}.${m[3]}` : NA.test(s) ? '' : s;
}

/** Ячэйка транслітарацыі: «KANAVALAU ALEH … также известен как: Шутов Олег Анатольевич» → { translit, aka }. */
export function splitTranslit(v) {
  const s = oneLine(v);
  const m = s.match(AKA);
  if (!m) return { translit: NA.test(s) ? '' : s, aka: '' };
  const translit = s.slice(0, m.index).trim();
  return { translit: NA.test(translit) ? '' : translit, aka: s.slice(m.index + m[0].length).trim() };
}

/**
 * Лісты кнігі (readXlsxSheets) → запісы фізічных асоб з нацыянальнай падставай (прысуд ці абвінавачанне ў Беларусі,
 * незалежна ад грамадзянства). stats: total — пранумараваных радкоў на лісце, un — прапушчаных запісаў з санкцыйных
 * пералікаў ААН, skipped — радкоў без імя ці падставы, noBirth — запісаў без даты нараджэння «дд.мм.гггг».
 */
export function parseTerror(sheets, stats = {}) {
  const sheet = (sheets || []).find((s) => /физическ/i.test(s.name || '')) || sheets?.[0];
  if (!sheet) throw new Error('У файле няма лістоў');
  Object.assign(stats, { total: 0, un: 0, skipped: 0, noBirth: 0 });
  const items = [];
  for (const { cells } of sheet.rows) {
    const num = oneLine(cells.A);
    if (!/^\d+$/.test(num)) continue;
    stats.total++;
    const name = oneLine(cells.B), basis = oneLine(cells.G);
    if (!name || !basis) { stats.skipped++; continue; }
    if (UN_BASIS.test(basis)) { stats.un++; continue; }
    const birth = birthText(cells.E);
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(birth)) stats.noBirth++;
    const { translit, aka } = splitTranslit(cells.C);
    items.push({
      id: terrorId(name, birth),
      num: Number(num),
      name,
      translit,
      aka,
      citizenship: field(cells.D),
      birth,
      address: field(cells.F),
      basis,
      articles: extractArticles(basis),
      info: field(cells.H),
    });
  }
  return items;
}

/** Тое ж імя з дакладнасцю да пары літар (выпраўленая памылка друку). */
function similarName(a, b) {
  const na = idNormalize(a.name || ''), nb = idNormalize(b.name || '');
  if (!na || !nb) return false;
  if (na === nb) return true;
  const max = Math.max(2, Math.round(Math.max(na.length, nb.length) * 0.15));
  return levenshtein(na, nb, max) <= max;
}
const sameName = (a, b) => idNormalize(a.name || '') === idNormalize(b.name || '');

/** Праўка ў крыніцы, а не іншы чалавек: тая ж дата нараджэння і амаль тое ж імя, або тое ж імя і іншая дата. */
export const isTerrorEdit = (oldRec, newRec) => (
  (oldRec.birth === newRec.birth && similarName(oldRec, newRec))
  || (oldRec.birth !== newRec.birth && Boolean(oldRec.birth) && sameName(oldRec, newRec))
);

/** Пары [стары, новы] сярод зніклых і новых (гл. pairEdits у merge.mjs). */
export const pairTerrorEdits = (removed, added) => pairEdits(removed, added, isTerrorEdit, MAX_PAIRS);

/** Палі, змена якіх лічыцца праўкай існага запісу (нумар, транслітарацыя, адрас, дапоўненая падстава…). */
const FIELDS = ['num', 'name', 'translit', 'aka', 'citizenship', 'birth', 'address', 'basis', 'articles', 'info'];

/**
 * Зліццё з базай — mergeList (merge.mjs) з палямі FIELDS і праўкамі isTerrorEdit: той жа id — праўка палёў моўчкі,
 * новы — added = today (пры першым імпарце null), зніклы — removed = today, вярнуўся — зноў жывы. Дат уключэння крыніца
 * не дае, таму новы запіс атрымлівае since — дату версіі пераліку (listDate: з паведамлення ў канале ці з docProps
 * файла), у якой ён з’явіўся; пры першым імпарце since няма (невядома, калі чалавека ўключылі). Праўка наследуе
 * since старой версіі. Засцярогі mergeList: знікла больш за max(20, 5 %) — памылка заўсёды; дадалося больш за
 * maxAdded — без force. Вяртае { out, added, removed, edited, edits, initial }.
 */
export function mergeTerror(db, parsed, { today, force = false, maxAdded = 100, listDate = null } = {}) {
  const res = mergeList(db, parsed, { today, force, maxAdded, fields: FIELDS, isEdit: isTerrorEdit, maxPairs: MAX_PAIRS });
  const paired = new Set();
  for (const [old, rec] of res.edits) { paired.add(rec.id); if (old.since) rec.since = old.since; }
  if (!res.initial && listDate) for (const x of res.out) if (x.added === today && !paired.has(x.id) && !x.since) x.since = listDate;
  return res;
}
