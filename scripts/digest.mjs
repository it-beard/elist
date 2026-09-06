/**
 * Дайджэст новых запісаў для Telegram — чыстыя функцыі без сеткі і файлаў (запускае scripts/notify.mjs):
 * адбор свежых запісаў (selectFresh), фарматаванне (entry, digestHeader) і разбіццё на паведамленні
 * ≤ 4096 сімвалаў (splitDigest, buildDigest).
 *
 * Тры спісы ў адным дайджэсце: матэрыялы (эмодзі паводле тыпу рэсурсу, ⚖️ суд), экстрэмісцкія фарміраванні
 * (🟣, хто прыняў рашэнне і від запісу), фізічныя асобы (👤, артыкулы КК і суд; дата нараджэння і адрас у канал
 * не ідуць — яны на старонцы запісу). Пры першым імпарце added = null — у дайджэст нічога не трапляе.
 *
 * Фарматаванне — HTML-рэжым Bot API (дазволеныя толькі b/i/u/s/code/a/blockquote):
 * https://core.telegram.org/bots/api#html-style. Ліміт — 4096 сімвалаў на паведамленне,
 * таму доўгі дайджэст разбіваецца на некалькі частак.
 */
import { courtName } from '../src/lib/court.js';
import { articlesLabel } from '../src/lib/person.js';

export const LIMIT = 3900;      // запас да 4096
export const NAME_MAX = 220;    // даўжыня назвы ў дайджэсце
export const RANK = { m: 0, f: 1, p: 2 }; // парадак спісаў у дайджэсце

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MONTHS = ['студзеня', 'лютага', 'сакавіка', 'красавіка', 'мая', 'чэрвеня', 'ліпеня', 'жніўня', 'верасня', 'кастрычніка', 'лістапада', 'снежня'];
export const dateBe = (iso) => { const [y, m, d] = iso.split('-'); return `${+d} ${MONTHS[+m - 1]} ${y}`; };
export const dateShort = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
export const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many; };
export const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // тонкі прабел між тысячамі
export const shiftDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

/**
 * Свежыя запісы: дададзеныя не раней за since і яшчэ не дасланыя (sent — id → дата адпраўкі; выпраўлены запіс
 * (editOf) не абвяшчаецца, калі яго папярэднюю версію ўжо дасылалі). Парадак — дата, спіс (RANK), месца ў спісе.
 */
export const selectFresh = (db, sent, since) => db
  .filter((x) => x.added && x.added >= since && !sent[x.id] && !(x.editOf && sent[x.editOf]))
  .sort((a, b) => a.added.localeCompare(b.added) || RANK[a.list] - RANK[b.list] || (a.order ?? 0) - (b.order ?? 0));

/** Эмодзі паводле тыпу рэсурсу — бяром той, што згадваецца ў назве першым. */
const KINDS = [
  [/telegram|t\.me|телеграм/, '✈️'], [/youtube/, '📺'], [/tiktok/, '🎵'], [/instagram/, '📷'],
  [/facebook|вконтакте|vk\.com|одноклассники|twitter|x\.com/, '👥'], [/книг|брошюр|печатн|журнал|газет/, '📚'],
  [/символик|атрибутик|логотип|флаг|нашивк|стикер/, '🚩'], [/видео|фильм|ролик/, '🎬'], [/песн|аудио|музык|альбом/, '🎧'],
  [/сайт|ресурс|http|www\.|\.by|\.com|\.org/, '🌐'],
];
export function icon(x) {
  if (x.list === 'f') return '🟣';
  if (x.list === 'p') return '👤';
  const s = `${x.name}\n${x.type || ''}`.toLowerCase();
  let best = null;
  for (const [re, emoji] of KINDS) { const i = s.search(re); if (i !== -1 && (best === null || i < best.i)) best = { i, emoji }; }
  return best ? best.emoji : '📄';
}

/** Назва: адзін радок, без службовых хвастоў, абрэзаная. */
export function title(x) {
  let s = x.name.replace(/\s+/g, ' ').replace(/[;,.\s]+$/, '').trim();
  if (s.length > NAME_MAX) s = s.slice(0, NAME_MAX - 1).replace(/\s+\S*$/, '') + '…';
  return s;
}

const DECIDER = { mvd: 'рашэнне МУС', kgb: 'рашэнне КДБ', court: 'рашэнне суда' };
const KIND = { formation: 'экстрэмісцкае фарміраванне', organization: 'экстрэмісцкая арганізацыя' };
const FORM_HEADER = '🟣 <b>Пералік экстрэмісцкіх фарміраванняў (МУС/КДБ)</b> — за ўдзел, садзейнічанне ці данаты крымінальная адказнасць';
const PERSON_HEADER = '👤 <b>Пералік фізічных асоб, прычастных да экстрэмісцкай дзейнасці (МУС)</b> — прысуд ці іншае рашэнне суда па «экстрэмісцкіх» артыкулах КК';
const HEADERS = { f: FORM_HEADER, p: PERSON_HEADER };

