import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Капіяванне ў буфер абмену з кароткім станам «Скапіявана»: [copied, copy]. copy(text) вяртае true, калі тэкст
 * запісаны, і false, калі буфер недаступны (не-https, адмова) — выклікальнік сам вырашае, чым замяніць
 * (напрыклад, navigator.share). Стан скідаецца праз ms; таймер чысціцца пры размантаванні.
 */
export function useCopy(ms = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { return false; }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), ms);
    return true;
  }, [ms]);
  return [copied, copy];
}
