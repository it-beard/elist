/**
 * Радкі індэкса, фрагменты, публічная мета і RSS для scripts/build-index.mjs — чыстыя функцыі без файлаў.
 *
 * Чатыры спісы ў адным індэксе: спачатку матэрыялы (суды), за імі — экстрэмісцкія фарміраванні (МУС/КДБ), потым
 * фізічныя асобы (пералік МУС) і беларусы ў базе вышуку РФ (паводле Медыязоны), з пазнакай спіса ў кожным радку.
 * Так пошук, спіс назірання, «Новае» і пастаянныя спасылкі працуюць па ўсіх без асобнай логікі.
 */
import { normalizeCompact } from '../src/lib/normalize.js';
import { idNormalize } from '../src/lib/identity.js';
import { courtName, extractArticle } from '../src/lib/court.js';
import { articlesLabel, personSeries } from '../src/lib/person.js';
import { AGENCY_KEY, isIsoDate, personName, wantedTypeLabel } from '../src/lib/wanted.js';

export const CHUNK = 200;

/** Слоўнік індэкса: радок → нумар (у парадку першага з’яўлення), list() — усе радкі. */
export const dict = () => {
  const map = new Map();
  return {
    id: (s) => { if (!map.has(s)) map.set(s, map.size); return map.get(s); },
    list: () => [...map.keys()],
  };
};

// «тып» і «суд» для фарміраванняў — кароткія падпісы, каб шукалася па словах «формирование», «кгб», «мвд»
export const KIND = { formation: 'Экстремистское формирование', organization: 'Экстремистская организация' };
export const DECIDER = { mvd: 'Решение МВД', kgb: 'Решение КГБ', court: 'Решение суда' };

// [тып, суд, дата, дададзена, выдалена, назва, id, артыкул, праўка чаго (editOf), заменены чым (replacedBy), спіс (0/1/2/3), № у крыніцы]
// слот «артыкул» для фарміраванняў — хто прыняў рашэнне (для статыстыкі): 1 МУС, 2 КДБ, 3 суд;
// для фізічных асоб — група артыкулаў КК (гл. person.js): 1 групавыя дзеянні, 2 выказванні, 3 экстрэмізм, 0 іншае;
// для вышуку РФ — ведамства-ініцыятар (гл. wanted.js): 1 МУС, 2 КДК, 3 КДБ, 0 іншае/невядома.
// У радок фізічнай асобы для пошуку трапляюць імя, транслітарацыя і дата нараджэння; «тып» — артыкулы КК, «суд» — суд
// з прысуду. Адрас, грамадзянства і статус — толькі ў фрагменце (на картцы і старонцы запісу), у індэкс не ідуць.
// У радок вышуку РФ — імя, іншыя напісанні і год нараджэння; «тып» — «Розыск РФ по запросу МВД», «суд» — рэгіён ініцыятара;
// дата — дакладная дата абвяшчэння ў вышук (прыблізная «да …» — толькі ў фрагменце); нацыянальнасць у індэкс не ідзе.
const ART = { gpk: 1, kgs: 2 }, DEC = { mvd: 1, kgb: 2, court: 3 }, PSER = { protest: 1, speech: 2, ext: 3, other: 0 };
const WSER = { wmvd: 1, wkgk: 2, wkgb: 3 };

