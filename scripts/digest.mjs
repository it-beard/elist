/**
 * Дайджэст новых запісаў для Telegram — чыстыя функцыі без сеткі і файлаў (запускае scripts/notify.mjs):
 * адбор свежых запісаў (selectFresh), фарматаванне (entry, subheader, digestHeader, digestFooter) і разбіццё
 * на паведамленні ≤ 4096 сімвалаў (splitDigest, buildDigest).
 *
 * Чатыры спісы ў адным дайджэсце, у кожнага сваё эмодзі (ICON) і назва (NAME): 📄 матэрыялы (суд),
 * 👥 экстрэмісцкія фарміраванні (хто прыняў рашэнне і від запісу), 👤 фізічныя асобы (артыкулы КК і суд;
 * дата нараджэння і адрас у канал не ідуць — яны на старонцы запісу), 🔎 беларусы ў базе вышуку РФ
 * (ведамства-ініцыятар і рэгіён; год нараджэння ў канал не ідзе). Змяшаны дайджэст згрупаваны па спісах,
 * перад кожнай групай — кароткі падзагаловак з назвай спіса і колькасцю новых запісаў; у шапцы — разбіўка
 * новых па спісах і колькасць запісаў ва ўсіх чатырох спісах разам. Пры першым імпарце added = null —
 * у дайджэст нічога не трапляе.
 *
 * Фарматаванне — HTML-рэжым Bot API (дазволеныя толькі b/i/u/s/code/a/blockquote):
 * https://core.telegram.org/bots/api#html-style. Ліміт — 4096 сімвалаў на паведамленне,
 * таму доўгі дайджэст разбіваецца на некалькі частак.
 */
import { courtName } from '../src/lib/court.js';
import { articlesLabel } from '../src/lib/person.js';
import { personName } from '../src/lib/wanted.js';

export const LIMIT = 3900;      // запас да 4096
export const NAME_MAX = 220;    // даўжыня назвы ў дайджэсце
export const RANK = { m: 0, f: 1, p: 2, w: 3 }; // парадак спісаў у дайджэсце
/** Адно эмодзі на спіс — каб спісы адрозніваліся з першага погляду (у радках запісу іншых эмодзі няма). */
export const ICON = { m: '📄', f: '👥', p: '👤', w: '🔎' };
export const NAME = {
  m: 'Спіс экстрэмісцкіх матэрыялаў',
  f: 'Пералік экстрэмісцкіх фарміраванняў (МУС/КДБ)',
  p: 'Пералік фізічных асоб, прычастных да экстрэмісцкай дзейнасці (МУС)',
  w: 'Беларусы ў базе вышуку МУС РФ (паводле Медыязоны)',
};
const ADDED = { m: 'матэрыялаў', f: 'фарміраванняў', p: 'асоб', w: 'у вышуку РФ' }; // «матэрыялаў +5» у шапцы

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MONTHS = ['студзеня', 'лютага', 'сакавіка', 'красавіка', 'мая', 'чэрвеня', 'ліпеня', 'жніўня', 'верасня', 'кастрычніка', 'лістапада', 'снежня'];
export const dateBe = (iso) => { const [y, m, d] = iso.split('-'); return `${+d} ${MONTHS[+m - 1]} ${y}`; };
export const dateShort = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
export const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many; };
export const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // тонкі прабел між тысячамі
export const shiftDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

/**
 * Свежыя запісы: дададзеныя не раней за since і яшчэ не дасланыя (sent — id → дата адпраўкі; выпраўлены запіс
 * (editOf) не абвяшчаецца, калі яго папярэднюю версію ўжо дасылалі). Парадак — спіс (RANK), дата, месца ў спісе:
 * у змяшаным дайджэсце запісы аднаго спіса ідуць запар, адной групай пад сваім падзагалоўкам.
 */
export const selectFresh = (db, sent, since) => db
  .filter((x) => x.added && x.added >= since && !sent[x.id] && !(x.editOf && sent[x.editOf]))
  .sort((a, b) => RANK[a.list] - RANK[b.list] || a.added.localeCompare(b.added) || (a.order ?? 0) - (b.order ?? 0));

/** Назва: адзін радок, без службовых хвастоў, абрэзаная; імя з базы вышуку — у звычайным рэгістры, а не ВЯЛІКІМІ. */
export function title(x) {
  let s = (x.list === 'w' ? personName(x.name) : x.name).replace(/\s+/g, ' ').replace(/[;,.\s]+$/, '').trim();
  if (s.length > NAME_MAX) s = s.slice(0, NAME_MAX - 1).replace(/\s+\S*$/, '') + '…';
  return s;
}

const DECIDER = { mvd: 'рашэнне МУС', kgb: 'рашэнне КДБ', court: 'рашэнне суда' };
const KIND = { formation: 'экстрэмісцкае фарміраванне', organization: 'экстрэмісцкая арганізацыя' };
const court = (s) => esc(s.replace(/^суда\s+/i, 'суд '));

