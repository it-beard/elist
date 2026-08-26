/**
 * Факты пра сайт і FAQ — агульная крыніца для статычных старонак, llms.txt
 * і Schema.org-разметкі (GEO: генератыўныя рухавікі цытуюць самадастатковыя
 * фрагменты з канкрэтнымі лічбамі, датамі і пытаннямі-загалоўкамі).
 */

/** 5989 → «5 989». */
export const fmtNum = (n) => String(n ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** ISO → «26.08.2026». */
export const fmtDay = (iso) => (iso ? String(iso).split('-').reverse().join('.') : '');

/** Базавыя факты з публічнага meta.json (даступныя і без самой базы). */
export function siteFacts(meta = {}) {
  return {
    total: meta.total || 0,
    totalStr: fmtNum(meta.total || 0),
    updated: meta.updated || '',
    updatedStr: fmtDay(meta.updated),
    updateTime: '04:17 UTC',
  };
}

/** Статыстыка па самой базе — толькі там, дзе яна ёсць (зборка). */
export function dataStats(db = []) {
  const years = {};
  let info = 0;
  for (const x of db) {
    const y = (x.date || '').slice(0, 4);
    if (/^\d{4}$/.test(y)) years[y] = (years[y] || 0) + 1;
    if (/информационная продукция/i.test(x.type || '')) info += 1;
  }
  return {
    byYear: Object.entries(years).sort((a, b) => b[0].localeCompare(a[0])),
    infoShare: db.length ? Math.round((info / db.length) * 1000) / 10 : 0,
  };
}

const LEGAL_BE = {
  admin: 'Распаўсюд (рэпост, перасылка, публікацыя), выраб, захоўванне і перавозка матэрыялаў са спісу — адміністрацыйнае парушэнне паводле арт. 19.11 КаАП: штраф да 20 базавых велічынь або арышт для фізічных асоб, да 100 БВ для індывідуальных прадпрымальнікаў і да 500 БВ для арганізацый.',
  crime: 'За ўдзел у «экстрэмісцкім фарміраванні», садзейнічанне, данаты ці перадачу інфармацыі — крымінальная адказнасць (арт. 361-1 і 361-4 КК).',
};
const LEGAL_EN = {
  admin: 'Distribution (repost, forwarding, publishing), production, storage and transport of listed materials is an administrative offence under Art. 19.11 of the Administrative Code: a fine of up to 20 base units or arrest for individuals, up to 100 base units for sole traders and up to 500 for organisations.',
  crime: 'Participation in an “extremist formation”, assistance, donations or passing information to one is a criminal offence (Art. 361-1 and 361-4 of the Criminal Code).',
};

/**
 * FAQ: пытанне — самадастатковы адказ (першы сказ адказвае цалкам).
 * a(f) атрымлівае факты: { totalStr, updatedStr, updateTime, infoShare }.
 */
export const FAQ = {
  be: [
    {
      q: 'Што такое Рэспубліканскі спіс экстрэмісцкіх матэрыялаў?',
      a: (f) => `Рэспубліканскі спіс экстрэмісцкіх матэрыялаў — афіцыйны пералік тэкстаў, відэа, каналаў, сайтаў, акаўнтаў, кніг і сімвалікі, якія беларускія суды прызналі экстрэмісцкімі. На ${f.updatedStr} у ім ${f.totalStr} запісаў. Кожны запіс з’яўляецца пасля рашэння канкрэтнага суда і змяшчае тып матэрыялу, яго апісанне, назву суда і дату рашэння. ${LEGAL_BE.admin}`,
    },
    {
      q: 'Як праверыць, ці трапіў мой Telegram-канал, нік ці сайт у спіс?',
      a: () => 'Увядзіце нік, назву канала, спасылку, імя ці назву ў поле пошуку на галоўнай старонцы — вынік з’явіцца адразу, за мілісекунды. Пошук не ўлічвае рэгістар, «ё/е», лацінскую і кірылічную «i», віды лапак і хвост «/» у спасылках, а «@nick», «t.me/nick» і «nick» лічацца адным і тым жа. Калі дакладных супадзенняў няма, сайт паказвае падобныя словы — з памылкамі ў 1–2 літары і ў лацінскай транслітарацыі.',
    },
    {
      q: 'Колькі запісаў у спісе і як часта ён абнаўляецца?',
      a: (f) => `На ${f.updatedStr} у базе ${f.totalStr} запісаў, і яна абнаўляецца аўтаматычна раз на суткі: праверка афіцыйнай крыніцы пачынаецца а ${f.updateTime}, новыя запісы трапляюць на сайт прыкладна праз 10 хвілін. ${f.infoShare ? `${f.infoShare}% запісаў — «інфармацыйная прадукцыя» (каналы, сайты, акаўнты, відэа, чаты), астатняе — друкаваныя выданні, кнігі, сімваліка і атрыбутыка.` : ''}`.trim(),
    },
    {
      q: 'Што пагражае за рэпост ці захоўванне матэрыялу са спісу?',
      a: () => `${LEGAL_BE.admin} На практыцы падставай для пратаколу бываюць стары рэпост, захаваны файл, стыкер ці спасылка ў перапісцы. Гэта не юрыдычная кансультацыя: пры рэальнай праблеме звярніцеся да праваабаронцаў.`,
    },
    {
      q: 'Ці з’яўляецца парушэннем сама падпіска на канал са спісу?',
      a: () => 'Сама падпіска на канал са спісу ў законе як парушэнне не названая, але пры праверцы тэлефона падпіскі і захаваныя матэрыялы разглядаюць як «захоўванне» і падставу для пытанняў. Перад паездкай у Беларусь праваабаронцы раяць адпісацца, выдаліць чаты, файлы і кэш, і ў ідэале не везці прыладу з такой гісторыяй.',
    },
    {
      q: 'Чым спіс экстрэмісцкіх матэрыялаў адрозніваецца ад спісу экстрэмісцкіх фарміраванняў?',
      a: () => `Гэта два розныя спісы. Спіс «экстрэмісцкіх матэрыялаў» фармуюць суды — за яго парушэнне адміністрацыйная адказнасць; менавіта па ім шукае гэты сайт. Спіс «экстрэмісцкіх фарміраванняў» вядуць МУС і КДБ. ${LEGAL_BE.crime} Многія рэсурсы ёсць у абодвух спісах, таму варта праверыць і другі.`,
    },
    {
      q: 'Ці бяспечна карыстацца гэтым сайтам?',
      a: () => 'Сайт не збірае ніякіх даных: ні запытаў, ні cookies, ні статыстыкі, ні логаў. Пошук цалкам працуе ў вашым браўзеры — запыты нікуды не адпраўляюцца, бо ўся база спампоўваецца на прыладу. Спіс назірання, тэма, мова і сартаванне захоўваюцца толькі ў localStorage гэтай прылады, а кнопка «Ачысціць усё» выдаляе іх адным націскам. Перад паездкай у Беларусь ці перасячэннем мяжы варта гэта зрабіць.',
    },
    {
      q: 'Як даведацца, што ў спіс дадалі нешта новае?',
      a: () => 'Ёсць тры спосабы. Спіс назірання: увядзіце свой нік ці канал і націсніце «Сачыць» — пры кожным адкрыцці сайт правярае ўсе такія запыты і паказвае зверху, ці з’явілася нешта новае (з неабавязковымі браўзернымі апавяшчэннямі). RSS-стужка feed.xml — для любога чытача стужак, з фільтрам па сваіх словах. Telegram-канал @elist_by — дайджэст новых запісаў пасля кожнага абнаўлення.',
    },
    {
      q: 'Ці афіцыйны гэта сайт?',
      a: () => 'Не, сайт неафіцыйны і зроблены незалежна, з адкрытым кодам на GitHub. Даныя аўтаматычна бяруцца з афіцыйнай публікацыі Рэспубліканскага спісу і не рэдагуюцца: тэкст запісу, назва суда і дата захоўваюцца як у крыніцы. Пры юрыдычна значных рашэннях звяраць варта з афіцыйнай публікацыяй.',
    },
    {
      q: 'Што рабіць, калі я знайшоў сябе ці свой рэсурс у спісе?',
      a: () => 'Праверце тэкст запісу, дату і назву суда — менавіта яны вызначаюць, што і калі прызналі экстрэмісцкім. Дадайце запыт у спіс назірання, каб убачыць, калі з’явіцца новы звязаны запіс. Пра свае рызыкі і магчымасць абскарджання пракансультуйцеся з праваабаронцамі: Праваабарончы цэнтр «Вясна» і Human Constanta.',
    },
    {
      q: 'Ці працуе пошук без інтэрнэту?',
      a: () => 'Так. Сайт — PWA: пасля першага адкрыцця абалонка і копія базы застаюцца ў браўзеры, і пошук працуе афлайн. Сайт можна «ўсталяваць» на тэлефон як праграму. Калі вы афлайн, у шапцы паказваецца дата захаванай копіі базы.',
    },
    {
      q: 'Ці можна разгарнуць уласнае люстэрка сайта?',
      a: () => 'Так. Сайт статычны: `npm run build` дае тэчку dist/, якую можна выкласці на любы хостынг — GitHub Pages, Netlify, Cloudflare Pages, свой сервер ці IPFS. Задайце зменныя BASE_PATH (шлях, з якога аддаецца сайт) і SITE_URL (поўны адрас), каб спасылкі былі правільныя. Код і інструкцыя — у рэпазіторыі на GitHub.',
    },
  ],
  en: [
    {
      q: 'What is the Republican list of extremist materials of Belarus?',
      a: (f) => `The Republican list of extremist materials is the official register of texts, videos, channels, websites, accounts, books and symbols that Belarusian courts have ruled extremist. As of ${f.updatedStr} it contains ${f.totalStr} entries. Each entry follows a decision by a specific court and carries the material type, its description, the court name and the decision date. ${LEGAL_EN.admin}`,
    },
    {
      q: 'How do I check whether my Telegram channel, handle or website is on the list?',
      a: () => 'Type the handle, channel name, link, personal name or title into the search box on the front page — results appear instantly, in milliseconds. Search ignores case, “ё/е”, Latin vs Cyrillic “i”, quote styles and a trailing “/” in links, and treats “@nick”, “t.me/nick” and “nick” as the same thing. When there is no exact match, the site shows near matches: 1–2 letter typos and Latin transliteration.',
    },
    {
      q: 'How many entries are on the list and how often is it updated?',
      a: (f) => `As of ${f.updatedStr} the database holds ${f.totalStr} entries and it refreshes automatically once a day: the official source is checked at ${f.updateTime} and new entries reach the site about 10 minutes later. ${f.infoShare ? `${f.infoShare}% of entries are “information products” (channels, websites, accounts, videos, chats); the rest are printed editions, books, symbols and paraphernalia.` : ''}`.trim(),
    },
    {
      q: 'What are the penalties for reposting or storing a listed material?',
      a: () => `${LEGAL_EN.admin} In practice an old repost, a saved file, a sticker or a link in a chat has been enough for a charge. This is not legal advice: for a real problem, contact human rights defenders.`,
    },
    {
      q: 'Is merely subscribing to a listed channel an offence?',
      a: () => 'Merely subscribing to a listed channel is not named as an offence in the law, but during phone checks subscriptions and saved materials are treated as “storage” and grounds for questioning. Before travelling to Belarus, rights defenders advise unsubscribing, deleting chats, files and caches — ideally not carrying a device with such history at all.',
    },
    {
      q: 'How does the list of extremist materials differ from the list of extremist formations?',
      a: () => `They are two different lists. The list of “extremist materials” is formed by courts and carries administrative liability — this is the list the site searches. The list of “extremist formations” is maintained by the Interior Ministry and the KGB. ${LEGAL_EN.crime} Many resources appear on both, so check the second one too.`,
    },
    {
      q: 'Is this site safe to use?',
      a: () => 'The site collects no data: no queries, no cookies, no analytics, no logs. Search runs entirely in your browser — queries are never sent anywhere, because the whole database is downloaded to the device. The watchlist, theme, language and sort order live only in this device’s localStorage, and “Clear everything” deletes them in one click. Do that before travelling to Belarus or crossing the border.',
    },
    {
      q: 'How do I find out when something new is added to the list?',
      a: () => 'Three ways. The watchlist: type your handle or channel and press “Watch” — every time you open the site it re-checks all such queries and shows at the top whether anything new appeared, with optional browser notifications. The RSS feed feed.xml works in any feed reader and can be filtered by your own keywords. The Telegram channel @elist_by posts a digest after every update.',
    },
    {
      q: 'Is this an official site?',
      a: () => 'No. The site is unofficial and independent, with open source code on GitHub. Data is pulled automatically from the official publication of the Republican list and is never edited: entry text, court name and date are kept exactly as in the source. For legally significant decisions, verify against the official publication.',
    },
    {
      q: 'What should I do if I find myself or my resource on the list?',
      a: () => 'Check the entry text, the date and the court name — they define what was ruled extremist and when. Add the query to your watchlist to see when a related entry appears. Consult human rights defenders about your risks and possible appeal: Viasna Human Rights Centre and Human Constanta.',
    },
    {
      q: 'Does the search work offline?',
      a: () => 'Yes. The site is a PWA: after the first visit the app shell and a copy of the database stay in the browser, and search keeps working offline. It can be “installed” on a phone like an app. When you are offline, the header shows the date of the saved database copy.',
    },
    {
      q: 'Can I run my own mirror of the site?',
      a: () => 'Yes. The site is static: `npm run build` produces a dist/ folder you can host anywhere — GitHub Pages, Netlify, Cloudflare Pages, your own server or IPFS. Set BASE_PATH (the path the site is served from) and SITE_URL (the full address) so links resolve correctly. Code and instructions are in the GitHub repository.',
    },
  ],
};

/** Кароткае апісанне сайта з лічбамі — для meta description, llms.txt і JSON-LD. */
export const SUMMARY = {
  be: (f) => `Пошук па афіцыйным Рэспубліканскім спісе экстрэмісцкіх матэрыялаў Беларусі: ${f.totalStr} запісаў на ${f.updatedStr}, абнаўленне раз на суткі. Праверце нік, Telegram-канал, сайт ці кнігу, дадайце запыт у спіс назірання. Працуе афлайн, не збірае ніякіх даных.`,
  en: (f) => `Search the official Republican list of extremist materials of Belarus: ${f.totalStr} entries as of ${f.updatedStr}, updated daily. Check a handle, Telegram channel, website or book and add it to your watchlist. Works offline, collects no data.`,
};

/** Ключавыя факты табліцай — структураваныя фрагменты лягчэй цытаваць. */
export const KEY_FACTS = {
  be: (f) => [
    ['Запісаў у базе', `${f.totalStr} (на ${f.updatedStr})`],
    ['Абнаўленне', `аўтаматычна раз на суткі, а ${f.updateTime}`],
    ['Крыніца', 'афіцыйная публікацыя Рэспубліканскага спісу экстрэмісцкіх матэрыялаў'],
    ['Пошук', 'цалкам у браўзеры; кірыліца ↔ лацінка, памылкі ў 1–2 літары'],
    ['Даныя пра карыстальніка', 'не збіраюцца: ні запытаў, ні cookies, ні статыстыкі'],
    ['Афлайн', 'так, PWA — база застаецца ў браўзеры'],
    ['Кошт', 'бясплатна, без рэгістрацыі'],
    ['Код', 'адкрыты, GitHub'],
  ],
  en: (f) => [
    ['Entries', `${f.totalStr} (as of ${f.updatedStr})`],
    ['Updates', `automatic, once a day at ${f.updateTime}`],
    ['Source', 'official publication of the Republican list of extremist materials'],
    ['Search', 'entirely in the browser; Cyrillic ↔ Latin, 1–2 letter typos'],
    ['User data', 'none collected: no queries, no cookies, no analytics'],
    ['Offline', 'yes, PWA — the database stays in the browser'],
    ['Price', 'free, no sign-up'],
    ['Code', 'open source, GitHub'],
  ],
};
