import type { Settings } from './types';

const LB = 2.20462;
const IN = 2.54;

export const wUnit = (s: Settings) => (s.weightUnit === 'kg' ? 'кг' : 'фунт');
export const lUnit = (s: Settings) => (s.lengthUnit === 'cm' ? 'см' : 'дюйм');

/** кг -> единицы пользователя */
export const wOut = (s: Settings, kg: number) => (s.weightUnit === 'kg' ? kg : kg * LB);
/** единицы пользователя -> кг */
export const wIn = (s: Settings, v: number) => (s.weightUnit === 'kg' ? v : v / LB);
export const lOut = (s: Settings, cm: number) => (s.lengthUnit === 'cm' ? cm : cm / IN);
export const lIn = (s: Settings, v: number) => (s.lengthUnit === 'cm' ? v : v * IN);

export function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export const fmtW = (s: Settings, kg: number | null | undefined) =>
  kg == null ? '—' : `${fmt(wOut(s, kg))} ${wUnit(s)}`;
export const fmtL = (s: Settings, cm: number | null | undefined) =>
  cm == null ? '—' : `${fmt(lOut(s, cm))} ${lUnit(s)}`;

/**
 * Разбор числа из поля ввода. Пустая строка -> null.
 * Возвращает { value } или { error }.
 */
export function parseNum(
  raw: string,
  opts: { min?: number; max?: number; integer?: boolean; label?: string } = {},
): { value: number | null; error?: string } {
  const t = raw.trim().replace(',', '.');
  if (t === '') return { value: null };
  const n = Number(t);
  const label = opts.label ? `«${opts.label}»: ` : '';
  if (!Number.isFinite(n)) return { value: null, error: `${label}введите число` };
  if (opts.integer && !Number.isInteger(n)) return { value: null, error: `${label}введите целое число` };
  if (opts.min != null && n < opts.min) return { value: null, error: `${label}не меньше ${fmt(opts.min)}` };
  if (opts.max != null && n > opts.max) return { value: null, error: `${label}не больше ${fmt(opts.max)}` };
  return { value: n };
}