/** Радок індэкса запісу x (x.list: 'm' матэрыял | 'f' фарміраванне | 'p' фізічная асоба | 'w' вышук РФ); types/courts — dict(). */
export function indexRow(x, { types, courts }) {
  if (x.list === 'w') {
    return [
      types.id(normalizeCompact(wantedTypeLabel(x.agency))),
      courts.id(normalizeCompact(x.region || '')),
      x.date || '',
      x.added || '',
      x.removed || '',
      normalizeCompact([x.name, ...(x.aliases || []), x.year].filter(Boolean).join('\n')),
      x.id,
      WSER[AGENCY_KEY[x.agency]] || 0,
      x.editOf || '',
      x.replacedBy || '',
      3,
      0,
    ];
  }
  if (x.list === 'p') {
    return [
      types.id(normalizeCompact(articlesLabel(x.articles))),
      courts.id(normalizeCompact(x.court || '')),
      x.date || '',
      x.added || '',
      x.removed || '',
      normalizeCompact([x.name, x.translit, x.birth].filter(Boolean).join('\n')),
      x.id,
      PSER[personSeries(x.articles)] || 0,
      x.editOf || '',
      x.replacedBy || '',
      2,
      x.num || 0,
    ];
  }
  if (x.list === 'f') {
    return [
      types.id(normalizeCompact(KIND[x.kind] || KIND.formation)),
      courts.id(normalizeCompact(DECIDER[x.decidedBy] || '')),
      x.date || '',
      x.added || '',
      x.removed || '',
      normalizeCompact([x.name, x.alias, x.links, x.address, x.basis].filter(Boolean).join('\n')),
      x.id,
      DEC[x.decidedBy] || 0, '', '', 1,
    ];
  }
  return [
    types.id(normalizeCompact(x.type)),
    courts.id(normalizeCompact(courtName(x.court))),
    x.date || '',
    x.added || '',
    x.removed || '',
    normalizeCompact(x.name),
    x.id,
    ART[extractArticle(x.court)?.code] || 0,
    x.editOf || '',
    x.replacedBy || '',
    0,
  ];
}

/**
 * Крос-спасылкі паміж пералікам фізічных асоб МУС і базай вышуку РФ: той жа чалавек — тое ж імя (ці іншае напісанне
 * з базы вышуку) і той жа год нараджэння. Толькі паміж жывымі запісамі (без выдаленых і старых версій), каб подпіс
 * «таксама ў вышуку РФ» быў праўдзівы; пры змене стану наступная зборка пералічыць. Пішацца ў x.also — масіў id
 * запісаў другога спіса (у фрагмент, не ў індэкс). Вяртае колькасць звязаных пар. Чыстая функцыя, db мяняецца на месцы.
 */
export function linkLists(db) {
  const live = (x) => !x.removed && !x.replacedBy;
  const key = (name, year) => `${idNormalize(name || '')}|${year}`;
  const add = (map, k, id) => { if (!map.has(k)) map.set(k, []); map.get(k).push(id); };
  const wanted = new Map(), persons = new Map();
  for (const x of db) {
    if (!live(x)) continue;
    if (x.list === 'w') for (const n of [x.name, ...(x.aliases || [])]) add(wanted, key(n, x.year), x.id);
    if (x.list === 'p' && /\d{4}$/.test(x.birth || '')) add(persons, key(x.name, x.birth.slice(-4)), x.id);
  }
  let pairs = 0;
  for (const x of db) {
    if (!live(x)) { delete x.also; continue; } // застарэлая сувязь запісу, які выбыў, не застаецца
    let ids = [];
    if (x.list === 'p' && /\d{4}$/.test(x.birth || '')) ids = wanted.get(key(x.name, x.birth.slice(-4))) || [];
    if (x.list === 'w') ids = [x.name, ...(x.aliases || [])].flatMap((n) => persons.get(key(n, x.year)) || []);
    ids = [...new Set(ids)];
    if (ids.length) { x.also = ids; if (x.list === 'p') pairs += ids.length; } else delete x.also;
  }
  return pairs;
}

/** Поўны запіс для фрагмента: матэрыял — як раней; фарміраванне, фізічная асоба і вышук РФ — усе палі для карткі і старонкі запісу. */
export const chunkRecord = (x) => (x.list === 'w'
  ? { id: x.id, list: 'w', name: x.name, aliases: x.aliases, year: x.year, nationality: x.nationality, region: x.region, agency: x.agency, date: x.date, before: x.before, first: x.first, category: x.category, rf: x.rf, also: x.also }
  : x.list === 'p'
  ? { id: x.id, list: 'p', num: x.num, name: x.name, translit: x.translit, citizenship: x.citizenship, birth: x.birth, basis: x.basis, articles: x.articles, included: x.included, date: x.date, address: x.address, info: x.info, also: x.also }
  : x.list === 'f'
    ? { id: x.id, list: 'f', kind: x.kind, name: x.name, alias: x.alias, links: x.links, address: x.address, basis: x.basis, decidedBy: x.decidedBy, date: x.date, included: x.included, info: x.info, logo: x.logo }
    : { id: x.id, type: x.type, name: x.name, court: x.court, order: x.order });

