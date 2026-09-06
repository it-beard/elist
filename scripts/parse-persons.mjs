/**
 * Разбор пераліку фізічных асоб МУС (.doc → запісы) і зліццё з базай. Чыстыя функцыі без сеткі і файлаў.
 *
 * Табліца з 9 калонак: № | ФІО (руская) | лацінская транслітарацыя | грамадзянства | дата нараджэння |
 * падстава («Вступивший в законную силу приговор … суда … статьи 342 УК») | дата ўключэння | месцазнаходжанне |
 * даведка («Отбывает наказание», «Судимость не погашена»…). word-extractor аддае ячэйкі праз «\t», але межы радкоў
 * нераўнамерныя («\t\n», «\t\t», пачкі пустых ячэек на разрывах старонак), у свежай частцы новыя запісы яшчэ без
 * нумароў, часам сустракаецца лішняя пустая ячэйка пасля імя ці пустое грамадзянства, а выключаныя асобы
 * застаюцца нумарам з прочыркамі. Таму разбор ідзе не па радках, а па «якары» — ячэйцы падставы з датай побач.
 *
 * Крыніца — чужы сервер, таму ўсе рэгулярныя выразы лінейныя, ячэйкі абразаюцца да MAX_CELL, а «галава» запісу
 * правяраецца на форму: чужыя ячэйкі з сапсаванага суседняга радка ніколі не становяцца чыімсьці імем.
 */
import crypto from 'node:crypto';
import { idNormalize } from '../src/lib/identity.js';
import { levenshtein } from '../src/lib/fuzzy.js';
import { allDates, extractArticles, firstDateIso, personCourt } from '../src/lib/person.js';
import { mergeList, pairEdits } from './merge.mjs';

const DATE = /\d{1,2}\.\d{2}\.\d{2,4}/;      // «07.04.198» (памылка друку) — таксама дата, каб не зрушыць калонкі
// Падстава: «приговор(а/ы)» / «постановление» / «определение» асобным словам («определенного места жительства» —
// не падстава) плюс згадка суда ці артыкула, і не карацейшая за MIN_BASIS.
const BASIS_WORD = /(^|[^а-яё])(приговор[а-яё]*|постановлени[ея]|определени[ея])(?![а-яё])/i;
const BASIS_CTX = /суд|стат/i;
const MIN_BASIS = 40;
const MAX_CELL = 5000;                        // ячэйкі табліцы — сотні сімвалаў; даўжэйшае абразаем
const CYR = /[а-яё]/i, LAT = /[a-z]/i;
const DASH = /^[-—–.\s]*$/;
const NUM = /^\d+$/;
// Не імя: грамадзянства, статус з даведкі, адрас (для выбару імя ў «галаве» запісу)
const NOT_NAME = /республик|федерац|гражданств|^рф$|^(отбывает|судимость|находится|освобожд[а-яё]*|принудительн[а-яё]*|признан[а-яё]*|отсрочка|применен[а-яё]*|умер[а-яё]*)(?![а-яё])|област|район|(^|\s)(г|д|аг|гп|п|ул)\.\s/i;

/** Ячэйка → адзін радок без лішніх прабелаў (лінейна); «Республика Беларусь,\nг. Минск» → «Республика Беларусь, г. Минск». */
export const oneLine = (s) => (s || '').replace(/\s+/g, ' ').replace(/ ,/g, ',').trim();

