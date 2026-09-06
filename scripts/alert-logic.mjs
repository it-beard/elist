/**
 * Паведамленні адміну пра змену стану крыніц — чыстая логіка для scripts/alert.mjs source. Бягучыя мета-файлы
 * параўноўваюцца з тымі, што ў HEAD, і шлюцца толькі пераходы: крыніца перастала/пачала адказваць, уключылася/
 * выключылася запасная; для пералікаў МУС sourceError — і недаступная крыніца, і засцярога, што спыніла абнаўленне.
 * steps — вынікі крокаў CI (steps.<id>.outcome): крок упаў, а ў меце няма sourceError — скрыпт не паспеў яе запісаць
 * (таймаўт кроку ці збой да запісу меты); інакш пра такое ніхто б не даведаўся.
 */
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const DIED = new Set(['failure', 'cancelled']); // крок не завяршыўся сам: упаў ці забіты таймаўтам

/** Паведамленні (масіў радкоў HTML) для пераходаў стану; пусты масіў — стан не змяніўся. */
export function sourceMessages({ cur = {}, prev = {}, curF = {}, prevF = {}, curP = {}, prevP = {}, steps = {} } = {}) {
  const msgs = [];
  if (Boolean(cur.sourceError) !== Boolean(prev.sourceError)) {
    msgs.push(cur.sourceError ? `⚠️ Крыніца не адказвае: ${esc(cur.sourceError)}` : '✅ Крыніца зноў адказвае.');
  }
  if (Boolean(cur.fallback) !== Boolean(prev.fallback)) {
    msgs.push(cur.fallback ? `⚠️ Афіцыйная крыніца недаступная, узятая запасная: ${esc(cur.sourcePage || '')}` : '✅ Зноў афіцыйная крыніца.');
  }
  // другі спіс: пералік экстрэмісцкіх фарміраванняў (МУС)
  if (Boolean(curF.sourceError) !== Boolean(prevF.sourceError)) {
    msgs.push(curF.sourceError ? `⚠️ Пералік фарміраванняў (МУС) не абнаўляецца: ${esc(curF.sourceError)}` : '✅ Пералік фарміраванняў (МУС) зноў абнаўляецца.');
  }
  if (DIED.has(steps.formations) && !curF.sourceError) {
    msgs.push('⚠️ Крок абнаўлення пераліку фарміраванняў (МУС) не завяршыўся (таймаўт ці збой да запісу меты).');
  }
  // трэці спіс: пералік фізічных асоб (МУС, некалькі .doc)
  if (Boolean(curP.sourceError) !== Boolean(prevP.sourceError)) {
    msgs.push(curP.sourceError ? `⚠️ Пералік фізічных асоб (МУС) не абнаўляецца: ${esc(curP.sourceError)}` : '✅ Пералік фізічных асоб (МУС) зноў абнаўляецца.');
  }
  if (DIED.has(steps.persons) && !curP.sourceError) {
    msgs.push('⚠️ Крок абнаўлення пераліку фізічных асоб (МУС) не завяршыўся (таймаўт ці збой да запісу меты).');
  }
  return msgs;
}
