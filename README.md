# Пошук па Рэспубліканскім сьпісе экстрэмісцкіх матэрыялаў

Статычны сайт (React + Vite) з хуткім пошукам па афіцыйным Рэспубліканскім сьпісе экстрэмісцкіх матэрыялаў.

## Архітэктура

```
data/materials.json        база — крыніца праўды (тып, назва, суд, дата, №, дададзена/выдалена)
data/meta.json             дата абнаўленьня, крыніца, колькасьць
scripts/update.mjs         спампоўвае афіцыйны сьпіс → разбор табліцы → даўнясеньне новых запісаў у базу
scripts/build-index.mjs    база → public/data/{index.json, chunks/N.json, meta.json} (генэруецца пры зборцы, у git не трапляе)
src/lib/                   чыстая логіка, агульная для Node і браўзэра
  normalize.js             нармалізацыя (захоўвае даўжыню → дакладная падсьветка), парсер запыту, дыяпазоны супадзеньняў
  court.js                 назва суда, дата рашэньня
  search.js                фільтр + сартаваньне
  api.js                   загрузка індэкса і ленівых фрагментаў (з кэшам)
src/hooks/                 useIndex, useRecord (ленівы фрагмент), useUrlParam (?q=)
  translit.js              кірыліца ↔ лацінка (расейская трансьлітарацыя і беларуская лацінка), і ↔ и
  fuzzy.js                 прыблізны пошук (Левенштэйн па словах корпуса), калі дакладных супадзеньняў няма
  watch.js                 праверка сьпісу назіраньня па індэксе
  schedule.js              час наступнага аўтаабнаўленьня
src/hooks/                 useIndex (з «праверыць зноў»), useRecord, useUrlParam (?q=), useHashRoute (#/new, #/r/<id>), useWatchlist, useOnline
src/components/            Header, Nav, SearchBar, Options, WatchPanel, ResultList, ResultItem, Highlight, WhatsNew, RecordPage, Consequences
scripts/geo.mjs            GEO: robots.txt, llms.txt, sitemap.xml, статычныя FAQ-старонкі
scripts/geo-plugin.mjs     Vite-плагін: JSON-LD, meta з жывымі лічбамі, кантэнт для краўлераў без JS
src/lib/faq.js             факты пра сайт і FAQ (бе/en) — крыніца для старонак, llms.txt і Schema.org
public/sw.js               service worker: афлайн-рэжым (абалонка + база ў кэшы)
public/feed.xml            RSS новых запісаў (генэруецца пры зборцы, у git не трапляе)
scripts/notify.mjs         дайджэст новых запісаў у Telegram-канал (калі зададзеныя сакрэты)
test/                      Vitest
.github/workflows/         штодзённае абнаўленьне базы + зборка і дэплой на GitHub Pages
```

## Функцыі для тых, хто правярае сябе

- **Сьпіс назіраньня** — увядзіце нік/канал/спасылку і націсьніце «Сачыць». Пры кожным адкрыцьці сайт правярае ўсе запыты і паказвае зьверху «супадзеньняў няма» або «новыя супадзеньні». Захоўваецца толькі ў `localStorage`; ёсьць «ачысьціць усё» і неабавязковыя браўзэрныя апавяшчэньні.
- **Што новага** (`#/new`) — запісы па даце зьяўленьня ў сьпісе, зьніклыя — асобна; **RSS** `feed.xml` для чытачоў стужак.
- **Пошук па спасылках і ніках** — `https://`, `www.`, `@`, хвост `/` адкідаюцца; кірыліца ↔ лацінка ў абодва бакі; калі дакладна нічога няма — прыблізныя словы (1–2 памылкі) з пазнакай.
- **Старонка запісу** (`#/r/<id>`) — пастаянная спасылка, «падзяліцца», спасылка на дакумэнт-крыніцу з пазіцыяй у файле.
- **«Што гэта значыць для мяне?»** — кароткае тлумачэньне наступстваў і розьніцы са сьпісам «экстрэмісцкіх фарміраваньняў» МУС, спасылкі на праваабаронцаў.
- **Афлайн (PWA)** — пасьля першага адкрыцьця сайт і база працуюць без інтэрнэту; можна «ўсталяваць» на тэлефон. У шапцы — час наступнага абнаўленьня і папярэджаньне, калі крыніца не адказвае.

**Як працуе пошук.** Пры адкрыцьці грузіцца толькі індэкс (~400 КБ gzip): нармалізаваныя назвы, слоўнікі тыпаў і судоў, даты. Пошук — падрадковы па ўсіх словах запыту (ці па любым), просты `includes` над ~6 тыс. радкоў — мілісэкунды. Поўныя запісы ляжаць у фрагментах па 200 і падцягваюцца толькі для тых, што на экране.

## Лакальна

```sh
npm install
npm run update     # спампаваць сьвежы сьпіс і абнавіць data/
npm run dev        # зьбярэ індэкс і адкрые dev-сэрвер
npm test
npm run build      # dist/
```

Разабраць лакальны файл: `node scripts/update.mjs шлях/да/файла`.

