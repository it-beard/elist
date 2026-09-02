# Пошук па Рэспубліканскім спісе экстрэмісцкіх матэрыялаў

Статычны сайт (React + Vite) з хуткім пошукам па афіцыйным Рэспубліканскім спісе экстрэмісцкіх матэрыялаў.

## Архітэктура

```
data/materials.json        база — крыніца праўды (тып, назва, суд, дата, №, дададзена/выдалена)
data/meta.json             дата абнаўлення, крыніца, колькасць
scripts/update.mjs         спампоўвае афіцыйны спіс → разбор табліцы → даўнясенне новых запісаў у базу
scripts/build-index.mjs    база → public/data/{index.json, chunks/N.json, meta.json} (генеруецца пры зборцы, у git не трапляе)
src/lib/                   чыстая логіка, агульная для Node і браўзера
  normalize.js             нармалізацыя (захоўвае даўжыню → дакладная падсветка), парсер запыту, дыяпазоны супадзенняў
  court.js                 назва суда, дата рашэння
  search.js                фільтр + сартаванне
  api.js                   загрузка індэкса і ленівых фрагментаў (з кэшам)
src/hooks/                 useIndex, useRecord (ленівы фрагмент), useUrlParam (?q=)
  translit.js              кірыліца ↔ лацінка (руская транслітарацыя і беларуская лацінка), і ↔ и
  fuzzy.js                 прыблізны пошук (Левенштэйн па словах корпуса), калі дакладных супадзенняў няма
  watch.js                 праверка спісу назірання па індэксе
src/hooks/                 useIndex (з «праверыць зноў»), useRecord, useUrlParam (?q=), useHashRoute (#/new, #/stats, #/r/<id>), useWatchlist, useOnline
src/components/            Header, Nav, SearchBar, Options, WatchPanel, ResultList, ResultItem, Highlight, WhatsNew, RecordPage, Consequences
scripts/geo.mjs            GEO: robots.txt, llms.txt, sitemap.xml, статычныя FAQ-старонкі
scripts/geo-plugin.mjs     Vite-плагін: JSON-LD, meta з жывымі лічбамі, кантэнт для краўлераў без JS
src/lib/faq.js             факты пра сайт і FAQ (бе/en) — крыніца для старонак, llms.txt і Schema.org
public/sw.js               service worker: афлайн-рэжым (абалонка + база ў кэшы)
public/feed.xml            RSS новых запісаў (генеруецца пры зборцы, у git не трапляе)
scripts/notify.mjs         дайджэст новых запісаў у Telegram-канал (калі зададзеныя сакрэты)
data/notified.json         id запісаў, ужо дасланых у Telegram — абарона ад паўторных дайджэстаў
test/                      Vitest
.github/workflows/         штодзённае абнаўленне базы + зборка і дэплой на GitHub Pages
```

## Функцыі для тых, хто правярае сябе

- **Спіс назірання** — увядзіце нік/канал/спасылку і націсніце «Сачыць». Пры кожным адкрыцці сайт правярае ўсе запыты і паказвае зверху «супадзенняў няма» або «новыя супадзенні». Захоўваецца толькі ў `localStorage`; ёсць «ачысціць усё» і неабавязковыя браўзерныя апавяшчэнні.
- **Новае** (`#/new`) — запісы па даце з’яўлення ў спісе, зніклыя — асобна; **RSS** `feed.xml` для чытачоў стужак.
- **Статыстыка** (`#/stats`) — таймлайн колькасці запісаў па даце судовага рашэння: стос бараў па артыкуле (314 ГПК / 302 КГС / без артыкула) з лініяй тэндэнцыі, маштаб і пракрутка жэстамі, картка перыяду і табліца-дублёр (`src/lib/stats.js`, `Timeline.jsx`, `StatsPage.jsx`).
- **Пошук па спасылках і ніках** — `https://`, `www.`, `@`, хвост `/` адкідаюцца; кірыліца ↔ лацінка ў абодва бакі; калі дакладна нічога няма — прыблізныя словы (1–2 памылкі) з пазнакай.
- **Старонка запісу** (`#/r/<id>`) — пастаянная спасылка, «падзяліцца», спасылка на дакумент-крыніцу з пазіцыяй у файле.
- **«Што гэта значыць для мяне?»** — кароткае тлумачэнне наступстваў і розніцы са спісам «экстрэмісцкіх фарміраванняў» МУС, спасылкі на праваабаронцаў.
- **Афлайн (PWA)** — пасля першага адкрыцця сайт і база працуюць без інтэрнэту; можна «ўсталяваць» на тэлефон. У шапцы — час наступнага абнаўлення і папярэджанне, калі крыніца не адказвае.

**Як працуе пошук.** Пры адкрыцці грузіцца толькі індэкс (~400 КБ gzip): нармалізаваныя назвы, слоўнікі тыпаў і судоў, даты. Пошук — падрадковы па ўсіх словах запыту (ці па любым), просты `includes` над ~6 тыс. радкоў — мілісекунды. Поўныя запісы ляжаць у фрагментах па 200 і падцягваюцца толькі для тых, што на экране.

## Лакальна

```sh
npm install
npm run update     # спампаваць свежы спіс і абнавіць data/
npm run dev        # збярэ індэкс і адкрые dev-сервер
npm test
npm run build      # dist/
```

Разабраць лакальны файл: `node scripts/update.mjs шлях/да/файла`.

