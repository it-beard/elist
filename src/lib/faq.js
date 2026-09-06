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
  const fm = meta.formations || {}, pm = meta.persons || {};
  return {
    total: meta.total || 0,
    totalStr: fmtNum(meta.total || 0),
    updated: meta.updated || '',
    updatedStr: fmtDay(meta.updated),
    // другі спіс — пералік экстрэмісцкіх фарміраванняў МУС/КДБ (0, пакуль не імпартаваны)
    formations: fm.total || 0,
    formationsStr: fmtNum(fm.total || 0),
    formationsUpdatedStr: fmtDay(fm.checked || fm.updated),
    // трэці спіс — пералік фізічных асоб МУС (0, пакуль не імпартаваны)
    persons: pm.total || 0,
    personsStr: fmtNum(pm.total || 0),
    personsUpdatedStr: fmtDay(pm.checked || pm.updated),
  };
}

/** Фразы-дадаткі пра другі і трэці спісы, калі яны ёсць у базе. */
const FORM_BE = (f) => (f.formations ? ` Акрамя таго, у базе ${f.formationsStr} запісаў з пераліку «экстрэмісцкіх фарміраванняў» МУС/КДБ (правяраецца раз на суткі).` : '');
const FORM_EN = (f) => (f.formations ? ` The database also holds ${f.formationsStr} entries from the Interior Ministry / KGB list of “extremist formations” (checked once a day).` : '');
const PERS_BE = (f) => (f.persons ? ` Трэці спіс — пералік фізічных асоб, «прычастных да экстрэмісцкай дзейнасці» (МУС): ${f.personsStr} чалавек з прысудам (радзей — іншым рашэннем суда) па «экстрэмісцкіх» артыкулах КК (правяраецца двойчы на дзень).` : '');
const PERS_EN = (f) => (f.persons ? ` The third list is the Interior Ministry list of individuals “involved in extremist activity”: ${f.personsStr} people with a conviction (occasionally another court decision) under “extremism” articles of the Criminal Code (checked twice a day).` : '');

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
  persons: 'У пералік фізічных асоб трапляюць, як правіла, людзі з прысудам, які ўступіў у сілу, па «экстрэмісцкіх» артыкулах КК (найчасцей 342, 130, 368, 369, 361-х); радзей — асобы, справу якіх суд спыніў па нерэабілітуючых падставах ці якім прызначыў прымусовае лячэнне. Паводле закона «О противодействии экстремизму» уключэнне цягне абмежаванні — у прыватнасці, на педагагічную і выдавецкую дзейнасць, дзяржаўную і вайсковую службу, валоданне зброяй — да пагашэння ці зняцця судзімасці і яшчэ пяць гадоў пасля; выключаюць з пераліку праз пяць гадоў пасля пагашэння (зняцця) судзімасці, пры адмене прысуду або смерці.',
};
const LEGAL_EN = {
  admin: 'Distribution (repost, forwarding, publishing), production, storage and transport of listed materials is an administrative offence under Art. 19.11 of the Administrative Code: a fine of up to 20 base units or arrest for individuals, up to 100 base units for sole traders and up to 500 for organisations.',
  crime: 'Participation in an “extremist formation”, assistance, donations or passing information to one is a criminal offence (Art. 361-1 and 361-4 of the Criminal Code).',
  persons: 'The persons list usually holds people with a final conviction under “extremism” articles of the Criminal Code (most often 342, 130, 368, 369, 361-x); occasionally people whose case a court closed on non-rehabilitating grounds or who were sent for compulsory treatment. Under the Law on Countering Extremism, listing brings restrictions — in particular on teaching, publishing, state and military service and owning weapons — until the conviction is expunged or lifted and for five more years; a person is removed five years after expungement, if the verdict is quashed, or on death.',
};

/**
 * FAQ: пытанне — самадастатковы адказ (першы сказ адказвае цалкам).
 * a(f) атрымлівае факты: { totalStr, updatedStr, infoShare }.
 */
