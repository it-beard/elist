import { useRecord } from '../hooks/useRecord.js';
import { useCopy } from '../hooks/useCopy.js';
import { fmtDate, isRecent } from '../lib/format.js';
import { extractArticle } from '../lib/court.js';
import { personSeries } from '../lib/person.js';
import { isIsoDate, personName, wantedSeries } from '../lib/wanted.js';
import { useLang } from '../hooks/useLang.jsx';
import { href, recordUrl } from '../hooks/useHashRoute.js';
import Highlight from './Highlight.jsx';
import { LinkIcon } from './icons.jsx';

/**
 * Картка запісу. Матэрыял (суды) — як раней: артыкул/тып, назва, рашэнне суда.
 * Экстрэмісцкае фарміраванне (МУС/КДБ) — фіялетавая палоска і плашка «Фарміраванне · МУС», назва,
 * кароткая назва, спасылкі і падстава. Фізічная асоба (пералік МУС) — бірузовая палоска і плашка
 * адпаведна артыкулаў («экстрэміст», «выказванні», «гр.дз.»), імя, транслітарацыя, дата нараджэння
 * з грамадзянствам, падстава (прысуд). Даведка з пераліку («судзімасць не пагашана», «адбывае пакаранне»)
 * не паказваецца нідзе: МУС не абнаўляе яе ва ўжо апублікаваных частках, і яна часта састарэлая.
 * Вышук РФ (паводле Медыязоны) — янтарная палоска і плашка
 * «Вышук РФ · МУС» (ведамства-ініцыятар), імя ў звычайным рэгістры, іншыя напісанні, год нараджэння з нацыянальнасцю,
 * рэгіёнам і ведамствам; дата — абвяшчэння ў вышук, прыблізная — «да …»; выключаны з базы — без даты, калі яе няма.
 * Асоба і запіс вышуку, звязаныя крос-спасылкай (тое ж імя і год нараджэння), паказваюць спасылку адно на аднаго.
 * Пазнака спіса вядомая з індэкса яшчэ да загрузкі фрагмента.
 *
 * Дата ў шапцы — спасылка на старонку запісу (на самой старонцы, linked=false, — звычайны тэкст); значок справа
 * капіюе пастаянную спасылку ў буфер і на паўтары секунды паказвае «Скапіявана». Нумар у спісе ў картцы не
 * паказваецца — ён сярод палёў на старонцы запісу.
 */
