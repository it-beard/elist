/**
 * Мінімальны чытач .xlsx без залежнасцяў: ZIP (node:zlib) + разбор sharedStrings і першага ліста
 * рэгулярнымі выразамі. Дастаткова для табліцы-пераліку МУС; формулы, стылі і даты-фарматы ігнаруюцца
 * (даты Excel прыходзяць лічбамі-серыяламі — гл. excelDate).
 */
import { inflateRawSync } from 'node:zlib';

const SIG_EOCD = 0x06054b50, SIG_CDIR = 0x02014b50, SIG_LOCAL = 0x04034b50;

/** Файлы архіва: Map назва → Buffer. Толькі метады «stored» і «deflate», без ZIP64 (файлы малыя). */
export function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('не ZIP-архіў (няма EOCD)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== SIG_CDIR) throw new Error('пашкоджаны central directory');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    if (buf.readUInt32LE(local) !== SIG_LOCAL) throw new Error(`пашкоджаны запіс ${name}`);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + csize);
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, inflateRawSync(raw));
    else throw new Error(`непадтрыманы метад сціску ${method} (${name})`);
    p += 46 + nlen + elen + clen;
  }
  return files;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const unescapeXml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(parseInt(e[1] === 'x' || e[1] === 'X' ? e.slice(2) : e.slice(1), e[1] === 'x' || e[1] === 'X' ? 16 : 10));
  return ENT[e] ?? m;
});

/** Тэкст з <t>…</t> унутры <si> або <is> (рытч-тэкст з некалькіх <r> склейваецца). */
const textOf = (xml) => unescapeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

/** Агульныя радкі: масіў па індэксе. */
export function sharedStrings(xml) {
  return [...(xml || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
}

/**
 * Радкі ліста: масіў { n, cells } — n нумар радка ў Excel, cells — { A: 'тэкст', B: … }.
 * Пустыя ячэйкі прапускаюцца; лічбы застаюцца радкамі («44460»).
 */
export function sheetRows(xml, strings) {
  const rows = [];
  for (const row of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const n = Number((row[1].match(/\br="(\d+)"/) || [])[1]);
    const cells = {};
    for (const c of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], inner = c[2] || '';
      const col = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
      if (!col) continue;
      const type = (attrs.match(/\bt="(\w+)"/) || [])[1];
      let val;
      if (type === 's') { const v = inner.match(/<v>(\d+)<\/v>/); val = v ? strings[Number(v[1])] ?? '' : ''; }
      else if (type === 'inlineStr') val = textOf(inner);
      else { const v = inner.match(/<v>([\s\S]*?)<\/v>/); val = v ? unescapeXml(v[1]) : ''; }
      if (val !== '') cells[col] = val;
    }
    rows.push({ n, cells });
  }
  return rows;
}

/** Серыял даты Excel (дні ад 30.12.1899) → «2021-09-21»; не лічба — null. */
export function excelDate(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20_000 || n > 80_000) return null; // 1954–2119: усё астатняе — не дата
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5).toISOString().slice(0, 10);
}

/** .xlsx (Buffer) → радкі першага ліста. */
export function readXlsx(buf) {
  const files = unzip(buf);
  const sheetName = [...files.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  if (!sheetName) throw new Error('у архіве няма ліста xl/worksheets/sheet1.xml');
  const strings = sharedStrings(files.get('xl/sharedStrings.xml')?.toString('utf8'));
  return sheetRows(files.get(sheetName).toString('utf8'), strings);
}
