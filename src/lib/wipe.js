/**
 * «Ачысціць усё»: спіс назірання, налады, запыт укладкі, афлайн-копія базы і service worker.
 * Гісторыю браўзера сайт ачысціць не можа — пра гэта кажа тэкст пацвярджэння.
 */
export async function wipeBrowserData() {
  try { localStorage.clear(); } catch { /* прыватны рэжым */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
  try { history.replaceState(null, '', location.pathname + location.hash); } catch { /* ignore */ }
  try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch { /* няма Cache API */ }
  try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); } catch { /* няма SW */ }
}