/** Радок мэты запісу (без даты): чым спісы адрозніваюцца па сутнасці. */
function metaParts(x) {
  // матэрыял: суд; фарміраванне: хто прыняў рашэнне + від запісу; фізічная асоба: артыкулы КК + суд (дата —
  // уключэння ў пералік); вышук РФ: ведамства-ініцыятар + рэгіён (дата — абвяшчэння ў вышук)
  if (x.list === 'w') {
    const parts = [x.agency && `па запыце ${esc(x.agency)}`, x.region && esc(x.region)].filter(Boolean);
    return parts.length ? parts : ['база вышуку МУС РФ'];
  }
  if (x.list === 'p') return [articlesLabel(x.articles) && esc(articlesLabel(x.articles)), x.court && court(x.court)];
  if (x.list === 'f') return [DECIDER[x.decidedBy], KIND[x.kind] || KIND.formation];
  return [x.court && court(courtName(x.court))];
}

/** Блок аднаго запісу: эмодзі спіса, нумар n, назва, радок мэты і спасылка на запіс на сайце site. */
export function entry(x, n, site) {
  const metaLine = [x.date && dateShort(x.date), ...metaParts(x)].filter(Boolean).join(' · ');
  return (
    `<blockquote>${ICON[x.list]} <b>${n}.</b> ${esc(title(x))}` +
    (metaLine ? `\n<i>${metaLine}</i>` : '') +
    `\n<a href="${site}#/r/${x.id}">Адкрыць запіс →</a></blockquote>`
  );
}

/** Падзагаловак групы ў змяшаным дайджэсце: з якога спіса далей запісы і колькі іх. */
export const subheader = (list, n) => `${ICON[list]} <b>${NAME[list]}: +${n}</b>`;

const countBy = (fresh) => { const nBy = { m: 0, f: 0, p: 0, w: 0 }; for (const x of fresh) nBy[x.list]++; return nBy; };
const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0);

/**
 * Шапка дайджэсту: змяшаная (некалькі спісаў — разбіўка новых па спісах) ці аднаго спіса (яго назва і памер).
 * totals — колькі запісаў у кожным спісе без выдаленых ({ m, f, p, w }); у шапцы — і сума па ўсіх чатырох.
 * Пробная (test) — тая ж шапка з пазнакай зверху, каб было відаць, як будзе выглядаць сапраўдная.
 */
export function digestHeader(fresh, { test = false, today, totals }) {
  const n = fresh.length;
  const nBy = countBy(fresh);
  const lists = Object.keys(RANK).filter((l) => nBy[l]);
  // дата дайджэсту — калі запісы трапілі ў базу, а не калі мы дасылаем (важна для дабору за мінулыя дні)
  const day = test ? today : fresh.reduce((d, x) => (x.added > d ? x.added : d), '');
  const newN = `+${n} ${plural(n, 'новы запіс', 'новыя запісы', 'новых запісаў')}`;
  const inAll = `ва ўсіх чатырох спісах ${num(sum(totals))}`;
  const header = lists.length > 1
    ? `<b>Экстрэмісцкія спісы Беларусі: ${newN}</b>\n<i>${dateBe(day)} · ${lists.map((l) => `${ADDED[l]} +${nBy[l]}`).join(', ')} · ${inAll}</i>`
    : `<b>${NAME[lists[0]]}: ${newN}</b>\n<i>${dateBe(day)} · у спісе ${num(totals[lists[0]])}, ${inAll}</i>`;
  return test ? `🧪 <i>Пробнае паведамленне — так будуць выглядаць дайджэсты</i>\n\n${header}` : header;
}

export const digestFooter = (site) =>
  `✅ <a href="${site}">Праверыць сябе і свой спіс назірання</a>\n` +
  `📰 <a href="${site}#/new">Усе новыя запісы</a> · <a href="${site}feed.xml">RSS</a>`;

/**
 * Разбіццё на паведамленні ≤ limit: ids[i] — запісы, што трапілі ў messages[i] (адзнакі пра адпраўку ставяцца
 * паштучна, каб пасля збою на сярэдзіне дайджэсту паўтарылася толькі недасланая частка). У змяшаным дайджэсце
 * перад першым запісам кожнага спіса — падзагаловак (у адным блоку з запісам, каб не адарваўся ад яго пры разбіцці).
 * Працягі нумаруюцца «(i/n)».
 */
export function splitDigest(fresh, { header, footer, site, limit = LIMIT }) {
  const nBy = countBy(fresh);
  const mixed = Object.values(nBy).filter(Boolean).length > 1;
  let prev = null;
  const blocks = fresh.map((x, i) => {
    const html = entry(x, i + 1, site);
    const first = mixed && x.list !== prev;
    prev = x.list;
    return { id: x.id, html: first ? `${subheader(x.list, nBy[x.list])}\n\n${html}` : html };
  });
  const messages = [], ids = [];
  let cur = header, curIds = [], count = 0;
  for (const b of blocks) {
    const next = `${cur}\n\n${b.html}`;
    if (next.length > limit && count > 0) {
      messages.push(cur); ids.push(curIds);
      cur = `<i>Працяг дайджэсту</i>\n\n${b.html}`; curIds = [b.id]; count = 1;
    } else { cur = next; curIds.push(b.id); count++; }
  }
  messages.push(`${cur}\n\n${footer}`); ids.push(curIds);
  if (messages.length > 1) messages.forEach((m, i) => { messages[i] = m.replace(/^(<i>Працяг дайджэсту<\/i>)/, `<i>Працяг дайджэсту (${i + 1}/${messages.length})</i>`); });
  return { messages, ids };
}

/** Увесь дайджэст для fresh: { messages, ids }. */
export const buildDigest = (fresh, { site, test = false, today, totals }) =>
  splitDigest(fresh, { header: digestHeader(fresh, { test, today, totals }), footer: digestFooter(site), site });