Зьменныя асяродзьдзя: `SITE_URL` — адрас сайта для спасылак у RSS/Telegram (у CI задаецца аўтаматычна).

## Telegram-канал з новымі запісамі (неабавязкова)

Стварыце бота (@BotFather), дадайце яго адміністратарам у публічны канал і задайце ў Settings → Secrets рэпазіторыя `TELEGRAM_BOT_TOKEN` і `TELEGRAM_CHAT_ID` (`@назва_канала` або лічбавы id). Пасьля кожнага абнаўленьня з новымі запісамі `scripts/notify.mjs` дасылае дайджэст. Ніякіх пэрсанальных запытаў — толькі публічны сьпіс новага.

## Люстэрка

Сайт статычны: `npm run build` → зьмесьціва `dist/` можна выкласьці на любы хостынг (Netlify, Cloudflare Pages, свой сэрвэр, IPFS). Каб спасылкі былі правільныя, задайце `BASE_PATH` (шлях, з якога аддаецца сайт) і `SITE_URL` (поўны адрас).

## GEO і SEO

Сайт — SPA, таму без JavaScript краўлер бачыць пусты `<div id="root">`, а генэратыўныя рухавікі (ChatGPT, Claude, Perplexity, AI Overviews) цытуюць толькі тое, што ёсьць у HTML. Каб сайт трапляў у адказы, пры зборцы генэруецца:

| Файл | Што гэта |
| --- | --- |
| `faq.html`, `faq-en.html` | статычныя старонкі «пытаньне → самадастатковы адказ» з `FAQPage`-разьметкай |
| `llms.txt` | карта сайта ў prompt-friendly выглядзе: факты, лічбы, спасылкі |
| `llms-full.txt` | увесь тэкст адным файлам: факты, правілы пошуку, усе пытаньні і адказы (бе + en) |
| `robots.txt` | яўны дазвол `GPTBot`, `ClaudeBot`, `PerplexityBot` і іншым + `Sitemap:` |
| `sitemap.xml` | тры старонкі з `lastmod` па даце базы |
| JSON-LD у `index.html` | `WebSite` з `SearchAction` (`?q=…`), `Dataset`, `WebApplication` |
| фолбэк у `#root` | загаловак, лічбы і `<noscript>` са спасылкамі — React замяняе яго пры мантаваньні |
| `opensearch.xml` | сайт можна дадаць як пошукавік у адрасны радок браўзэра (`?q=`) |
| `404.html` | старонка памылкі са спасылкамі — GitHub Pages аддае яе на невядомых шляхах |
| `.well-known/security.txt` | куды паведамляць пра ўразьлівасьці (RFC 9116), з копіяй у корані |

Тэксты жывуць у [`src/lib/faq.js`](src/lib/faq.js) і адтуль трапляюць ва ўсе фарматы адразу, з жывымі лічбамі (колькасьць запісаў, дата абнаўленьня, доля тыпаў). Усе файлы генэруюцца, у git не трапляюць.

## GitHub Pages

1. Запушце `main` у рэпазіторый.
2. **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Actions → General → Workflow permissions: Read and write** (каб бот мог камітаваць базу).
4. Запусьціце workflow уручную або дачакайцеся штодзённага запуску. `BASE_PATH` падстаўляецца з назвы рэпазіторыя аўтаматычна; для карыстальніцкага дамэну пастаўце `BASE_PATH: /`.

## Пошук

- Не ўлічваюцца рэгістр, «ё/е», лацінская/кірылічная «i», віды лапак. Фраза ў лапках — цалкам.
- Па рашэньні суда шукаюцца назва суда і дата рашэньня (словамі «20 августа 2026» ці лічбамі «20.08.2026»).
- Запыт у URL (`?q=…`) — спасылкай можна дзяліцца. `/` — фокус на поле пошуку.

## About (English)

**What this is.** An unofficial, open-source search over the official Republican list of extremist materials of Belarus — the register of channels, websites, accounts, videos, books and symbols that Belarusian courts have ruled extremist. Live at [elist.itbeard.com](https://elist.itbeard.com/).

**Key facts.**

| | |
| --- | --- |
| Entries | ~6 000, updated automatically once a day (04:17 UTC) |
| Search | runs entirely in the browser; Cyrillic ↔ Latin transliteration, 1–2 letter typo tolerance |
| Data collected | none — no queries, no cookies, no analytics, no server |
| Offline | yes, PWA; the database stays in the browser |
| Alerts | watchlist with browser notifications, RSS `feed.xml`, Telegram [@elist_by](https://t.me/elist_by) |
| Stack | React 19 + Vite, static hosting, ~400 KB gzip index |
| Price | free, no sign-up |

**Why it exists.** Distribution, production, storage and transport of listed materials is an administrative offence in Belarus under Art. 19.11 of the Administrative Code — up to 20 base units or arrest for individuals. People need a fast way to check whether they, their channel or their bookshelf is on the list, without leaving a trace on a server.

**Answers to common questions** are on the static [FAQ page](https://elist.itbeard.com/faq.html) ([English](https://elist.itbeard.com/faq-en.html)).
