import { search, countByList } from './search.js';
import { variants } from './translit.js';
import { corpusWords, similarWords } from './fuzzy.js';

const EMPTY = { results: [], mode: 'exact', hl: [] };

/** Дакладны пошук; калі пуста — транслітарацыя + прыблізныя словы. */
export function runSearch(items, tokens, opts) {
  const vTokens = tokens.map(variants);
  const exact = search(items, vTokens, opts);
  if (exact.length || !tokens.length) return { results: exact, mode: 'exact', hl: vTokens };
  const words = corpusWords(items);
  const fz = tokens.map((t, i) => [...vTokens[i], ...similarWords(words, t)]);
  if (fz.every((v, i) => v.length === vTokens[i].length)) return { results: [], mode: 'exact', hl: vTokens };
  const results = search(items, fz, opts);
  return { results, mode: results.length ? 'fuzzy' : 'exact', hl: fz };
}

/**
 * Выдача галоўнай старонкі. Пошук заўсёды ідзе па ўсіх спісах (all) — лічбы на ўкладках-спісах лічацца
 * з поўнай выдачы, а абмежаванне спісам (opts.list) накладваецца потым; калі ў абраным спісе дакладных
 * супадзенняў няма — прыблізны пошук у межах спіса. Чыстая функцыя.
 * Вяртае { all, results, mode, hl, list, searching, live, facetCounts, shown }:
 * facetCounts — пры запыце колькі знойдзена ў кожным спісе, без запыту колькі запісаў у базе
 * («Усяго запісаў» — адно правіла ўсюды: без выдаленых і старых версій выпраўленых);
 * shown — у якіх спісах ёсць паказаныя вынікі.
 */
export function deriveResults(items, tokens, opts) {
  const list = opts.list || '';
  const all = items ? runSearch(items, tokens, { ...opts, list: '' }) : EMPTY;
  let view = all;
  if (list) {
    const filtered = all.results.filter((r) => (r.list || 'm') === list);
    view = filtered.length || !tokens.length || !items ? { ...all, results: filtered } : runSearch(items, tokens, opts);
  }
  const searching = tokens.length > 0;
  const live = countByList(all.results, { live: true });
  const facetCounts = searching ? countByList(all.results) : live;
  const shown = {};
  for (const r of view.results) shown[r.list || 'm'] = true;
  return { all, results: view.results, mode: view.mode, hl: view.hl, list, searching, live, facetCounts, shown };
}

/**
 * Што сказаць у радку-зводцы: { kind: 'total' | 'found' | 'fuzzy' | 'nothing', n }.
 * Без запыту — колькі запісаў у базе. Пры запыце лічба — па ўсіх спісах (укладкі паказваюць разбіўку);
 * калі ў абраным спісе паказаныя прыблізныя супадзенні — іх колькасць. Калі абраны спіс пусты —
 * характар поўнай выдачы (дакладная ці прыблізная), а не «знойдзена» для прыблізных.
 */
export function summarize({ searching, list, all, results, mode, live }) {
  if (!searching) return { kind: 'total', n: live.all };
  const whole = all.mode === 'fuzzy' ? { kind: 'fuzzy', n: all.results.length } : all.results.length ? { kind: 'found', n: all.results.length } : { kind: 'nothing', n: 0 };
  if (!list || !results.length) return whole;
  return mode === 'fuzzy' ? { kind: 'fuzzy', n: results.length } : whole;
}
