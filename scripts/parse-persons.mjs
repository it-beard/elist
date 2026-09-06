/**
 * Разбор пераліку фізічных асоб МУС (.doc → запісы). Чыстыя функцыі без сеткі і файлаў.
 *
 * Табліца з 9 калонак: № | ФІО (руская) | лацінская транслітарацыя | грамадзянства | дата нараджэння |
 * падстава («Вступивший в законную силу приговор … суда … статьи 342 УК») | дата ўключэння | месцазнаходжанне |
 * даведка («Отбывает наказание», «Судимость не погашена»…). word-extractor аддае ячэйкі праз «\t», але межы радкоў
 * нераўнамерныя («\t\n», «\t\t», пачкі пустых ячэек на разрывах старонак), у свежай частцы новыя запісы яшчэ без
 * нумароў, часам сустракаецца лішняя пустая ячэйка пасля імя ці пустое грамадзянства, а выключаныя асобы
 * застаюцца нумарам з прочыркамі. Таму разбор ідзе не па радках, а па «якары» — ячэйцы падставы, за якой ідзе дата.
 */
import crypto from 'node:crypto';
import { idNormalize } from '../src/lib/identity.js';
import { levenshtein } from '../src/lib/fuzzy.js';
import { allDates, extractArticles, firstDateIso, personCourt } from '../src/lib/person.js';

const DATE = /\d{1,2}\.\d{2}\.\d{2,4}/;      // «07.04.198» (памылка друку) — таксама дата, каб не зрушыць калонкі
const BASIS = /приговор|постановлен|определен/i;
const CYR = /[а-яё]/i, LAT = /[a-z]/i;
const DASH = /^[-—–.\s]*$/;

/** Ячэйка → адзін радок без лішніх прабелаў; «Республика Беларусь,\nг. Минск» → «Республика Беларусь, г. Минск». */
export const oneLine = (s) => (s || '').replace(/ /g, ' ').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();

const isLatin = (s) => (s.match(/[a-z]/gi) || []).length > (s.match(/[а-яё]/gi) || []).length;

/** id = sha1 ад імя + даты нараджэння + першай даты ўключэння (замарожаная нармалізацыя identity.js). */
export const personId = (name, birth, included) =>
  crypto.createHash('sha1').update(`person|${idNormalize(oneLine(name))}|${oneLine(birth)}|${allDates(included)[0] || ''}`).digest('hex').slice(0, 12);

/**
 * Цела .doc → запісы. Радок распазнаецца па ячэйцы падставы, за якой ідзе ячэйка з датай уключэння;
 * перад падставай — дата нараджэння (калі яна ёсць), а далей назад да канца папярэдняга запісу — «галава»:
 * нумар (апошняя суцэльна лічбавая ячэйка), імя (першая кірылічная), транслітарацыя (лацінская),
 * грамадзянства (рэшта кірылічных). Нумары з прочыркамі ці пустымі ячэйкамі — выключаныя асобы, прапускаюцца.
 * stats (неабавязкова) запаўняецца для логу: excluded — выключаных, skipped — якараў без імя,
 * unanchored — ячэек з падставай без даты побач (магчыма, страчаныя запісы).
 */
export function parsePersons(body, stats = {}) {
  const cells = body.replace(/\r/g, '').split('\t').map((c) => c.replace(/ /g, ' ').trim());
  const items = [];
  let prevEnd = -1;
  stats.excluded = 0; stats.skipped = 0; stats.unanchored = 0;
  for (let i = 1; i + 1 < cells.length; i++) {
    if (!BASIS.test(cells[i]) || cells[i].length < 20) continue;
    if (!DATE.test(cells[i + 1])) { stats.unanchored++; continue; } // падстава без даты ўключэння побач — не наш радок
    let j = i - 1;
    const birth = DATE.test(cells[j]) && cells[j].length <= 14 ? cells[j--] : '';
    const head = [];
    for (let k = prevEnd + 1; k <= j; k++) if (cells[k] && !DASH.test(cells[k])) head.push(cells[k]);
    // выключаныя асобы: нумар без даных перад нумарам гэтага запісу — лічым і адкідаем усё да апошняга нумара
    let numAt = -1;
    head.forEach((c, k) => { if (/^\d+$/.test(c)) numAt = k; });
    stats.excluded += Math.max(0, head.filter((c) => /^\d+$/.test(c)).length - 1);
    const num = numAt >= 0 ? Number(head[numAt]) : null;
    const rest = head.slice(numAt + 1);
    const cyr = rest.filter((c) => CYR.test(c) && !isLatin(c));
    const lat = rest.filter((c) => LAT.test(c) && isLatin(c));
    const name = oneLine(cyr[0] || '');
    if (!name) { stats.skipped++; prevEnd = i + 3; continue; }
    const included = cells[i + 1] || '';
    const dates = allDates(included);
    const basis = oneLine(cells[i]);
    const articles = extractArticles(basis);
    items.push({
      id: personId(name, birth, included),
      num,
      name,
      translit: oneLine(lat.join(' ')),
      citizenship: oneLine(cyr.slice(1).join(' ')),
      birth: oneLine(birth),
      basis,
      court: personCourt(basis),
      articles,
      included: dates.length ? dates.join(', ') : oneLine(included),
      date: firstDateIso(included),
      address: oneLine(cells[i + 2] || ''),
      info: oneLine(cells[i + 3] || ''),
    });
    prevEnd = i + 3;
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

/**
 * Праўка ў крыніцы (а не новы чалавек): тая ж дата ўключэння і — або тая ж дата нараджэння з амаль тым жа
 * імем (выпраўлена памылка друку ў імені), або тое ж імя з іншай датай нараджэння (выпраўлена дата).
 */
export const isPersonEdit = (oldRec, newRec) =>
  Boolean(oldRec.date) && oldRec.date === newRec.date && (
    (oldRec.birth === newRec.birth && similarName(oldRec, newRec))
    || (oldRec.birth !== newRec.birth && idNormalize(oldRec.name || '') === idNormalize(newRec.name || ''))
  );

/** Пары [стары, новы] сярод зніклых і новых; кожны ўдзельнічае не болей за раз, неадназначнасць — прапускаем. */
export function pairPersonEdits(removed, added) {
  if (!removed.length || !added.length || removed.length > MAX_PAIRS) return [];
  const pairs = [], used = new Set();
  for (const old of removed) {
    const cand = added.filter((n) => !used.has(n.id) && isPersonEdit(old, n));
    if (cand.length !== 1) continue;
    used.add(cand[0].id);
    pairs.push([old, cand[0]]);
  }
  return pairs;
}