/** Блок аднаго запісу: эмодзі, нумар n, назва, радок мэты і спасылка на запіс на сайце site. */
export function entry(x, n, site) {
  // матэрыял: ⚖️ суд; фарміраванне: 🟣 хто прыняў рашэнне + від запісу; фізічная асоба: 👤 артыкулы КК + суд
  // (дата — уключэння ў пералік) — каб у стужцы адрозніваліся з першага погляду
  const metaLine = x.list === 'p'
    ? [x.date && dateShort(x.date), `👤 ${[esc(articlesLabel(x.articles)), x.court && esc(x.court.replace(/^суда\s+/i, 'суд '))].filter(Boolean).join(' · ')}`].filter(Boolean).join(' · ')
    : x.list === 'f'
      ? [x.date && dateShort(x.date), `🟣 ${[DECIDER[x.decidedBy], KIND[x.kind] || KIND.formation].filter(Boolean).join(' · ')}`].filter(Boolean).join(' · ')
      : [x.date && dateShort(x.date), x.court && `⚖️ ${esc(courtName(x.court).replace(/^суда\s+/i, 'суд '))}`].filter(Boolean).join(' · ');
  return (
    `<blockquote>${icon(x)} <b>${n}.</b> ${esc(title(x))}` +
    (metaLine ? `\n<i>${metaLine}</i>` : '') +
    `\n<a href="${site}#/r/${x.id}">Адкрыць запіс →</a></blockquote>`
  );
}

const countBy = (fresh) => { const nBy = { m: 0, f: 0, p: 0 }; for (const x of fresh) nBy[x.list]++; return nBy; };

/** Шапка дайджэсту: пробная; змяшаная (некалькі спісаў); аднаго спіса. total — колькі матэрыялаў у спісе (meta.total). */
export function digestHeader(fresh, { test = false, today, total }) {
  const n = fresh.length;
  const { m: nM, f: nF, p: nP } = countBy(fresh);
  const kinds = [nM, nF, nP].filter(Boolean).length;
  // дата дайджэсту — калі запісы трапілі ў базу, а не калі мы дасылаем (важна для дабору за мінулыя дні)
  const day = test ? today : fresh[fresh.length - 1].added;
  const newN = `+${n} ${plural(n, 'новы запіс', 'новыя запісы', 'новых запісаў')}`;
  return test
    ? `🧪 <b>Пробнае паведамленне</b> — так будуць выглядаць дайджэсты\n<i>${dateBe(day)} · ${num(total)} ${plural(total, 'запіс', 'запісы', 'запісаў')} у спісе</i>`
    : kinds > 1
      ? `🔴 <b>Экстрэмісцкія спісы: ${newN}</b>\n<i>${dateBe(day)} · ${[nM && `матэрыялаў +${nM}`, nF && `фарміраванняў +${nF}`, nP && `асоб +${nP}`].filter(Boolean).join(', ')}${nM ? ` · усяго матэрыялаў у спісе ${num(total)}` : ''}</i>`
      : nP
        ? `👤 <b>Пералік фізічных асоб, прычастных да экстрэмісцкай дзейнасці (МУС): ${newN}</b>\n<i>${dateBe(day)}</i>`
        : nF
          ? `🟣 <b>Пералік экстрэмісцкіх фарміраванняў (МУС/КДБ): ${newN}</b>\n<i>${dateBe(day)}</i>`
          : `🔴 <b>Спіс экстрэмісцкіх матэрыялаў: ${newN}</b>\n<i>${dateBe(day)} · усяго ў спісе ${num(total)}</i>`;
}

export const digestFooter = (site) =>
  `🔎 <a href="${site}">Праверыць сябе і свой спіс назірання</a>\n` +
  `📰 <a href="${site}#/new">Усе новыя запісы</a> · <a href="${site}feed.xml">RSS</a>`;

/**
 * Разбіццё на паведамленні ≤ limit: ids[i] — запісы, што трапілі ў messages[i] (адзнакі пра адпраўку ставяцца
 * паштучна, каб пасля збою на сярэдзіне дайджэсту паўтарылася толькі недасланая частка). У змяшаным дайджэсце
 * перад першым фарміраваннем / першай асобай — падзагаловак (блок без id: адзнак пра адпраўку не патрабуе).
 * Працягі нумаруюцца «(i/n)».
 */
export function splitDigest(fresh, { header, footer, site, limit = LIMIT }) {
  const kinds = Object.values(countBy(fresh)).filter(Boolean).length;
  const blocks = [];
  const headed = new Set();
  fresh.forEach((x, i) => {
    if (HEADERS[x.list] && kinds > 1 && !headed.has(x.list)) { headed.add(x.list); blocks.push({ id: null, html: HEADERS[x.list] }); }
    blocks.push({ id: x.id, html: entry(x, i + 1, site) });
  });
  const messages = [], ids = [];
  let cur = header, curIds = [], count = 0;
  for (const b of blocks) {
    const next = `${cur}\n\n${b.html}`;
    if (next.length > limit && count > 0) {
      messages.push(cur); ids.push(curIds);
      cur = `<i>Працяг дайджэсту</i>\n\n${b.html}`; curIds = b.id ? [b.id] : []; count = 1;
    } else { cur = next; if (b.id) curIds.push(b.id); count++; }
  }
  messages.push(`${cur}\n\n${footer}`); ids.push(curIds);
  if (messages.length > 1) messages.forEach((m, i) => { messages[i] = m.replace(/^(<i>Працяг дайджэсту<\/i>)/, `<i>Працяг дайджэсту (${i + 1}/${messages.length})</i>`); });
  return { messages, ids };
}

/** Увесь дайджэст для fresh: { messages, ids }. */
export const buildDigest = (fresh, { site, test = false, today, total }) =>
  splitDigest(fresh, { header: digestHeader(fresh, { test, today, total }), footer: digestFooter(site), site });