const isLatin = (s) => (s.match(/[a-z]/gi) || []).length > (s.match(/[а-яё]/gi) || []).length;
const isBasis = (c) => c.length >= MIN_BASIS && BASIS_WORD.test(c) && BASIS_CTX.test(c);
/** Падобна на імя: два і больш словы з літар (дэфіс, апостраф, дужкі), без лічбаў і косак, не статус/адрас/грамадзянства. */
const nameLike = (c) => c.length <= 80 && /^[А-ЯЁа-яёA-Za-z][А-ЯЁа-яёA-Za-z'’ʼ()\-\s]+$/.test(c) && c.trim().split(/\s+/).length >= 2 && !NOT_NAME.test(c);

/** id = sha1 ад імя + даты нараджэння + першай даты ўключэння (замарожаная нармалізацыя identity.js). */
export const personId = (name, birth, included) =>
  crypto.createHash('sha1').update(`person|${idNormalize(oneLine(name))}|${oneLine(birth)}|${allDates(included)[0] || ''}`).digest('hex').slice(0, 12);

/**
 * Цела .doc → запісы. Радок распазнаецца па ячэйцы падставы, побач з якой ёсць дата (нараджэння перад ёй
 * ці ўключэння за ёй); далей назад да канца папярэдняга запісу збіраецца «галава»: нумар (апошняя лічбавая
 * ячэйка, за якой ідуць даныя, а не прочыркі), імя (апошняя кірылічная ячэйка, падобная на імя; няма такой — першая
 * кірылічная, што не грамадзянства/статус/адрас, інакш якар прапускаецца), транслітарацыя (лацінская),
 * грамадзянства (кірылічныя пасля імя). Лішнія ячэйкі ў галаве — рэшткі сапсаванага радка —
 * адкідаюцца і лічацца, а не трапляюць у запіс. Нумары з прочыркамі ці пустымі ячэйкамі — выключаныя асобы.
 * stats (неабавязкова) запаўняецца для логу і меты: excluded — выключаных, skipped — якараў без імя,
 * unanchored — падстаў без даты побач, leftover — адкінутых ячэек (пасля першага запісу; загаловак табліцы
 * не лічыцца), noIncluded — запісаў без даты ўключэння; stats.dropped (калі перададзены масіў) — самі адкінутыя ячэйкі.
 */
export function parsePersons(body, stats = {}) {
  const cells = body.replace(/\r/g, '').split('\t').map((c) => (c.length > MAX_CELL ? c.slice(0, MAX_CELL) : c).replace(/ /g, ' ').trim());
  const items = [];
  let prevEnd = -1;
  Object.assign(stats, { excluded: 0, skipped: 0, unanchored: 0, leftover: 0, noIncluded: 0 });
  // адкінутыя ячэйкі лічым толькі пасля першага запісу: перад ім — загаловак табліцы
  const drop = (list) => { if (!items.length || !list.length) return; stats.leftover += list.length; if (stats.dropped) stats.dropped.push(...list.map((c) => c.slice(0, 80))); };
  for (let i = 1; i < cells.length; i++) {
    if (!isBasis(cells[i])) continue;
    const birthBefore = DATE.test(cells[i - 1]) && cells[i - 1].length <= 14;
    const dateAfter = DATE.test(cells[i + 1] || '');
    // падстава без ніводнай даты побач — не радок табліцы (ці зусім сапсаваны): паглынаем ячэйку, каб не «ўцякла» ў суседа
    if (!birthBefore && !dateAfter) { stats.unanchored++; prevEnd = Math.max(prevEnd, i); continue; }
    let j = i - 1;
    const birth = birthBefore ? cells[j--] : '';
    const head = [];
    for (let k = prevEnd + 1; k <= j; k++) {
      const c = cells[k];
      if (!c || DASH.test(c)) continue;
      if (NUM.test(c)) {
        const next = cells[k + 1] ?? '';
        if (!next || DASH.test(next)) { stats.excluded++; continue; } // нумар без даных — выключаная асоба
      }
      head.push(c);
    }
    let numAt = -1;
    head.forEach((c, k) => { if (NUM.test(c)) numAt = k; });
    const num = numAt >= 0 ? Number(head[numAt]) : null;
    drop(head.slice(0, Math.max(0, numAt))); // усё перад апошнім нумарам — рэшткі чужога радка
    let rest = head.slice(numAt + 1);
    if (rest.length > 3) { drop(rest.slice(0, rest.length - 3)); rest = rest.slice(-3); } // імя, транслітарацыя, грамадзянства — не болей
    const lat = rest.filter((c) => LAT.test(c) && isLatin(c));
    const cyr = rest.filter((c) => CYR.test(c) && !isLatin(c));
    let nameAt = -1;
    cyr.forEach((c, k) => { if (nameLike(c)) nameAt = k; });
    // няма ячэйкі, падобнай на імя, — першая кірылічная, што не грамадзянства/статус/адрас (імя з аднаго слова); няма — якар без імя
    if (nameAt < 0) nameAt = cyr.findIndex((c) => !NOT_NAME.test(c));
    if (nameAt < 0) { stats.skipped++; prevEnd = i + (dateAfter ? 3 : 2); continue; }
    drop(cyr.slice(0, nameAt));
    const name = oneLine(cyr[nameAt]);
    // дата ўключэння, адрас, даведка — за падставай; калі даты ўключэння няма, пустая ячэйка (калі яна ёсць) прапускаецца
    let k = i + 1;
    let included = '';
    if (dateAfter) included = cells[k++];
    else { stats.noIncluded++; if (cells[k] === '') k++; }
    const dates = allDates(included);
    const basis = oneLine(cells[i]);
    const articles = extractArticles(basis);
    items.push({
      id: personId(name, birth, included),
      num,
      name,
      translit: oneLine(lat.join(' ')),
      citizenship: oneLine(cyr.slice(nameAt + 1).join(' ')),
      birth: oneLine(birth),
      basis,
      court: personCourt(basis),
      articles,
      included: dates.length ? dates.join(', ') : oneLine(included),
      date: firstDateIso(included),
      address: oneLine(cells[k] || ''),
      info: oneLine(cells[k + 1] || ''),
    });
    prevEnd = k + 1;
  }
  return items;
}

const MAX_PAIRS = 60;

/** Тое ж імя з дакладнасцю да пары літар (выпраўленая памылка друку). */
function similarName(a, b) {
  const na = idNormalize(a.name || ''), nb = idNormalize(b.name || '');
  if (!na || !nb) return false;
  if (na === nb) return true;
  const max = Math.max(2, Math.round(Math.max(na.length, nb.length) * 0.15));
  return levenshtein(na, nb, max) <= max;
}

const sameName = (a, b) => idNormalize(a.name || '') === idNormalize(b.name || '');

/**
 * Праўка ў крыніцы (а не новы чалавек): тая ж дата ўключэння і — або тая ж дата нараджэння з амаль тым жа
 * імем (выпраўлена памылка друку ў імені), або тое ж імя з іншай датай нараджэння (выпраўлена дата).
 * Стары запіс без даты ўключэння (прапушчаная ці з памылкай друку, пазней выпраўленая) — праўка пры тым жа імені
 * і той жа непустой даце нараджэння.
 */
export const isPersonEdit = (oldRec, newRec) => {
  if (!oldRec.date) return Boolean(oldRec.birth) && oldRec.birth === newRec.birth && sameName(oldRec, newRec);
  return oldRec.date === newRec.date && (
    (oldRec.birth === newRec.birth && similarName(oldRec, newRec))
    || (oldRec.birth !== newRec.birth && sameName(oldRec, newRec))
  );
};

/** Пары [стары, новы] сярод зніклых і новых (гл. pairEdits у merge.mjs); зніклых больш за MAX_PAIRS — не праўкі. */
export const pairPersonEdits = (removed, added) => pairEdits(removed, added, isPersonEdit, MAX_PAIRS);

/** Палі, змена якіх лічыцца праўкай існага запісу (нумар, дапісаная дата ўключэння, статус, адрас…). */
const FIELDS = ['num', 'name', 'translit', 'citizenship', 'birth', 'basis', 'court', 'articles', 'included', 'date', 'address', 'info'];

/**
 * Зліццё разабраных запісаў з базай — mergeList (merge.mjs) з палямі FIELDS і праўкамі isPersonEdit: той жа id —
 * праўка палёў моўчкі (edited); новы id — added = today (пры першым імпарце null); зніклы — removed = today;
 * «зніклы» + «новы» з той жа датай уключэння і амаль тым жа імем ці датай нараджэння — праўка (editOf/replacedBy).
 * Засцярогі: знікла больш за max(20, 5 %) або дадалося больш за maxAdded (без force) — памылка, база не змяняецца.
 * Вяртае { out, added, removed, edited, edits, initial }.
 */
export const mergePersons = (db, parsed, { today, force = false, maxAdded = 300 } = {}) =>
  mergeList(db, parsed, { today, force, maxAdded, fields: FIELDS, isEdit: isPersonEdit, maxPairs: MAX_PAIRS });