/**
 * Публічны meta.json: адрасы крыніц не трапляюць; звесткі пра іншыя спісы — у meta.formations / meta.persons / meta.wanted
 * (null, калі няма). sourceDate вышуку (дата файла Медыязоны) — публічная: яна паказваецца ў шапцы.
 */
export function publicMeta(meta, fmeta = {}, pmeta = {}, wmeta = {}) {
  const strip = ({ sourcePage, sourceFile, sourceFiles, ...rest }) => rest; // eslint-disable-line no-unused-vars
  const pub = strip(meta), f = strip(fmeta), p = strip(pmeta), w = strip(wmeta);
  pub.formations = Object.keys(f).length ? f : null;
  pub.persons = Object.keys(p).length ? p : null;
  pub.wanted = Object.keys(w).length ? w : null;
  return pub;
}

export function esc(s) { return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

/** RSS: апошнія даданыя запісы (або па даце рашэння, пакуль няма гісторыі абнаўленняў); site — адрас сайта са слэшам. */
export function feed(rows, meta, site) {
  // выпраўлены запіс захоўвае guid сваёй першай версіі — чытач стужак не паказвае яго як новы
  const editOf = new Map(rows.filter((x) => x.editOf).map((x) => [x.id, x.editOf]));
  const root = (id) => { let cur = id; for (let i = 0; i < 8 && editOf.has(cur); i++) cur = editOf.get(cur); return cur; };
  const withAdded = rows.filter((x) => x.added && !x.removed);
  const pick = (withAdded.length ? withAdded.sort((a, b) => b.added.localeCompare(a.added)) : rows.filter((x) => x.list === 'm').sort((a, b) => (b.date || '').localeCompare(a.date || ''))).slice(0, 100);
  const items = pick.map((x) => {
    const when = new Date(x.added || x.date || meta.updated).toUTCString();
    const title = (x.list === 'w' ? personName(x.name) : x.name).replace(/\s+/g, ' ').slice(0, 140);
    const category = x.list === 'w' ? 'Вышук РФ (база МУС РФ паводле Медыязоны)' : x.list === 'p' ? 'Фізічная асоба (пералік МУС)' : x.list === 'f' ? 'Экстрэмісцкае фарміраванне (МУС/КДБ)' : x.type;
    // фізічная асоба: транслітарацыя і падстава — без даты нараджэння і адраса (яны на старонцы запісу);
    // вышук РФ: ведамства-ініцыятар, рэгіён і дата вышуку — без года нараджэння (ён на старонцы запісу)
    const body = x.list === 'w' ? [x.agency && `Па запыце: ${x.agency}${x.region ? `, ${x.region}` : ''}`, !x.agency && x.region, isIsoDate(x.date) ? `Абвешчаны ў вышук: ${x.date.split('-').reverse().join('.')}` : x.before && `У базе вышуку да ${x.before.split('-').reverse().join('.')}`].filter(Boolean).join('\n\n')
      : x.list === 'p' ? [x.translit, x.basis, x.included && `Уключаны ў пералік: ${x.included}`].filter(Boolean).join('\n\n')
      : x.list === 'f' ? [x.alias, x.links, x.basis].filter(Boolean).join('\n\n') : `${x.name}\n\n${x.court}`;
    return `<item><title>${esc(title)}</title><link>${site}#/r/${x.id}</link><guid isPermaLink="false">${root(x.id)}</guid><pubDate>${when}</pubDate><category>${esc(category)}</category><description>${esc(body)}</description></item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Пошук па экстрэмісцкіх спісах Беларусі — новыя запісы</title><link>${site}</link><description>Неафіцыйная стужка новых запісаў у Рэспубліканскім спісе экстрэмісцкіх матэрыялаў, пераліку экстрэмісцкіх фарміраванняў МУС/КДБ, пераліку фізічных асоб МУС і базе вышуку РФ па беларусах (паводле Медыязоны). Абнаўляецца двойчы на дзень.</description><language>be</language><image><url>${site}icon-192.png</url><title>Пошук па экстрэмісцкіх спісах Беларусі</title><link>${site}</link></image><lastBuildDate>${new Date(meta.updated).toUTCString()}</lastBuildDate>
${items}
</channel></rss>`;
}
