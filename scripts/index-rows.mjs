/**
 * Радкі індэкса, фрагменты, публічная мета і RSS для scripts/build-index.mjs — чыстыя функцыі без файлаў.
 *
 * Тры спісы ў адным індэксе: спачатку матэрыялы (суды), за імі — экстрэмісцкія фарміраванні (МУС/КДБ), потым
 * фізічныя асобы (пералік МУС), з пазнакай спіса ў кожным радку. Так пошук, спіс назірання, «Новае» і пастаянныя
 * спасылкі працуюць па ўсіх без асобнай логікі.
 */
import { normalizeCompact } from '../src/lib/normalize.js';
import { courtName, extractArticle } from '../src/lib/court.js';
import { articlesLabel, personSeries } from '../src/lib/person.js';

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

// [тып, суд, дата, дададзена, выдалена, назва, id, артыкул, праўка чаго (editOf), заменены чым (replacedBy), спіс (0/1/2), № у крыніцы]
// слот «артыкул» для фарміраванняў — хто прыняў рашэнне (для статыстыкі): 1 МУС, 2 КДБ, 3 суд;
// для фізічных асоб — група артыкулаў КК (гл. person.js): 1 групавыя дзеянні, 2 выказванні, 3 экстрэмізм, 0 іншае.
// У радок фізічнай асобы для пошуку трапляюць імя, транслітарацыя і дата нараджэння; «тып» — артыкулы КК, «суд» — суд
// з прысуду. Адрас, грамадзянства і статус — толькі ў фрагменце (на картцы і старонцы запісу), у індэкс не ідуць.
const ART = { gpk: 1, kgs: 2 }, DEC = { mvd: 1, kgb: 2, court: 3 }, PSER = { protest: 1, speech: 2, ext: 3, other: 0 };

/** Радок індэкса запісу x (x.list: 'm' матэрыял | 'f' фарміраванне | 'p' фізічная асоба); types/courts — dict(). */
export function indexRow(x, { types, courts }) {
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

/** Поўны запіс для фрагмента: матэрыял — як раней; фарміраванне і фізічная асоба — усе палі для карткі і старонкі запісу. */
export const chunkRecord = (x) => (x.list === 'p'
  ? { id: x.id, list: 'p', num: x.num, name: x.name, translit: x.translit, citizenship: x.citizenship, birth: x.birth, basis: x.basis, articles: x.articles, included: x.included, date: x.date, address: x.address, info: x.info }
  : x.list === 'f'
    ? { id: x.id, list: 'f', kind: x.kind, name: x.name, alias: x.alias, links: x.links, address: x.address, basis: x.basis, decidedBy: x.decidedBy, date: x.date, included: x.included, info: x.info, logo: x.logo }
    : { id: x.id, type: x.type, name: x.name, court: x.court, order: x.order });

/** Публічны meta.json: адрасы крыніц не трапляюць; звесткі пра другі і трэці спісы — у meta.formations / meta.persons (null, калі няма). */
export function publicMeta(meta, fmeta = {}, pmeta = {}) {
  const strip = ({ sourcePage, sourceFile, sourceFiles, ...rest }) => rest; // eslint-disable-line no-unused-vars
  const pub = strip(meta), f = strip(fmeta), p = strip(pmeta);
  pub.formations = Object.keys(f).length ? f : null;
  pub.persons = Object.keys(p).length ? p : null;
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
    const title = x.name.replace(/\s+/g, ' ').slice(0, 140);
    const category = x.list === 'p' ? 'Фізічная асоба (пералік МУС)' : x.list === 'f' ? 'Экстрэмісцкае фарміраванне (МУС/КДБ)' : x.type;
    // фізічная асоба: транслітарацыя і падстава — без даты нараджэння і адраса (яны на старонцы запісу)
    const body = x.list === 'p' ? [x.translit, x.basis, x.included && `Уключаны ў пералік: ${x.included}`].filter(Boolean).join('\n\n')
      : x.list === 'f' ? [x.alias, x.links, x.basis].filter(Boolean).join('\n\n') : `${x.name}\n\n${x.court}`;
    return `<item><title>${esc(title)}</title><link>${site}#/r/${x.id}</link><guid isPermaLink="false">${root(x.id)}</guid><pubDate>${when}</pubDate><category>${esc(category)}</category><description>${esc(body)}</description></item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Пошук па экстрэмісцкіх спісах Беларусі — новыя запісы</title><link>${site}</link><description>Неафіцыйная стужка новых запісаў у Рэспубліканскім спісе экстрэмісцкіх матэрыялаў, пераліку экстрэмісцкіх фарміраванняў МУС/КДБ і пераліку фізічных асоб МУС. Абнаўляецца двойчы на дзень.</description><language>be</language><image><url>${site}icon-192.png</url><title>Пошук па экстрэмісцкіх спісах Беларусі</title><link>${site}</link></image><lastBuildDate>${new Date(meta.updated).toUTCString()}</lastBuildDate>
${items}
</channel></rss>`;
}