export const FAQ = {
  be: [
    {
      q: 'Што такое Рэспубліканскі спіс экстрэмісцкіх матэрыялаў?',
      a: (f) => `Рэспубліканскі спіс экстрэмісцкіх матэрыялаў — афіцыйны пералік тэкстаў, відэа, каналаў, сайтаў, акаўнтаў, кніг і сімвалікі, якія беларускія суды прызналі экстрэмісцкімі. На ${f.updatedStr} у ім ${f.totalStr} запісаў. Кожны запіс з’яўляецца пасля рашэння канкрэтнага суда і змяшчае тып матэрыялу, яго апісанне, назву суда і дату рашэння. ${LEGAL_BE.admin}${FORM_BE(f)}${PERS_BE(f)}`,
    },
    {
      q: 'Як праверыць, ці трапіў мой Telegram-канал, нік, сайт ці я сам у спіс?',
      a: () => 'Увядзіце нік, назву канала, спасылку, назву ці імя і прозвішча (кірыліцай або лацінкай, як у пашпарце) у поле пошуку на галоўнай старонцы — вынік з’явіцца адразу, за мілісекунды, і адразу па ўсіх спісах (запісы пераліку фарміраванняў пазначаныя фіялетавай плашкай, пераліку фізічных асоб — бірузовай, з датай нараджэння, каб адрозніць цёзак). Пошук не ўлічвае рэгістар, «ё/е», лацінскую і кірылічную «i», віды лапак і хвост «/» у спасылках, а «@nick», «t.me/nick» і «nick» лічацца адным і тым жа. Калі дакладных супадзенняў няма, сайт паказвае падобныя словы — з памылкамі ў 1–2 літары і ў лацінскай транслітарацыі.',
    },
    {
      q: 'Колькі запісаў у спісе і як часта ён абнаўляецца?',
      a: (f) => `На ${f.updatedStr} у базе ${f.totalStr} запісаў спісу экстрэмісцкіх матэрыялаў${f.formations ? `, ${f.formationsStr} запісаў пераліку экстрэмісцкіх фарміраванняў` : ''}${f.persons ? ` і ${f.personsStr} запісаў пераліку фізічных асоб` : ''}. Спіс матэрыялаў і пералік фізічных асоб абнаўляюцца аўтаматычна двойчы на дзень: сайт правярае афіцыйныя крыніцы раніцай і ўвечары, і новыя запісы трапляюць на сайт праз некалькі хвілін пасля праверкі; пералік фарміраванняў правяраецца раз на суткі. ${f.infoShare ? `${f.infoShare}% запісаў спісу матэрыялаў — «інфармацыйная прадукцыя» (каналы, сайты, акаўнты, відэа, чаты), астатняе — друкаваныя выданні, кнігі, сімваліка і атрыбутыка.` : ''}`.trim(),
    },
    {
      q: 'Што такое пералік фізічных асоб, прычастных да экстрэмісцкай дзейнасці?',
      a: (f) => `Пералік грамадзян Беларусі, замежнікаў і асоб без грамадзянства, «прычастных да экстрэмісцкай дзейнасці», вядзе МУС і публікуе некалькімі .doc-файламі на сваім сайце${f.persons ? ` (на ${f.personsUpdatedStr} у ім ${f.personsStr} чалавек)` : ''}. ${LEGAL_BE.persons} У кожным запісе — прозвішча, імя і імя па бацьку, лацінская транслітарацыя, грамадзянства, дата нараджэння, падстава (суд і артыкулы прысуду), дата ўключэння, месцазнаходжанне і статус («адбывае пакаранне», «судзімасць не пагашана»). Сайт паказвае гэтыя запісы з бірузовай плашкай «Асоба» і дазваляе шукаць па імені кірыліцай ці лацінкай, а даты нараджэння дапамагаюць адрозніць цёзак.`,
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
      q: 'Чым спіс экстрэмісцкіх матэрыялаў адрозніваецца ад спісу экстрэмісцкіх фарміраванняў і пераліку фізічных асоб?',
      a: (f) => `Гэта тры розныя спісы, і сайт шукае адразу па ўсіх. Спіс «экстрэмісцкіх матэрыялаў» фармуюць суды — за яго парушэнне адміністрацыйная адказнасць. Пералік «экстрэмісцкіх фарміраванняў» вядуць МУС і КДБ${f.formations ? ` (${f.formationsStr} запісаў, правяраецца раз на суткі)` : ''}; у выдачы такія запісы пазначаныя фіялетавай плашкай «Фарміраванне». ${LEGAL_BE.crime} Пералік фізічных асоб, «прычастных да экстрэмісцкай дзейнасці», вядзе МУС${f.persons ? ` (${f.personsStr} чалавек, правяраецца двойчы на дзень)` : ''}: гэта людзі з прысудам ці іншым рашэннем суда па «экстрэмісцкіх» артыкулах, пазначаныя бірузовай плашкай «Асоба». Укладкі пад полем пошуку «Усе · Матэрыялы · Фарміраванні · Асобы» паказваюць, колькі знойдзена ў кожным спісе, і абмяжоўваюць выдачу адным спісам. Многія рэсурсы і людзі ёсць адразу ў некалькіх спісах.`,
    },
    {
      q: 'Ці бяспечна карыстацца гэтым сайтам?',
      a: () => 'Сайт не збірае ніякіх даных: ні запытаў, ні cookies, ні статыстыкі. Сам сайт логаў не вядзе; хостынг (GitHub Pages), як любы сервер, бачыць IP-адрас і адрас старонкі, але не пошукавыя запыты — яны не трапляюць у адрасны радок і выконваюцца цалкам у вашым браўзеры, бо ўся база спампоўваецца на прыладу. Спіс назірання, тэма, мова і сартаванне захоўваюцца толькі ў localStorage гэтай прылады, а кнопка «Ачысціць усё» выдаляе іх разам з афлайн-копіяй базы адным націскам. Перад паездкай у Беларусь ці перасячэннем мяжы варта гэта зрабіць і ачысціць гісторыю браўзера. Спасылкі ўнутры запісаў вядуць на самі рэсурсы са спісу — сайт папярэджвае перад пераходам. А вось адкрываць афіцыйныя сайты і файлы спісаў наўпрост ці карыстацца афіцыйным пошукам можа быць небяспечна само па сабе: даныя наведнікаў могуць збірацца органамі РБ.',
    },
    {
      q: 'Як даведацца, што ў спіс дадалі нешта новае?',
      a: () => 'Укладка «Новае» паказвае ўсё, што дадалі ва ўсе тры спісы за апошнія 30 дзён. Каб не сачыць уручную, ёсць тры спосабы. Спіс назірання: увядзіце свой нік ці канал і націсніце «Сачыць» — пры кожным адкрыцці сайт правярае ўсе такія запыты і паказвае зверху, ці з’явілася нешта новае (з неабавязковымі браўзернымі апавяшчэннямі). RSS-стужка feed.xml — для любога чытача стужак, з фільтрам па сваіх словах. Telegram-канал @elist_by — дайджэст новых запісаў пасля кожнага абнаўлення.',
    },
    {
      q: 'Ці афіцыйны гэта сайт?',
      a: () => 'Не, сайт неафіцыйны і зроблены незалежна, з адкрытым кодам на GitHub. Даныя аўтаматычна бяруцца з афіцыйных публікацый — Рэспубліканскага спісу экстрэмісцкіх матэрыялаў (Мінінфарм), пераліку экстрэмісцкіх фарміраванняў і пераліку фізічных асоб (МУС) — і не рэдагуюцца: тэкст запісу, падстава і даты захоўваюцца як у крыніцы. Пры юрыдычна значных рашэннях звяраць варта з афіцыйнай публікацыяй, памятаючы, што афіцыйныя сайты могуць збіраць даныя наведнікаў.',
    },
    {
      q: 'Што рабіць, калі я знайшоў сябе ці свой рэсурс у спісе?',
      a: () => 'Праверце тэкст запісу, дату і падставу — назву суда для матэрыялаў, рашэнне МУС/КДБ для фарміраванняў, прысуд і дату нараджэння для фізічнай асобы (у пераліку шмат цёзак): менавіта яны вызначаюць, што і калі прызналі экстрэмісцкім. Для фарміравання адказнасць крымінальная, таму варта звярнуцца па кансультацыю адразу. Дадайце запыт у спіс назірання, каб убачыць, калі з’явіцца новы звязаны запіс. Пра свае рызыкі і магчымасць абскарджання пракансультуйцеся з праваабаронцамі: Праваабарончы цэнтр «Вясна» і Human Constanta.',
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
      a: (f) => `The Republican list of extremist materials is the official register of texts, videos, channels, websites, accounts, books and symbols that Belarusian courts have ruled extremist. As of ${f.updatedStr} it contains ${f.totalStr} entries. Each entry follows a decision by a specific court and carries the material type, its description, the court name and the decision date. ${LEGAL_EN.admin}${FORM_EN(f)}${PERS_EN(f)}`,
    },
    {
      q: 'How do I check whether my Telegram channel, handle, website or I myself am on the list?',
      a: () => 'Type the handle, channel name, link, title, or a first name and surname (Cyrillic or Latin, as in a passport) into the search box on the front page — results appear instantly, in milliseconds, across all lists at once (entries from the formations list carry a purple label, entries from the persons list a teal one with the date of birth to tell namesakes apart). Search ignores case, “ё/е”, Latin vs Cyrillic “i”, quote styles and a trailing “/” in links, and treats “@nick”, “t.me/nick” and “nick” as the same thing. When there is no exact match, the site shows near matches: 1–2 letter typos and Latin transliteration.',
    },
    {
      q: 'How many entries are on the list and how often is it updated?',
      a: (f) => `As of ${f.updatedStr} the database holds ${f.totalStr} entries of the list of extremist materials${f.formations ? `, ${f.formationsStr} entries of the list of extremist formations` : ''}${f.persons ? ` and ${f.personsStr} entries of the list of individuals` : ''}. The materials list and the persons list refresh automatically twice a day: the official sources are checked in the morning and in the evening, and new entries reach the site a few minutes after each check; the formations list is checked once a day. ${f.infoShare ? `${f.infoShare}% of the materials list entries are “information products” (channels, websites, accounts, videos, chats); the rest are printed editions, books, symbols and paraphernalia.` : ''}`.trim(),
    },
    {
      q: 'What is the list of individuals involved in extremist activity?',
      a: (f) => `The list of citizens of Belarus, foreign nationals and stateless persons “involved in extremist activity” is kept by the Interior Ministry and published as several .doc files on its website${f.persons ? ` (${f.personsStr} people as of ${f.personsUpdatedStr})` : ''}. ${LEGAL_EN.persons} Each entry carries the surname, first name and patronymic, a Latin transliteration, citizenship, date of birth, the grounds (court and articles of the verdict), the date of inclusion, location and status (“serving the sentence”, “conviction not expunged”). The site shows these entries with a teal “Person” label, lets you search by name in Cyrillic or Latin, and the dates of birth help tell namesakes apart.`,
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
      q: 'How does the list of extremist materials differ from the list of extremist formations and the list of individuals?',
      a: (f) => `They are three different lists, and the site searches all of them at once. The list of “extremist materials” is formed by courts and carries administrative liability. The list of “extremist formations” is maintained by the Interior Ministry and the KGB${f.formations ? ` (${f.formationsStr} entries, checked once a day)` : ''}; such results carry a purple “Formation” label. ${LEGAL_EN.crime} The list of individuals “involved in extremist activity” is kept by the Interior Ministry${f.persons ? ` (${f.personsStr} people, checked twice a day)` : ''}: people with a conviction or another court decision under “extremism” articles, marked with a teal “Person” label. The tabs under the search box — “All · Materials · Formations · Persons” — show how many matches each list has and limit the results to one list. Many resources and people appear on several lists at once.`,
    },
    {
      q: 'Is this site safe to use?',
      a: () => 'The site collects no data: no queries, no cookies, no analytics. The site itself keeps no logs; the hosting (GitHub Pages), like any server, sees the IP address and the page address but not search queries — they never enter the address bar and run entirely in your browser, because the whole database is downloaded to the device. The watchlist, theme, language and sort order live only in this device’s localStorage, and “Clear everything” deletes them together with the offline copy of the database in one click. Do that before travelling to Belarus or crossing the border, and clear your browser history. Links inside entries lead to the listed resources themselves — the site warns you before opening. Opening the official list sites and files directly, or using the official search, can be risky in itself: visitor data may be collected by Belarusian authorities.',
    },
    {
      q: 'How do I find out when something new is added to the list?',
      a: () => 'The “What’s new” tab shows everything added to all three lists in the last 30 days. To avoid checking by hand there are three ways. The watchlist: type your handle or channel and press “Watch” — every time you open the site it re-checks all such queries and shows at the top whether anything new appeared, with optional browser notifications. The RSS feed feed.xml works in any feed reader and can be filtered by your own keywords. The Telegram channel @elist_by posts a digest after every update.',
    },
    {
      q: 'Is this an official site?',
      a: () => 'No. The site is unofficial and independent, with open source code on GitHub. Data is pulled automatically from the official publications — the Republican list of extremist materials (Ministry of Information), the list of extremist formations and the list of individuals (Interior Ministry) — and is never edited: entry text, grounds and dates are kept exactly as in the source. For legally significant decisions, verify against the official publication, bearing in mind that official sites may collect visitor data.',
    },
    {
      q: 'What should I do if I find myself or my resource on the list?',
      a: () => 'Check the entry text, the date and the grounds — the court name for materials, the Interior Ministry / KGB decision for formations, the verdict and the date of birth for a person (the list has many namesakes): they define what was ruled extremist and when. For a formation the liability is criminal, so seek advice right away. Add the query to your watchlist to see when a related entry appears. Consult human rights defenders about your risks and possible appeal: Viasna Human Rights Centre and Human Constanta.',
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
  be: (f) => `Пошук па экстрэмісцкіх спісах Беларусі: ${f.totalStr} запісаў Рэспубліканскага спісу экстрэмісцкіх матэрыялаў${f.formations ? `, ${f.formationsStr} запісаў пераліку экстрэмісцкіх фарміраванняў МУС/КДБ` : ''}${f.persons ? ` і ${f.personsStr} чалавек з пераліку фізічных асоб МУС` : ''} на ${f.updatedStr}, абнаўленне штодня. Праверце нік, Telegram-канал, сайт, кнігу ці імя, дадайце запыт у спіс назірання. Працуе афлайн, не збірае ніякіх даных.`,
  en: (f) => `Search the extremist lists of Belarus: ${f.totalStr} entries of the Republican list of extremist materials${f.formations ? `, ${f.formationsStr} entries of the Interior Ministry / KGB list of extremist formations` : ''}${f.persons ? ` and ${f.personsStr} people from the Interior Ministry list of individuals` : ''} as of ${f.updatedStr}, updated daily. Check a handle, Telegram channel, website, book or name and add it to your watchlist. Works offline, collects no data.`,
};

/** Ключавыя факты табліцай — структураваныя фрагменты лягчэй цытаваць. */
export const KEY_FACTS = {
  be: (f) => [
    ['Запісаў у базе', `${f.totalStr} (на ${f.updatedStr})`],
    ...(f.formations ? [['Экстрэмісцкіх фарміраванняў (МУС/КДБ)', `${f.formationsStr} (на ${f.formationsUpdatedStr}), правяраецца раз на суткі`]] : []),
    ...(f.persons ? [['Фізічных асоб у пераліку МУС', `${f.personsStr} (на ${f.personsUpdatedStr}), правяраецца двойчы на дзень`]] : []),
    ['Абнаўленне', 'аўтаматычна, двойчы на дзень'],
    ['Крыніца', 'афіцыйная публікацыя Рэспубліканскага спісу экстрэмісцкіх матэрыялаў; пералікі экстрэмісцкіх фарміраванняў і фізічных асоб — сайт МУС'],
    ['Пошук', 'цалкам у браўзеры; кірыліца ↔ лацінка, памылкі ў 1–2 літары'],
    ['Даныя пра карыстальніка', 'не збіраюцца: ні запытаў, ні cookies, ні статыстыкі'],
    ['Афлайн', 'так, PWA — база застаецца ў браўзеры'],
    ['Кошт', 'бясплатна, без рэгістрацыі'],
    ['Код', 'адкрыты, GitHub'],
  ],
  en: (f) => [
    ['Entries', `${f.totalStr} (as of ${f.updatedStr})`],
    ...(f.formations ? [['Extremist formations (Interior Ministry / KGB)', `${f.formationsStr} (as of ${f.formationsUpdatedStr}), checked once a day`]] : []),
    ...(f.persons ? [['Individuals on the Interior Ministry list', `${f.personsStr} (as of ${f.personsUpdatedStr}), checked twice a day`]] : []),
    ['Updates', 'automatic, twice a day'],
    ['Source', 'official publication of the Republican list of extremist materials; the lists of extremist formations and individuals — Interior Ministry website'],
    ['Search', 'entirely in the browser; Cyrillic ↔ Latin, 1–2 letter typos'],
    ['User data', 'none collected: no queries, no cookies, no analytics'],
    ['Offline', 'yes, PWA — the database stays in the browser'],
    ['Price', 'free, no sign-up'],
    ['Code', 'open source, GitHub'],
  ],
};
