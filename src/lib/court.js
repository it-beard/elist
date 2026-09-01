/** Выдзяляе назву суда з тэксту рашэння: «Решение суда Ленинского района г.Гродно от …» → «суда Ленинского района г.Гродно». */
const COURT_RE = /(суд[а-я]*\s[^\n]*?)(?=\s+от\s+\d|\s*\n|\s+\d{1,2}\s+[а-я]+\s+\d{4}|$)/i;

export function courtName(court) {
  const m = court.match(COURT_RE);
  return (m ? m[1] : court.split('\n')[0]).replace(/\s+/g, ' ').trim();
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTH_INDEX = Object.fromEntries(MONTHS_GEN.map((m, i) => [m, i + 1]));

/** «от 20 августа 2026 года» → «2026-08-20» (першая дата ў тэксце). */
export function extractDate(text) {
  const m = text.match(/(\d{1,2})\s+([а-я]+)\s+(\d{4})/i);
  const month = m && MONTH_INDEX[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** ISO-дата → «20 августа 2026 20.08.2026» — каб дату можна было шукаць і словамі, і лічбамі. */
export function dateWords(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${+d} ${MONTHS_GEN[+m - 1]} ${y} ${d}.${m}.${y}`;
}

const CODES = [
  [/гражданского процессуального кодекса|\bГПК\b/i, 'gpk'],
  [/кодекса гражданского судопроизводства|\bКГС\b/i, 'kgs'],
];

/**
 * Артыкул, на які спасылаецца рашэнне: «…в соответствии с 314 статьей Гражданского процессуального
 * кодекса…» → { num: '314', code: 'gpk' }; «…со статьей 302 Кодекса гражданского судопроизводства…»
 * → { num: '302', code: 'kgs' }. null — калі артыкула ў тэксце няма.
 */
export function extractArticle(text) {
  const m = (text || '').match(/(\d{2,3})(?:-?[йя])?\s+стать[а-яё]*|стать[а-яё]*\s+(\d{2,3})/i);
  if (!m) return null;
  const code = CODES.find(([re]) => re.test(text))?.[1] || null;
  return { num: m[1] || m[2], code };
}
