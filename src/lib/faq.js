/**
 * Факты пра сайт і FAQ — агульная крыніца для статычных старонак, llms.txt
 * і Schema.org-разьметкі (GEO: генэратыўныя рухавікі цытуюць самадастатковыя
 * фрагмэнты з канкрэтнымі лічбамі, датамі і пытаньнямі-загалоўкамі).
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

/** Статыстыка па самой базе — толькі там, дзе яна ёсьць (зборка). */
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
  admin: 'Распаўсюд (рэпост, перасылка, публікацыя), выраб, захоўваньне і перавозка матэрыялаў са сьпісу — адміністрацыйнае парушэньне паводле арт. 19.11 КаАП: штраф да 20 базавых велічынь або арышт для фізічных асобаў, да 100 БВ для індывідуальных прадпрымальнікаў і да 500 БВ для арганізацыяў.',
  crime: 'За ўдзел у «экстрэмісцкім фарміраваньні», садзейнічаньне, данаты ці перадачу інфармацыі — крымінальная адказнасьць (арт. 361-1 і 361-4 КК).',
};
const LEGAL_EN = {
  admin: 'Distribution (repost, forwarding, publishing), production, storage and transport of listed materials is an administrative offence under Art. 19.11 of the Administrative Code: a fine of up to 20 base units or arrest for individuals, up to 100 base units for sole traders and up to 500 for organisations.',
  crime: 'Participation in an “extremist formation”, assistance, donations or passing information to one is a criminal offence (Art. 361-1 and 361-4 of the Criminal Code).',
};

/**
 * FAQ: пытаньне — самадастатковы адказ (першы сказ адказвае цалкам).
 * a(f) атрымлівае факты: { totalStr, updatedStr, updateTime, infoShare }.
 */
