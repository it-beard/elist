import { matchRanges } from '../lib/normalize.js';
import ExtLink from './ExtLink.jsx';

const URL_RE = /(https?:\/\/[^\s"<>)]+|(?<![\w/.@])(?:t\.me|www\.)[^\s"<>)]+)/g;

/** Тэкст з клікабельнымі спасылкамі (ExtLink: папярэджанне перад першым пераходам) і падсветкай супадзенняў (у тым ліку ўнутры спасылак). */
export default function Highlight({ text, tokens }) {
  const marks = matchRanges(text, tokens);
  const out = [];
  let pos = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:)]+$/, ''); // не захопліваць знакі прыпынку ў канцы
    const start = m.index, end = start + url.length;
    out.push(...marked(text, pos, start, marks));
    out.push(<ExtLink key={`u${start}`} href={url.startsWith('http') ? url : `https://${url}`}>{marked(text, start, end, marks)}</ExtLink>);
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
