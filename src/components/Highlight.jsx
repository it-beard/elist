import { matchRanges } from '../lib/normalize.js';
import { useLang } from '../hooks/useLang.jsx';

const URL_RE = /(https?:\/\/[^\s"<>)]+|(?<![\w/.@])(?:t\.me|www\.)[^\s"<>)]+)/g;

// Спасылкі ў запісах вядуць на матэрыялы са спісу: перад першым пераходам за сесію — папярэджанне.
const ACK = 'elist-links-ok';
let ackMem = false;
const acknowledged = () => { try { return ackMem || sessionStorage.getItem(ACK) === '1'; } catch { return ackMem; } };
const acknowledge = () => { ackMem = true; try { sessionStorage.setItem(ACK, '1'); } catch { /* ignore */ } };

/** Тэкст з клікабельнымі спасылкамі і падсветкай супадзенняў (у тым ліку ўнутры спасылак). */
export default function Highlight({ text, tokens }) {
  const { t } = useLang();
  const marks = matchRanges(text, tokens);
  const onClick = (e) => {
    if (acknowledged()) return;
    e.preventDefault();
    if (!confirm(t.linkWarn)) return;
    acknowledge();
    open(e.currentTarget.href, '_blank', 'noopener,noreferrer');
  };
  const out = [];
  let pos = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:)]+$/, ''); // не захопліваць знакі прыпынку ў канцы
    const start = m.index, end = start + url.length;
    out.push(...marked(text, pos, start, marks));
    out.push(
      <a key={`u${start}`} href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer nofollow" onClick={onClick}>
        {marked(text, start, end, marks)}
      </a>,
    );
    pos = end;
  }
  out.push(...marked(text, pos, text.length, marks));
  return out;
}

/** Адрэзак text[from, to) з <mark> там, дзе ён перасякаецца з дыяпазонамі супадзенняў. */
function marked(text, from, to, marks) {
  const parts = [];
  let pos = from;
  for (const [a, b] of marks) {
    const s = Math.max(a, from), e = Math.min(b, to);
    if (s >= e) continue;
    if (s > pos) parts.push(text.slice(pos, s));
    parts.push(<mark key={`m${s}`}>{text.slice(s, e)}</mark>);
    pos = e;
  }
  if (pos < to) parts.push(text.slice(pos, to));
  return parts;
}
