/**
 * Разбор базы вышуку МУС РФ па беларусах (JSON Медыязоны-Беларусь) і зліццё з базай. Чыстыя функцыі без сеткі і файлаў.
 *
 * Запіс крыніцы: n — імя вялікімі літарамі (руская), d — год нараджэння, v — нацыянальнасць, r — рэгіён ініцыятара
 * (вобласці Беларусі, «Россия», краіны СНД), dp — ведамства-ініцыятар (МВД, КГК, КГБ, ДИН, ГПК), w — дата абвяшчэння
 * ў вышук («2026-08-28» ці прыблізна «<2026-05»), w0 — першае абвяшчэнне (для паўторна дададзеных), a — іншыя
 * напісанні імя, s — статус (1 — дададзены за апошнія 7 дзён, 2 — выключаны з базы; выключаныя застаюцца ў файле),
 * c / rf — рэдакцыйныя катэгорыі Медыязоны («Полк Калиновского», «в списке «террористов»»). Артыкула КК няма.
 *
 * Крыніца — чужы сервер: кожнае поле правяраецца на тып і абразаецца; запіс без імя кірыліцай ці з чужым годам
 * прапускаецца і лічыцца (stats.skipped) — абнаўляльнік спыняецца, калі такіх зашмат.
 */
import crypto from 'node:crypto';
import { idNormalize } from '../src/lib/identity.js';
import { levenshtein } from '../src/lib/fuzzy.js';
import { UNDATED, parseWantedDate } from '../src/lib/wanted.js';
import { mergeList, pairEdits } from './merge.mjs';

const MAX_NAME = 120, MAX_ALIASES = 10, MAX_SHORT = 60, MAX_CATEGORY = 80;
const CYR = /[а-яё]/i;
const RF = new Set(['terr', 'extr']);
const MAX_PAIRS = 60;

/** Радок: адзін радок без лішніх прабелаў, абрэзаны. */
const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
export const oneLine = (s) => str(s, MAX_NAME);

/** id = sha1 ад імя і года нараджэння (замарожаная нармалізацыя identity.js): нумароў у крыніцы няма. */
export const wantedId = (name, year) =>
  crypto.createHash('sha1').update(`wanted|${idNormalize(oneLine(name))}|${year}`).digest('hex').slice(0, 12);

/**
 * JSON крыніцы → запісы { id, name, aliases?, year, nationality, region, agency, date, before, first, category, rf, out }.
 * out — выключаны з базы (s = 2); stats: skipped — прапушчаных (без імя кірыліцай ці з чужым годам), approx — без дакладнай
 * даты вышуку, out — выключаных, fresh — пазначаных крыніцай як дададзеныя за апошнія 7 дзён.
 */
export function parseWanted(data, stats = {}) {
  if (!Array.isArray(data)) throw new Error('Крыніца не масіў запісаў — змяніўся фармат файла');
  Object.assign(stats, { skipped: 0, approx: 0, out: 0, fresh: 0 });
  const items = [];
  for (const r of data) {
    if (!r || typeof r !== 'object') { stats.skipped++; continue; }
    const name = oneLine(r.n);
    const year = Number(r.d);
    if (!name || !CYR.test(name) || !Number.isInteger(year) || year < 1900 || year > 2100) { stats.skipped++; continue; }
    const aliases = (Array.isArray(r.a) ? r.a : []).map((a) => oneLine(a)).filter(Boolean).slice(0, MAX_ALIASES);
    const { date, before } = parseWantedDate(r.w);
    const first = parseWantedDate(r.w0);
    const out = r.s === 2;
    if (!date) stats.approx++;
    if (out) stats.out++;
    if (r.s === 1) stats.fresh++;
    items.push({
      id: wantedId(name, year),
      name,
      ...(aliases.length ? { aliases } : {}),
      year,
      nationality: str(r.v, MAX_SHORT),
      region: str(r.r, MAX_SHORT),
      agency: str(r.dp, MAX_SHORT),
      date,
      before,
      first: first.date || (first.before && `<${first.before}`) || '',
      category: str(r.c, MAX_CATEGORY),
      rf: RF.has(r.rf) ? r.rf : '',
      out,
    });
  }
  return items;
}

/** Тое ж імя з дакладнасцю да некалькіх літар (выпраўленае напісанне). */
function similarName(a, b) {
  const na = idNormalize(a.name || ''), nb = idNormalize(b.name || '');
  if (!na || !nb) return false;
  if (na === nb) return true;
  const max = Math.max(2, Math.round(Math.max(na.length, nb.length) * 0.15));
  return levenshtein(na, nb, max) <= max;
}

