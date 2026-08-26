import { useCallback, useState } from 'react';

/** Стан, сынхранізаваны з параметрам URL (?q=…), каб спасылкай можна было дзяліцца. */
export function useUrlParam(name) {
  const [value, setValue] = useState(() => new URLSearchParams(location.search).get(name) || '');
  const set = useCallback((v) => {
    setValue(v);
    const u = new URL(location);
    if (v) u.searchParams.set(name, v); else u.searchParams.delete(name);
    history.replaceState(null, '', u);
  }, [name]);
  return [value, set];
}