export const FAQ = {
  be: [
    {
      q: 'Што такое Рэспубліканскі сьпіс экстрэмісцкіх матэрыялаў?',
      a: (f) => `Рэспубліканскі сьпіс экстрэмісцкіх матэрыялаў — афіцыйны пералік тэкстаў, відэа, каналаў, сайтаў, акаўнтаў, кніг і сымболікі, якія беларускія суды прызналі экстрэмісцкімі. На ${f.updatedStr} у ім ${f.totalStr} запісаў. Кожны запіс зьяўляецца пасьля рашэньня канкрэтнага суда і зьмяшчае тып матэрыялу, яго апісаньне, назву суда і дату рашэньня. ${LEGAL_BE.admin}`,
    },
    {
      q: 'Як праверыць, ці трапіў мой Telegram-канал, нік ці сайт у сьпіс?',
      a: () => 'Увядзіце нік, назву канала, спасылку, імя ці назву ў поле пошуку на галоўнай старонцы — вынік зьявіцца адразу, за мілісэкунды. Пошук не ўлічвае рэгістар, «ё/е», лацінскую і кірылічную «i», віды лапак і хвост «/» у спасылках, а «@nick», «t.me/nick» і «nick» лічацца адным і тым жа. Калі дакладных супадзеньняў няма, сайт паказвае падобныя словы — з памылкамі ў 1–2 літары і ў лацінскай трансьлітарацыі.',
    },
    {
      q: 'Колькі запісаў у сьпісе і як часта ён абнаўляецца?',
      a: (f) => `На ${f.updatedStr} у базе ${f.totalStr} запісаў, і яна абнаўляецца аўтаматычна раз на суткі: праверка афіцыйнай крыніцы пачынаецца а ${f.updateTime}, новыя запісы трапляюць на сайт прыкладна праз 10 хвілін. ${f.infoShare ? `${f.infoShare}% запісаў — «інфармацыйная прадукцыя» (каналы, сайты, акаўнты, відэа, чаты), астатняе — друкаваныя выданьні, кнігі, сымболіка і атрыбутыка.` : ''}`.trim(),
    },
    {
      q: 'Што пагражае за рэпост ці захоўваньне матэрыялу са сьпісу?',
      a: () => `${LEGAL_BE.admin} На практыцы падставай для пратаколу бываюць стары рэпост, захаваны файл, стыкер ці спасылка ў перапісцы. Гэта не юрыдычная кансультацыя: пры рэальнай праблеме зьвярніцеся да праваабаронцаў.`,
    },
    {
      q: 'Ці зьяўляецца парушэньнем сама падпіска на канал са сьпісу?',
      a: () => 'Сама падпіска на канал са сьпісу ў законе як парушэньне не названая, але пры праверцы тэлефона падпіскі і захаваныя матэрыялы разглядаюць як «захоўваньне» і падставу для пытаньняў. Перад паездкай у Беларусь праваабаронцы раяць адпісацца, выдаліць чаты, файлы і кэш, і ў ідэале не везьці прыладу з такой гісторыяй.',
    },
    {
      q: 'Чым сьпіс экстрэмісцкіх матэрыялаў адрозьніваецца ад сьпісу экстрэмісцкіх фарміраваньняў?',
      a: () => `Гэта два розныя сьпісы. Сьпіс «экстрэмісцкіх матэрыялаў» фармуюць суды — за яго парушэньне адміністрацыйная адказнасьць; менавіта па ім шукае гэты сайт. Сьпіс «экстрэмісцкіх фарміраваньняў» вядуць МУС і КДБ. ${LEGAL_BE.crime} Многія рэсурсы ёсьць у абодвух сьпісах, таму варта праверыць і другі.`,
    },
    {
      q: 'Ці бясьпечна карыстацца гэтым сайтам?',
      a: () => 'Сайт не зьбірае ніякіх даных: ні запытаў, ні cookies, ні статыстыкі, ні лягоў. Пошук цалкам працуе ў вашым браўзэры — запыты нікуды не адпраўляюцца, бо ўся база спампоўваецца на прыладу. Сьпіс назіраньня, тэма, мова і сартаваньне захоўваюцца толькі ў localStorage гэтай прылады, а кнопка «Ачысьціць усё» выдаляе іх адным націскам. Перад паездкай у Беларусь ці перасячэньнем мяжы варта гэта зрабіць.',
    },
    {
      q: 'Як даведацца, што ў сьпіс дадалі нешта новае?',
      a: () => 'Ёсьць тры спосабы. Сьпіс назіраньня: увядзіце свой нік ці канал і націсьніце «Сачыць» — пры кожным адкрыцьці сайт правярае ўсе такія запыты і паказвае зьверху, ці зьявілася нешта новае (з неабавязковымі браўзэрнымі апавяшчэньнямі). RSS-стужка feed.xml — для любога чытача стужак, з фільтрам па сваіх словах. Telegram-канал @elist_by — дайджэст новых запісаў пасьля кожнага абнаўленьня.',
    },
    {
      q: 'Ці афіцыйны гэта сайт?',
      a: () => 'Не, сайт неафіцыйны і зроблены незалежна, з адкрытым кодам на GitHub. Даныя аўтаматычна бяруцца з афіцыйнай публікацыі Рэспубліканскага сьпісу і не рэдагуюцца: тэкст запісу, назва суда і дата захоўваюцца як у крыніцы. Пры юрыдычна значных рашэньнях зьвяраць варта з афіцыйнай публікацыяй.',
    },
    {
      q: 'Што рабіць, калі я знайшоў сябе ці свой рэсурс у сьпісе?',
      a: () => 'Праверце тэкст запісу, дату і назву суда — менавіта яны вызначаюць, што і калі прызналі экстрэмісцкім. Дадайце запыт у сьпіс назіраньня, каб убачыць, калі зьявіцца новы зьвязаны запіс. Пра свае рызыкі і магчымасьць абскарджаньня пракансультуйцеся з праваабаронцамі: Праваабарончы цэнтр «Вясна» і Human Constanta.',
    },
    {
      q: 'Ці працуе пошук без інтэрнэту?',
      a: () => 'Так. Сайт — PWA: пасьля першага адкрыцьця абалонка і копія базы застаюцца ў браўзэры, і пошук працуе афлайн. Сайт можна «ўсталяваць» на тэлефон як праграму. Калі вы афлайн, у шапцы паказваецца дата захаванай копіі базы.',
    },
    {
      q: 'Ці можна разгарнуць уласнае люстэрка сайта?',
      a: () => 'Так. Сайт статычны: `npm run build` дае тэчку dist/, якую можна выкласьці на любы хостынг — GitHub Pages, Netlify, Cloudflare Pages, свой сэрвэр ці IPFS. Задайце зьменныя BASE_PATH (шлях, з якога аддаецца сайт) і SITE_URL (поўны адрас), каб спасылкі былі правільныя. Код і інструкцыя — у рэпазіторыі на GitHub.',
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

/** Кароткае апісаньне сайта з лічбамі — для meta description, llms.txt і JSON-LD. */
export const SUMMARY = {
  be: (f) => `Пошук па афіцыйным Рэспубліканскім сьпісе экстрэмісцкіх матэрыялаў Беларусі: ${f.totalStr} запісаў на ${f.updatedStr}, абнаўленьне раз на суткі. Праверце нік, Telegram-канал, сайт ці кнігу, дадайце запыт у сьпіс назіраньня. Працуе афлайн, не зьбірае ніякіх даных.`,
  en: (f) => `Search the official Republican list of extremist materials of Belarus: ${f.totalStr} entries as of ${f.updatedStr}, updated daily. Check a handle, Telegram channel, website or book and add it to your watchlist. Works offline, collects no data.`,
};

/** Ключавыя факты табліцай — структураваныя фрагмэнты лягчэй цытаваць. */
export const KEY_FACTS = {
  be: (f) => [
    ['Запісаў у базе', `${f.totalStr} (на ${f.updatedStr})`],
    ['Абнаўленьне', `аўтаматычна раз на суткі, а ${f.updateTime}`],
    ['Крыніца', 'афіцыйная публікацыя Рэспубліканскага сьпісу экстрэмісцкіх матэрыялаў'],
    ['Пошук', 'цалкам у браўзэры; кірыліца ↔ лацінка, памылкі ў 1–2 літары'],
    ['Даныя пра карыстальніка', 'не зьбіраюцца: ні запытаў, ні cookies, ні статыстыкі'],
    ['Афлайн', 'так, PWA — база застаецца ў браўзэры'],
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
