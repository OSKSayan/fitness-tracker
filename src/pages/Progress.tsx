import { useEffect, useMemo, useState } from 'react';
import type { BodyEntry } from '../types';
import { useData } from '../store';
import { addDays, diffDays, formatDate, todayISO } from '../dates';
import { fmt, fmtL, fmtW, lIn, lOut, lUnit, parseNum, wIn, wOut, wUnit } from '../units';
import { uid } from '../defaults';
import { deleteBody, saveBody } from '../actions';
import { Card, ConfirmDialog, Empty, Field, Modal, Notice } from '../components/ui';
import { LineChart, linearTrend, type Point } from '../components/LineChart';

type Metric = 'waist' | 'belly' | 'chest' | 'hips';
const METRICS: { key: Metric; label: string }[] = [
  { key: 'waist', label: 'Талия' },
  { key: 'belly', label: 'Живот' },
  { key: 'chest', label: 'Грудь' },
  { key: 'hips', label: 'Бёдра' },
];

const PERIODS = [
  { id: '30', label: '4 нед.', days: 28 },
  { id: '90', label: '3 мес.', days: 91 },
  { id: '180', label: '6 мес.', days: 182 },
  { id: 'all', label: 'Всё время', days: 0 },
] as const;

export function Progress({ action, clearAction }: { action?: string; clearAction: () => void }) {
  const data = useData();
  const s = data.settings;
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('90');
  const [metric, setMetric] = useState<Metric>('waist');
  const [editing, setEditing] = useState<BodyEntry | null>(null);
  const [toDelete, setToDelete] = useState<BodyEntry | null>(null);

  useEffect(() => {
    if (action === 'add') {
      setEditing(newBody());
      clearAction();
    }
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => [...data.body].sort((a, b) => a.date.localeCompare(b.date)), [data.body]);
  const p = PERIODS.find((x) => x.id === period)!;
  const from = p.days ? addDays(todayISO(), -p.days) : '0000-01-01';

  const allWeights: Point[] = sorted.filter((b) => b.weight != null).map((b) => ({ date: b.date, value: wOut(s, b.weight!) }));
  const weights = allWeights.filter((x) => x.date >= from);
  const metricPoints: Point[] = sorted
    .filter((b) => b[metric] != null && b.date >= from)
    .map((b) => ({ date: b.date, value: lOut(s, b[metric]!) }));

  const firstW = allWeights[0];
  const lastW = allWeights[allWeights.length - 1];
  const spanDays = weights.length >= 2 ? diffDays(weights[weights.length - 1].date, weights[0].date) : 0;
  const trend = weights.length >= 3 && spanDays >= 14 ? linearTrend(weights) : null;
  const goalPace = wOut(s, s.goals.weeklyLossKg);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Прогресс</h1>
        <p className="muted">Вес и замеры</p>
      </header>

      <div className="row-actions start">
        <button type="button" className="btn btn-primary" onClick={() => setEditing(newBody())}>
          + Новая запись
        </button>
      </div>

      <div className="grid">
        <Card title="Текущий вес">
          <div className="big">{lastW ? `${fmt(lastW.value)} ${wUnit(s)}` : '—'}</div>
          <p className="muted">{lastW ? formatDate(lastW.date) : 'нет записей'}</p>
        </Card>
        <Card title="С первой записи">
          <div className="big">{firstW && lastW && allWeights.length > 1 ? signed(lastW.value - firstW.value, wUnit(s)) : '—'}</div>
          <p className="muted">{firstW && allWeights.length > 1 ? `с ${formatDate(firstW.date)}` : 'нужно минимум 2 записи'}</p>
        </Card>
        <Card title="Средний темп за период">
          <div className="big">{trend ? signed(trend.slope * 7, `${wUnit(s)}/нед.`) : '—'}</div>
          <p className="muted">
            {trend ? `по линии тренда · ориентир −${fmt(goalPace)} ${wUnit(s)}/нед.` : 'нужно ≥ 3 записей за ≥ 2 недели'}
          </p>
        </Card>
      </div>

      <Card
        title="График веса"
        action={
          <div className="seg" role="group" aria-label="Период">
            {PERIODS.map((x) => (
              <button key={x.id} type="button" aria-pressed={period === x.id} className={`seg-btn ${period === x.id ? 'seg-on' : ''}`} onClick={() => setPeriod(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        }
      >
        {weights.length ? (
          <>
            <LineChart points={weights} unit={wUnit(s)} label="Вес" />
            <p className="muted small">
              Вес колеблется изо дня в день из‑за воды, соли и еды — это нормально и не означает набор жира. Смотрите на линию тренда за
              несколько недель. Темп — ориентир, а не медицинская норма.
            </p>
          </>
        ) : (
          <Empty icon="📉">{allWeights.length ? 'За выбранный период записей нет — выберите период длиннее.' : 'Добавьте первую запись веса, чтобы увидеть график.'}</Empty>
        )}
      </Card>

      <Card
        title="Замеры"
        action={
          <label className="inline-select">
            <span className="sr-only">Замер</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {metricPoints.length ? (
          <LineChart points={metricPoints} unit={lUnit(s)} label={METRICS.find((m) => m.key === metric)!.label} />
        ) : (
          <Empty icon="📏">Замеров «{METRICS.find((m) => m.key === metric)!.label.toLowerCase()}» за период нет. Замеры необязательны.</Empty>
        )}
      </Card>

      <Card title="История записей">
        {sorted.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Дата</th>
                  <th scope="col">Вес</th>
                  {METRICS.map((m) => (
                    <th key={m.key} scope="col">
                      {m.label}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...sorted].reverse().map((b) => (
                  <tr key={b.id}>
                    <td>
                      {formatDate(b.date)}
                      {b.note && <div className="muted small">{b.note}</div>}
                    </td>
                    <td>{fmtW(s, b.weight)}</td>
                    {METRICS.map((m) => (
                      <td key={m.key}>{fmtL(s, b[m.key])}</td>
                    ))}
                    <td className="nowrap">
                      <button type="button" className="icon-btn small" aria-label={`Изменить запись от ${formatDate(b.date)}`} onClick={() => setEditing(b)}>
                        ✎
                      </button>
                      <button type="button" className="icon-btn small danger" aria-label={`Удалить запись от ${formatDate(b.date)}`} onClick={() => setToDelete(b)}>
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="🗒️">Записей пока нет.</Empty>
        )}
      </Card>

      <Modal open={!!editing} title={editing && data.body.some((b) => b.id === editing.id) ? 'Изменить запись' : 'Новая запись'} onClose={() => setEditing(null)}>
        {editing && <BodyForm entry={editing} onDone={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog
        open={!!toDelete}
        title="Удалить запись?"
        text={toDelete ? `Запись от ${formatDate(toDelete.date)} будет удалена.` : ''}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteBody(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}

function signed(v: number, unit: string) {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${fmt(Math.abs(r))} ${unit}`;
}

function newBody(): BodyEntry {
  return { id: uid(), date: todayISO(), weight: null, waist: null, belly: null, chest: null, hips: null, note: '' };
}

function BodyForm({ entry, onDone }: { entry: BodyEntry; onDone: () => void }) {
  const data = useData();
  const s = data.settings;
  const toStr = (v: number | null, conv: (x: number) => number) => (v != null ? String(+conv(v).toFixed(1)) : '');
  const [date, setDate] = useState(entry.date);
  const [vals, setVals] = useState<Record<'weight' | Metric, string>>({
    weight: toStr(entry.weight, (x) => wOut(s, x)),
    waist: toStr(entry.waist, (x) => lOut(s, x)),
    belly: toStr(entry.belly, (x) => lOut(s, x)),
    chest: toStr(entry.chest, (x) => lOut(s, x)),
    hips: toStr(entry.hips, (x) => lOut(s, x)),
  });
  const [note, setNote] = useState(entry.note);
  const [err, setErr] = useState<Record<string, string>>({});

  const submit = () => {
    const e: Record<string, string> = {};
    if (!date) e.date = 'Укажите дату';
    else if (date > todayISO()) e.date = 'Дата не может быть в будущем';
    const wMax = s.weightUnit === 'kg' ? 300 : 660;
    const lMax = s.lengthUnit === 'cm' ? 250 : 100;
    const w = parseNum(vals.weight, { min: s.weightUnit === 'kg' ? 30 : 66, max: wMax });
    if (w.error) e.weight = w.error;
    const m: Partial<Record<Metric, number | null>> = {};
    for (const { key } of METRICS) {
      const r = parseNum(vals[key], { min: s.lengthUnit === 'cm' ? 30 : 12, max: lMax });
      if (r.error) e[key] = r.error;
      m[key] = r.value != null ? lIn(s, r.value) : null;
    }
    if (!e.weight && w.value == null && METRICS.every(({ key }) => m[key] == null)) e.weight = 'Заполните вес или хотя бы один замер';
    setErr(e);
    if (Object.keys(e).length) return;
    saveBody({
      ...entry,
      date,
      weight: w.value != null ? wIn(s, w.value) : null,
      waist: m.waist ?? null,
      belly: m.belly ?? null,
      chest: m.chest ?? null,
      hips: m.hips ?? null,
      note: note.trim(),
    });
    onDone();
  };

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      <div className="two">
        <Field label="Дата" error={err.date}>
          {(p) => <input {...p} type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label={`Вес, ${wUnit(s)}`} error={err.weight}>
          {(p) => <input {...p} inputMode="decimal" autoFocus value={vals.weight} onChange={(e) => setVals({ ...vals, weight: e.target.value })} />}
        </Field>
      </div>
      <p className="muted small">Замеры необязательны, {lUnit(s)}:</p>
      <div className="two">
        {METRICS.map((m) => (
          <Field key={m.key} label={m.label} error={err[m.key]}>
            {(p) => <input {...p} inputMode="decimal" value={vals[m.key]} onChange={(e) => setVals({ ...vals, [m.key]: e.target.value })} />}
          </Field>
        ))}
      </div>
      <Field label="Заметка">{(p) => <textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="например, утром натощак" />}</Field>
      {Object.keys(err).length > 0 && <Notice tone="danger">Исправьте отмеченные поля.</Notice>}
      <div className="row-actions">
        <button type="button" className="btn" onClick={onDone}>
          Отмена
        </button>
        <button type="submit" className="btn btn-primary">
          Сохранить
        </button>
      </div>
    </form>
  );
}