Зменныя асяроддзя: `SITE_URL` — адрас сайта для спасылак у RSS/Telegram (у CI задаецца аўтаматычна).

## Telegram-канал з новымі запісамі (неабавязкова)

Стварыце бота (@BotFather), дадайце яго адміністратарам у публічны канал і задайце ў Settings → Secrets рэпазіторыя `TELEGRAM_BOT_TOKEN` і `TELEGRAM_CHAT_ID` (`@назва_канала` або лічбавы id). Пасля кожнага абнаўлення з новымі запісамі `scripts/notify.mjs` дасылае дайджэст. Ніякіх персанальных запытаў — толькі публічны спіс новага.

Кожны запіс трапляе ў канал адзін раз: дасланыя id пішуцца ў `data/notified.json` і камітуюцца разам з базай, таму другі запуск за суткі нічога не дублюе. Калі адпраўка ўпала на сярэдзіне, пазначаецца толькі тое, што сышло, а рэшта дабіраецца наступным запускам (акно — 7 дзён, адзнакі захоўваюцца 60 дзён).

## Люстэрка

Сайт статычны: `npm run build` → змесціва `dist/` можна выкласці на любы хостынг (Netlify, Cloudflare Pages, свой сервер, IPFS). Каб спасылкі былі правільныя, задайце `BASE_PATH` (шлях, з якога аддаецца сайт) і `SITE_URL` (поўны адрас).

## GEO і SEO

Сайт — SPA, таму без JavaScript краўлер бачыць пусты `<div id="root">`, а генератыўныя рухавікі (ChatGPT, Claude, Perplexity, AI Overviews) цытуюць толькі тое, што ёсць у HTML. Каб сайт трапляў у адказы, пры зборцы генеруецца:

| Файл | Што гэта |
| --- | --- |
| `faq.html`, `faq-en.html` | статычныя старонкі «пытанне → самадастатковы адказ» з `FAQPage`-разметкай |
| `llms.txt` | карта сайта ў prompt-friendly выглядзе: факты, лічбы, спасылкі |
| `llms-full.txt` | увесь тэкст адным файлам: факты, правілы пошуку, усе пытанні і адказы (бе + en) |
| `robots.txt` | яўны дазвол `GPTBot`, `ClaudeBot`, `PerplexityBot` і іншым + `Sitemap:` |
| `sitemap.xml` | тры старонкі з `lastmod` па даце базы |
| JSON-LD у `index.html` | `WebSite` з `SearchAction` (`?q=…`), `Dataset`, `WebApplication` |
| фолбэк у `#root` | загаловак, лічбы і `<noscript>` са спасылкамі — React замяняе яго пры мантаванні |
| `opensearch.xml` | сайт можна дадаць як пошукавік у адрасны радок браўзера (`?q=`) |
| `404.html` | старонка памылкі са спасылкамі — GitHub Pages аддае яе на невядомых шляхах |
| `.well-known/security.txt` | куды паведамляць пра ўразлівасці (RFC 9116), з копіяй у корані |

Тэксты жывуць у [`src/lib/faq.js`](src/lib/faq.js) і адтуль трапляюць ва ўсе фарматы адразу, з жывымі лічбамі (колькасць запісаў, дата абнаўлення, доля тыпаў). Усе файлы генеруюцца, у git не трапляюць.

## GitHub Pages

1. Запушце `main` у рэпазіторый.
2. **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Actions → General → Workflow permissions: Read and write** (каб бот мог камітаваць базу).
4. Запусціце workflow уручную або дачакайцеся штодзённага запуску. `BASE_PATH` падстаўляецца з назвы рэпазіторыя аўтаматычна; для карыстальніцкага дамену пастаўце `BASE_PATH: /`.

## Пошук

- Не ўлічваюцца рэгістр, «ё/е», лацінская/кірылічная «i», віды лапак. Фраза ў лапках — цалкам.
- Па рашэнні суда шукаюцца назва суда і дата рашэння (словамі «20 августа 2026» ці лічбамі «20.08.2026»).
- Запыт у URL (`?q=…`) — спасылкай можна дзяліцца. `/` — фокус на поле пошуку.

## About (English)

**What this is.** An unofficial, open-source search over the official Republican list of extremist materials of Belarus — the register of channels, websites, accounts, videos, books and symbols that Belarusian courts have ruled extremist. Live at [elist.itbeard.com](https://elist.itbeard.com/).

**Key facts.**

| | |
| --- | --- |
| Entries | ~6 000, updated automatically twice a day |
| Search | runs entirely in the browser; Cyrillic ↔ Latin transliteration, 1–2 letter typo tolerance |
| Data collected | none — no queries, no cookies, no analytics, no server |
| Offline | yes, PWA; the database stays in the browser |
| Alerts | watchlist with browser notifications, RSS `feed.xml`, Telegram [@elist_by](https://t.me/elist_by) |
| Stack | React 19 + Vite, static hosting, ~400 KB gzip index |
| Price | free, no sign-up |

**Why it exists.** Distribution, production, storage and transport of listed materials is an administrative offence in Belarus under Art. 19.11 of the Administrative Code — up to 20 base units or arrest for individuals. People need a fast way to check whether they, their channel or their bookshelf is on the list, without leaving a trace on a server.

**Answers to common questions** are on the static [FAQ page](https://elist.itbeard.com/faq.html) ([English](https://elist.itbeard.com/faq-en.html)).
