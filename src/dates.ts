const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function nowTime(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDays(s: string, n: number): string {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86400000);
}

/** 0 = понедельник ... 6 = воскресенье */
export function weekdayIndex(s: string): number {
  return (fromISO(s).getDay() + 6) % 7;
}

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAYS_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

export function formatDate(s: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = fromISO(s);
  const showYear = opts.year ?? d.getFullYear() !== new Date().getFullYear();
  const str = d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(showYear ? { year: 'numeric' } : {}),
  });
  return opts.weekday ? `${str}, ${WEEKDAYS_FULL[weekdayIndex(s)]}` : str;
}

export function relativeDay(s: string): string {
  const d = diffDays(s, todayISO());
  if (d === 0) return 'сегодня';
  if (d === 1) return 'завтра';
  if (d === -1) return 'вчера';
  return formatDate(s, { weekday: true });
}

/**
 * Дата старта по умолчанию: ближайшее 12 ноября, не привязанное к конкретному году.
 * Если 12 ноября текущего года было недавно (до 90 дней назад) — берём его, иначе следующее.
 */
export function defaultStartDate(): string {
  const now = new Date();
  const thisYear = toISO(new Date(now.getFullYear(), 10, 12));
  const ago = diffDays(todayISO(), thisYear);
  if (ago <= 90) return thisYear;
  return toISO(new Date(now.getFullYear() + 1, 10, 12));
}
