import { useState } from 'react';
import { diffDays, formatDate } from '../dates';
import { fmt } from '../units';

export interface Point {
  date: string;
  value: number;
}

/** Линейная регрессия по дням. Возвращает наклон (единиц в день) и сдвиг. */
export function linearTrend(points: Point[]) {
  if (points.length < 2) return null;
  const x0 = points[0].date;
  const xs = points.map((p) => diffDays(p.date, x0));
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: my - slope * mx, x0 };
}

const W = 380;
const H = 220;
const PAD = { l: 40, r: 10, t: 12, b: 26 };

export function LineChart({ points, unit, label, showTrend = true }: { points: Point[]; unit: string; label: string; showTrend?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return null;

  const first = points[0].date;
  const span = Math.max(1, diffDays(points[points.length - 1].date, first));
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const padV = Math.max(0.5, (hi - lo) * 0.15);
  lo -= padV;
  hi += padV;

  const x = (date: string) => PAD.l + (diffDays(date, first) / span) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

  const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 4);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const trend = showTrend && points.length >= 3 ? linearTrend(points) : null;
  const last = points[points.length - 1];
  const ap = active != null ? points[active] : null;

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}: ${points.length} записей, от ${fmt(points[0].value)} до ${fmt(last.value)} ${unit}`}
        onMouseLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">
              {fmt(t)}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 8} className="chart-axis">
          {formatDate(first)}
        </text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" className="chart-axis">
          {formatDate(last.date)}
        </text>
        {trend && (
          <line
            className="chart-trend"
            x1={x(first)}
            y1={y(trend.intercept)}
            x2={x(last.date)}
            y2={y(trend.intercept + trend.slope * span)}
          />
        )}
        <path d={path} className="chart-line" />
        {points.map((p, i) => (
          <circle
            key={p.date + i}
            cx={x(p.date)}
            cy={y(p.value)}
            r={active === i ? 6 : 4}
            className="chart-dot"
            tabIndex={0}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(i)}
          >
            <title>{`${formatDate(p.date)}: ${fmt(p.value)} ${unit}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="chart-caption">
        {ap ? (
          <span>
            {formatDate(ap.date)}: <strong>{fmt(ap.value)} {unit}</strong>
          </span>
        ) : (
          <span>Нажмите на точку, чтобы увидеть значение</span>
        )}
        {trend && (
          <span className="legend">
            <i className="legend-line" /> записи <i className="legend-trend" /> тренд
          </span>
        )}
      </figcaption>
    </figure>
  );
}
