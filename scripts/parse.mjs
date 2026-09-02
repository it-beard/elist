/**
 * Разбор тэксту .doc са спісам: табліца з трох калонак (тып / назва / суд), радкі падзеленыя «\t\n»,
 * ячэйкі — «\t». Чыстыя функцыі без сеткі і файлаў — каб іх можна было тэставаць.
 */
import crypto from 'node:crypto';
import { recordKey } from '../src/lib/identity.js';
import { extractDate } from '../src/lib/court.js';

export const clean = (s) =>
  s
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();

/** id = sha1 ад замарожанай нармалізацыі (src/lib/identity.js) — стабільны між зборкамі. */
export const recordId = (type, name, court) => crypto.createHash('sha1').update(recordKey(type, name, court)).digest('hex').slice(0, 12);

export function parseRows(body) {
  const rows = body.split('\t\n');
  const items = [];
  for (const raw of rows) {
    const cells = raw.split('\t').map(clean);
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    if (cells.length < 2) continue;
    let [type, ...rest] = cells;
    if (/вид экстремистских материалов/i.test(type)) continue; // загаловак табліцы
    // калі ячэйка «тып» адсутнічае і ў першай ячэйцы апісанне — пераносім у назву
    if (rest.length < 2 && type.length > 80) { rest.unshift(type); type = ''; }
    if (/^республиканский список/i.test(type) && rest.length < 2) continue;
    let name, court;
    if (rest.length >= 2) {
      court = rest.pop();
      name = rest.join('\n');
    } else {
      name = rest[0];
      court = '';
    }
    if (!name) continue;
    items.push({ id: recordId(type, name, court), type, name, court, date: extractDate(court) });
  }
  return items;
}
