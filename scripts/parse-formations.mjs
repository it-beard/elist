/**
 * Разбор пераліку «экстрэмісцкіх фарміраванняў» МУС/КДБ (xlsx → запісы). Чыстыя функцыі без сеткі і файлаў.
 *
 * Калонкі ліста: A №, B назва, C кароткая назва / удзельнікі, D спасылкі, E адрас / рэсурс,
 * F падстава («Решение МВД от 18.10.2021 № 1ЭК …», часам некалькі рашэнняў), G дата ўступлення ў сілу,
 * H дата ўключэння ў пералік, I даведка, J апісанне лагатыпа. Частка ячэек аб’яднаная ці пустая.
 */
import crypto from 'node:crypto';
import { idNormalize } from '../src/lib/identity.js';
import { clean } from './parse.mjs';
import { excelDate } from './xlsx.mjs';

const oneLine = (s) => s.replace(/\s+/g, ' ').trim();

/** «29.10.2021» → «2021-10-29» (першая дата ў тэксце); серыял Excel — таксама. */
export function anyDate(v) {
  if (!v) return null;
  const serial = excelDate(v);
  if (serial) return serial;
  const m = String(v).match(/(\d{1,2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1].padStart(2, '0')}` : null;
}

/** Першае рашэнне з падставы: «18.10.2021 № 1ЭК» — устойлівы ключ запісу (пазнейшыя рашэнні дапісваюцца ў хвост). */
export function firstDecision(basis) {
  const m = (basis || '').match(/(\d{1,2}\.\d{2}\.\d{4})\s*(?:г\.?\s*)?№?\s*([^\s«»"“”]+)?/);
  return m ? `${m[1]} ${m[2] || ''}`.trim() : '';
}

/** Хто прыняў рашэнне: КДБ, МУС або суд («экстрэмісцкія арганізацыі» ліквідуюцца судом). */
export const decidedBy = (basis) => {
  const b = basis || '';
  if (/КГБ|Комитет[а-я]* государственной безопасности/i.test(b)) return 'kgb';
  if (/МВД|Министерств[а-я]* внутренних дел/i.test(b)) return 'mvd';
  if (/(^|[^а-яё])суд/i.test(b)) return 'court'; // \b не працуе з кірыліцай
  return null;
};

/** id = sha1 ад назвы + першага рашэння (замарожаная нармалізацыя identity.js), з прэфіксам, каб не перасякацца з матэрыяламі. */
export const formationId = (name, basis) =>
  crypto.createHash('sha1').update(`formation|${idNormalize(name)}|${firstDecision(basis)}`).digest('hex').slice(0, 12);

/** Радкі xlsx.mjs → запісы пераліку (толькі пранумараваныя радкі). */
export function parseFormations(rows) {
  const items = [];
  for (const { cells } of rows) {
    const num = (cells.A || '').trim();
    if (!/^\d+\.?$/.test(num)) continue;
    const name = oneLine(cells.B || '');
    if (!name) continue;
    const basis = clean(cells.F || '');
    const kind = /организац/i.test(name.split(/[«"]/)[0]) ? 'organization' : 'formation';
    items.push({
      id: formationId(name, basis),
      kind,
      name,
      alias: clean(cells.C || ''),
      links: clean(cells.D || ''),
      address: clean(cells.E || ''),
      basis,
      decidedBy: decidedBy(basis),
      date: anyDate(cells.G) || anyDate(basis),
      included: anyDate(cells.H),
      info: clean(cells.I || ''),
      logo: clean(cells.J || ''),
    });
  }
  return items;
}
