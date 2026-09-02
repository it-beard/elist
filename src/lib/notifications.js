/**
 * Апавяшчэнне спісу назірання. Chrome на Android не дазваляе new Notification() са старонкі —
 * толькі праз service worker, таму спачатку спрабуем яго.
 */
export async function showNotification(title, body) {
  const opts = { body, icon: `${import.meta.env.BASE_URL}icon-192.png`, tag: 'elist-watch', renotify: true };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) { await reg.showNotification(title, opts); return; }
  } catch { /* далей — старонкавае */ }
  new Notification(title, opts);
}