export default function ResultItem({ item, tokens, chunkSize, linked = true }) {
  const { t } = useLang();
  const rec = useRecord(item.i, chunkSize, item.id);
  const [copied, copy] = useCopy();
  const isF = item.list === 'f', isP = item.list === 'p', isW = item.list === 'w';
  // лэйбл: артыкул з рашэння суда; калі яго ў тэксце няма — тып матэрыялу
  const art = !isF && !isP && !isW && rec?.court ? extractArticle(rec.court) : null;
  const pArt = isP ? (item.art || (rec?.articles ? personSeries(rec.articles) : 'other')) : null;
  const wArt = isW ? (item.art || (rec ? wantedSeries(rec.agency) : 'wother')) : null;
  const facts = isP && rec ? [rec.birth && `${t.born} ${rec.birth}`, rec.citizenship].filter(Boolean).join(' · ')
    : isW && rec ? [rec.year && t.bornYear(rec.year), rec.nationality && personName(rec.nationality), rec.region, rec.agency && `${t.requestedBy} ${rec.agency}`].filter(Boolean).join(' · ') : '';
  const permalink = isW ? t.permalinkW : isP ? t.permalinkP : isF ? t.permalinkF : t.permalink;
  const to = href(`r/${item.id}`);
  // дата: для матэрыялу — рашэння суда, для асобы — уключэння ў пералік, для вышуку — абвяшчэння (прыблізная — «да …»)
  const dateText = item.date ? fmtDate(item.date) : isW && rec?.before ? `${t.before} ${fmtDate(rec.before)}` : '';
  const dateTitle = isW ? t.wantedDateTitle : isP ? t.includedTitle : undefined;
  // буфер абмену недаступны (не-https, адмова) — «падзяліцца», а без яго — адкрыць запіс: спасылка будзе ў адрасным радку
  const copyLink = async () => {
    const url = recordUrl(item.id);
    if (await copy(url)) return;
    if (navigator.share) navigator.share({ title: t.title, url }).catch(() => {});
    else location.hash = to;
  };
  // выключаны з базы вышуку без даты (крыніца яе не дае) — толькі словы, без «??.??.????»
  const gone = item.removed ? `${isW ? t.wantedOut : t.removed}${isIsoDate(item.removed) ? ` ${fmtDate(item.removed)}` : ''}` : '';
  const also = rec?.also?.length ? rec.also : [];
  const alsoLinks = also.length > 0 && (
    <p className="also">
      {also.map((id, i) => <a key={id} href={href(`r/${id}`)}>↔ {isW ? t.alsoInPersons : t.alsoInWanted}{also.length > 1 ? ` (${i + 1})` : ''}</a>)}
    </p>
  );
  return (
    <li className={`item${isW ? ' wanted' : isF ? ' formation' : isP ? ' person' : ' material'}${item.removed ? ' removed' : ''}`}>
      <div className="meta">
        {isW ? (
          <span className="type wanted" title={t.wantedTitle(wArt)}>{t.wantedLabel(wArt)}</span>
        ) : isP ? (
          <span className="type person" title={t.personTitle(pArt)}>{t.personLabel(pArt)}</span>
        ) : isF ? (
          <span className="type form" title={rec?.basis ? rec.basis.replace(/\s+/g, ' ') : t.formationTitle}>{t.formationLabel(rec?.kind, rec?.decidedBy)}</span>
        ) : art ? (
          <span className="type" title={t.articleTitle(art.num, art.code)}>{t.article(art.num, art.code)}</span>
        ) : rec?.type ? (
          <span className="type"><Highlight text={rec.type} tokens={tokens} /></span>
        ) : null}
        {dateText ? (
          linked ? <a className="num date" href={to} title={dateTitle || t.openRec}>{dateText}</a> : <span className="num" title={dateTitle}>{dateText}</span>
        ) : linked ? (
          // без даты ў індэксе (адзінкавыя матэрыялы) — старонка запісу ўсё роўна мусіць быць даступная з карткі
          <a className="date" href={to}>{t.openRec}</a>
        ) : null}
        {isRecent(item.added) && <span className="badge-new" title={t.addedTitle}>{t.isNew} · {fmtDate(item.added)}</span>}
        {gone && <span className="gone">{gone}</span>}
        <button type="button" className={`idx${copied ? ' on' : ''}`} title={permalink} aria-label={permalink} onClick={copyLink}>
          <LinkIcon />
          {copied && <span className="copy-tip" role="status">{t.copied}</span>}
        </button>
      </div>
      {rec?.error ? (
        <p className="name error">{t.recError(rec.error)}</p>
      ) : rec?.stale ? (
        <p className="name error">{t.recStale}</p>
      ) : rec ? (
        isW ? (
          <>
            <p className="name"><Highlight text={personName(rec.name)} tokens={tokens} /></p>
            {rec.aliases?.length > 0 && <p className="alias"><Highlight text={rec.aliases.map(personName).join(' · ')} tokens={tokens} /></p>}
            {facts && <p className="facts"><Highlight text={facts} tokens={tokens} /></p>}
            {alsoLinks}
          </>
        ) : isP ? (
          <>
            <p className="name"><Highlight text={rec.name} tokens={tokens} /></p>
            {rec.translit && <p className="alias"><Highlight text={rec.translit} tokens={tokens} /></p>}
            {facts && <p className="facts"><Highlight text={facts} tokens={tokens} /></p>}
            {rec.basis && <p className="court"><Highlight text={rec.basis} tokens={tokens} /></p>}
            {alsoLinks}
          </>
        ) : isF ? (
          <>
            <p className="name"><Highlight text={rec.name} tokens={tokens} /></p>
            {rec.alias && rec.alias !== rec.name && <p className="alias"><Highlight text={rec.alias} tokens={tokens} /></p>}
            {rec.links && <p className="links"><Highlight text={rec.links.replace(/\n{2,}/g, '\n')} tokens={tokens} /></p>}
            {rec.basis && <p className="court"><Highlight text={rec.basis} tokens={tokens} /></p>}
          </>
        ) : (
          <>
            <p className="name"><Highlight text={rec.name} tokens={tokens} /></p>
            {rec.court && <p className="court"><Highlight text={rec.court} tokens={tokens} /></p>}
          </>
        )
      ) : (
        <p className="name skeleton" aria-busy="true">&nbsp;</p>
      )}
    </li>
  );
}
