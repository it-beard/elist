import { describe, it, expect, vi, afterEach } from 'vitest';
import { fmtDate, daysAgo, isRecent, NEW_DAYS, STALE_HOURS, hoursSince, fmtTime, fmtLocalDate, relDay } from '../src/lib/format.js';

// Толькі Date падмяняецца — таймеры застаюцца сапраўднымі
const at = (ms) => vi.useFakeTimers({ now: ms, toFake: ['Date'] });
afterEach(() => vi.useRealTimers());

describe('format: канстанты', () => {
  it('NEW_DAYS = 30 (значок «новае»), STALE_HOURS = 36 (папярэджанне пры 2 праверках на суткі)', () => {
    expect(NEW_DAYS).toBe(30);
    expect(STALE_HOURS).toBe(36);
  });
});

describe('fmtDate / fmtLocalDate', () => {
  it('ISO → дд.мм.гггг; пустое — пусты радок', () => {
    expect(fmtDate('2026-09-06')).toBe('06.09.2026');
    expect(fmtDate('')).toBe('');
    expect(fmtDate(null)).toBe('');
  });
  it('fmtLocalDate: па мясцовай даце прылады (Date ці ISO-радок)', () => {
    expect(fmtLocalDate(new Date(2026, 8, 1, 12))).toBe('01.09.2026');
    expect(fmtLocalDate(new Date(2026, 0, 31, 23, 59).toISOString())).toBe('31.01.2026');
  });
});

describe('isRecent / daysAgo', () => {
  it('роўна 30 дзён — яшчэ «новае», на мілісекунду больш — ужо не', () => {
    at(Date.UTC(2026, 8, 6));
    expect(daysAgo('2026-08-07')).toBe(30);
    expect(isRecent('2026-08-07')).toBe(true);
    expect(isRecent('2026-08-06')).toBe(false);
    at(Date.UTC(2026, 8, 6) + 1);
    expect(isRecent('2026-08-07')).toBe(false);
  });
  it('сёння і будучыня (гадзіннік прылады адстае) — новае; без даты — не', () => {
    at(Date.UTC(2026, 8, 6, 15));
    expect(isRecent('2026-09-06')).toBe(true);
    expect(isRecent('2026-09-07')).toBe(true);
    expect(isRecent('')).toBe(false);
    expect(isRecent(null)).toBe(false);
    expect(isRecent(undefined)).toBe(false);
  });
});

describe('hoursSince / fmtTime', () => {
  it('hoursSince: гадзіны ад моманту (ISO ці Date), дробныя; мяжа STALE_HOURS', () => {
    at(Date.UTC(2026, 8, 6, 12));
    expect(hoursSince('2026-09-05T00:00:00Z')).toBe(36);
    expect(hoursSince(new Date(Date.UTC(2026, 8, 6, 11, 30)))).toBe(0.5);
    expect(hoursSince('2026-09-05T00:00:00Z') >= STALE_HOURS).toBe(true);
    expect(hoursSince('2026-09-05T00:00:01Z') >= STALE_HOURS).toBe(false);
  });
  it('fmtTime: 24-гадзінны фармат на абедзвюх мовах; поўнач — «00:30», а не «24:30» ці «12:30 AM»', () => {
    const night = new Date(2026, 8, 6, 0, 30), day = new Date(2026, 8, 6, 13, 5);
    for (const lang of ['be', 'en']) {
      expect(fmtTime(night, lang)).toBe('00:30');
      expect(fmtTime(day, lang)).toBe('13:05');
      expect(fmtTime(day.toISOString(), lang)).toBe('13:05');
    }
  });
});

describe('relDay', () => {
  const now = new Date(2026, 8, 1, 0, 0, 1); // 1 верасня, секунда пасля поўначы
  it('мяжа сутак — па мясцовай даце: учора да 23:59:59, пазаўчора і будучыня — null', () => {
    expect(relDay(new Date(2026, 8, 1, 23, 59), now)).toBe('today');
    expect(relDay(new Date(2026, 7, 31, 23, 59, 59), now)).toBe('yesterday');
    expect(relDay(new Date(2026, 7, 30, 23, 59, 59), now)).toBe(null);
    expect(relDay(new Date(2026, 8, 2, 0, 0), now)).toBe(null);
    expect(relDay('2026-09-01T12:00:00', now)).toBe('today'); // ISO-радок без пояса — мясцовы час
  });
  it('па змаўчанні now — цяперашні момант', () => {
    at(new Date(2026, 8, 6, 12).getTime());
    expect(relDay(new Date(2026, 8, 5, 12))).toBe('yesterday');
    expect(relDay(new Date(2026, 8, 6, 1))).toBe('today');
  });
});