/**
 * Праўка ў крыніцы (а не іншы чалавек): той жа год нараджэння і амаль тое ж імя (выпраўлена напісанне), або тое ж
 * імя з іншым годам (выпраўлены год). Ад абодвух залежыць id, таму без гэтага праўка выглядала б як «зніклы» + «новы».
 */
export const isWantedEdit = (oldRec, newRec) => (
  (oldRec.year === newRec.year && similarName(oldRec, newRec))
  || (oldRec.year !== newRec.year && idNormalize(oldRec.name || '') === idNormalize(newRec.name || ''))
);

/** Палі, змена якіх лічыцца праўкай існага запісу (дапісаны псеўданім, удакладненая дата, рэгіён…). */
const FIELDS = ['name', 'aliases', 'year', 'nationality', 'region', 'agency', 'date', 'before', 'first', 'category', 'rf'];

/**
 * Зліццё разабраных запісаў з базай. Жывыя запісы (без out) ідуць праз mergeList як звычайна: новы id — added = today
 * (пры першым імпарце null), зніклы з жывых — removed = today (і калі знік з файла, і калі крыніца пазначыла яго
 * выключаным), вярнуўся — зноў жывы, «зніклы» + «новы» з амаль тым жа імем — праўка. Выключаныя ў крыніцы (out), якіх
 * у базе няма (першы імпарт, ці чалавек трапіў у базу і выбыў між нашымі праверкамі), дадаюцца адразу з removed = UNDATED
 * і added = null — не «новыя» і не «зніклыя сёння», бо даты крыніца не дае; палі ўжо выключаных абнаўляюцца моўчкі.
 * Парадак (order) — як у файле крыніцы (алфавітны), для жывых і выключаных разам. Засцярогі mergeList: знікла больш за
 * max(20, 5 %) — памылка заўсёды; дадалося больш за maxAdded — без force.
 * Вяртае { out, added, removed, edited, edits, initial, outAdded } (outAdded — колькі выключаных дададзена без даты).
 */
export function mergeWanted(db, parsed, { today, force = false, maxAdded = 500 } = {}) {
  const live = parsed.filter((x) => !x.out).map(({ out, ...r }) => r); // eslint-disable-line no-unused-vars
  const res = mergeList(db, live, { today, force, maxAdded, fields: FIELDS, isEdit: isWantedEdit, maxPairs: MAX_PAIRS });
  const byId = new Map(res.out.map((x) => [x.id, x]));
  let outAdded = 0;
  for (const x of parsed) {
    if (!x.out) continue;
    const { out, ...r } = x; // eslint-disable-line no-unused-vars
    const ex = byId.get(r.id);
    if (ex) { for (const k of FIELDS) if (r[k] !== undefined) ex[k] = r[k]; else delete ex[k]; continue; }
    byId.set(r.id, { ...r, order: 0, added: null, removed: UNDATED });
    outAdded++;
  }
  // парадак — як у крыніцы; запісы, якіх у файле ўжо няма, застаюцца ў канцы паводле старога парадку
  const pos = new Map(parsed.map((x, i) => [x.id, i]));
  const out = [...byId.values()];
  for (const x of out) x.order = pos.has(x.id) ? pos.get(x.id) : parsed.length + (x.order || 0);
  out.sort((a, b) => a.order - b.order);
  return { ...res, out, outAdded };
}

const BUNDLE_RE = /https:\/\/s3\.zona\.media\/infographics\/wanted\/index-[\w-]+\.js(?:\.br|\.gz)?/;

/** Адрас бандла віджэта на старонцы Медыязоны (у HTML ён у экранаваным атрыбуце, але сам адрас ад гэтага не мяняецца). */
export function findWidgetBundle(html) {
  const m = String(html || '').match(BUNDLE_RE);
  if (!m) throw new Error('На старонцы не знойдзены бандл віджэта вышуку (s3.zona.media/infographics/wanted/index-*.js)');
  return m[0];
}

/**
 * Адрас файла даных з кода бандла: `…/wanted/${z}.json.br`, дзе z = "data_bel" для беларускай версіі (window.is_bel).
 * Бандл — чужы код, таму бяром з яго толькі пашырэнне файла і факт, што «data_bel» там згадваецца.
 */
export function findDataUrl(bundle) {
  const s = String(bundle || '');
  const m = s.match(/s3\.zona\.media\/infographics\/wanted\/\$\{\w+\}\.json(\.br|\.gz)?/);
  if (!m || !/["']data_bel["']/.test(s)) throw new Error('У бандле віджэта не знойдзены адрас файла даных data_bel');
  return `https://s3.zona.media/infographics/wanted/data_bel.json${m[1] || ''}`;
}
