import { createContext, useContext, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage.js';
import { DEFAULT_LANG, LANGS, STRINGS } from '../lib/i18n.js';

const Ctx = createContext({ lang: DEFAULT_LANG, t: STRINGS[DEFAULT_LANG], setLang: () => {} });

export function LangProvider({ children }) {
  const [stored, setLang] = useLocalStorage('lang', DEFAULT_LANG);
  const lang = LANGS.includes(stored) ? stored : DEFAULT_LANG;
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return <Ctx.Provider value={{ lang, t: STRINGS[lang], setLang }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
