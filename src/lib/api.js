const BASE = `${import.meta.env.BASE_URL}data/`;

async function getJson(name, init) {
  const r = await fetch(BASE + name, init);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
}

/** fresh=true — абысці кэш (кнопка «праверыць зноў»). */
const opts = (fresh) => (fresh ? { cache: 'reload' } : undefined);

export const fetchMeta = (fresh) => getJson('meta.json', opts(fresh));

/**
 * Код у слоце «артыкул» → назва серыі статыстыкі (гл. stats.js): матэрыялы — артыкул, фарміраванні — хто прыняў
 * рашэнне, фізічныя асобы — група артыкулаў КК (гл. person.js), вышук РФ — ведамства-ініцыятар (гл. wanted.js).
 */
const ART = { 1: 'gpk', 2: 'kgs' }, DEC = { 1: 'mvd', 2: 'kgb', 3: 'court' }, PSER = { 1: 'protest', 2: 'speech', 3: 'ext' }, WSER = { 1: 'wmvd', 2: 'wkgk', 3: 'wkgb' };
const LIST = { 1: 'f', 2: 'p', 3: 'w' };

/**
 * Індэкс → масіў зручных для пошуку аб’ектаў. list: 'm' — матэрыял, 'f' — экстрэмісцкае фарміраванне,
 * 'p' — фізічная асоба, 'w' — вышук РФ (у старым кэшы поля няма — усё матэрыялы); n — нумар у сваім спісе: для матэрыялаў
 * і фарміраванняў — пазіцыя ў публікацыі, для фізічных асоб — афіцыйны № з крыніцы або null (свежае дапаўненне,
 * якому МУС нумар яшчэ не даў: пазіцыя тут не падыходзіць, бо супадала б з чужымі нумарамі), для вышуку РФ — null
 * (нумароў у крыніцы няма). Чыстая функцыя.
 */
export function parseIndex(idx) {
  const counters = { m: 0, f: 0, p: 0, w: 0 };
  const items = idx.items.map(([t, c, date, added, removed, name, id, art, editOf, replacedBy, list, num], i) => {
    const l = LIST[list] || 'm';
    const pos = ++counters[l];
    return {
      i, id, date, added, removed, editOf: editOf || '', replacedBy: replacedBy || '',
      art: l === 'f' ? DEC[art] || 'court' : l === 'p' ? PSER[art] || 'other' : l === 'w' ? WSER[art] || 'wother' : ART[art] || 'none',
      list: l, n: l === 'p' ? num || null : l === 'w' ? null : pos,
      h: `${name}\n${idx.types[t]}\n${idx.courts[c]}\n${idx.dates[date] || ''}`,
    };
  });
  return { chunkSize: idx.chunk, items, counts: counters };
}

const chunkCache = new Map();
// фрагменты, ужо перачытаныя з сеткі пасля несупадзення з індэксам: другі раз за адзін індэкс не перачытваем,
// інакш кожная картка старонкі (да 50) слала б свой запыт таго ж фрагмента
const refreshed = new Set();
/** Індэкс перазагружаны — фрагменты ў памяці могуць не адпавядаць новым пазіцыям. */
export const clearChunks = () => { chunkCache.clear(); refreshed.clear(); };

export async function fetchIndex(fresh) {
  const idx = parseIndex(await getJson('index.json', opts(fresh)));
  if (fresh) clearChunks();
  return idx;
}

/**
 * fresh=true — абысці кэшы (фрагмент не супаў з індэксам: сайт абнавіўся падчас сесіі). Свежы запыт на фрагмент
 * робіцца адзін раз да наступнай перазагрузкі індэкса (clearChunks); паралельныя выклікі дзеляць той жа promise.
 */
export function fetchChunk(n, fresh = false) {
  const reload = fresh && !refreshed.has(n);
  if (reload || !chunkCache.has(n)) {
    if (reload) refreshed.add(n);
    const p = getJson(`chunks/${n}.json`, opts(reload)).catch((e) => { chunkCache.delete(n); refreshed.delete(n); throw e; });
    chunkCache.set(n, p);
  }
  return chunkCache.get(n);
}
