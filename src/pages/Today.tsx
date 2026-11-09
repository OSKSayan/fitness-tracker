import { useEffect, useState } from 'react';
import type { FoodEntry } from '../types';
import { useData } from '../store';
import { addDays, diffDays, formatDate, relativeDay, todayISO } from '../dates';
import { fmt, fmtW, parseNum, wIn, wUnit } from '../units';
import { uid } from '../defaults';
import { isLightPhase, nextWorkoutType, sessionsBetween, upcomingSessions, weekNumber } from '../schedule';
import { addWater, patchDaily, saveBody, setMark } from '../actions';
import { Card, Field, Modal, Progress } from '../components/ui';
import { DoctorNotice } from '../components/MedicalNotes';
import { FoodForm, newFood, QUICK_FOOD } from '../components/FoodForm';
import type { Go } from '../App';

const TIPS = [
  'Гарнир — примерно вдвое меньше обычной порции.',
  'Без добавки — одной тарелки достаточно.',
  'В каждый приём пищи — немного белка: яйца, творог, кефир, курица или тунец.',
  'Сладкие напитки лучше заменить водой. Сладкое — 1–2 раза в неделю.',
];

export function Today({ go, action, clearAction }: { go: Go; action?: string; clearAction: () => void }) {
  const data = useData();
  const s = data.settings;
  const g = s.goals;
  const realToday = todayISO();
  const [date, setDate] = useState(realToday);
  const isToday = date === realToday;
  const [food, setFood] = useState<{ entry: FoodEntry; isNew: boolean } | null>(null);

  useEffect(() => {
    if (action === 'add-food') {
      setFood({ entry: newFood(realToday), isNew: true });
      clearAction();
    }
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  const day = data.daily[date] ?? { steps: null, waterMl: 0 };
  const items = data.food.filter((f) => f.date === date).sort((a, b) => a.time.localeCompare(b.time));
  const kcal = items.reduce((a, f) => a + (f.kcal ?? 0), 0);
  const protein = items.reduce((a, f) => a + (f.protein ?? 0), 0);

  const untilStart = diffDays(s.startDate, realToday);
  const week = weekNumber(data);
  const tip = TIPS[Math.abs(diffDays(date, '2000-01-01')) % TIPS.length];

  return (
    <div className="page">
      <header className="page-head">
        <div className="date-nav">
          <button type="button" className="icon-btn" aria-label="Предыдущий день" onClick={() => setDate(addDays(date, -1))}>
            ‹
          </button>
          <h1>{isToday ? 'Сегодня' : relativeDay(date).replace(/^./, (c) => c.toUpperCase())}</h1>
          <button type="button" className="icon-btn" aria-label="Следующий день" disabled={isToday} onClick={() => setDate(addDays(date, 1))}>
            ›
          </button>
        </div>
        <p className="muted">
          {formatDate(date, { weekday: true })}
          {isToday &&
            (untilStart > 0 ? ` · до старта зала ${untilStart} дн.` : ` · неделя ${week}${isLightPhase(data) ? ', лёгкие веса' : ''}`)}
        </p>
      </header>

      {isToday && <DoctorNotice />}
      {isToday && <WorkoutCard go={go} />}

      <Card title="💧 Вода">
        <div className="big">
          {fmt(day.waterMl / 1000, 2)} л <span className="unit">из {fmt(g.waterMinMl / 1000)}–{fmt(g.waterMaxMl / 1000)} л</span>
        </div>
        <Progress value={day.waterMl} min={g.waterMinMl} max={g.waterMaxMl} label="Вода за день" />
        <div className="row-actions start">
          <button type="button" className="btn btn-primary grow" onClick={() => addWater(date, 250)}>
            + Стакан (250 мл)
          </button>
          <button type="button" className="btn" aria-label="Убрать 250 мл" disabled={day.waterMl <= 0} onClick={() => addWater(date, -250)}>
            −
          </button>
        </div>
      </Card>

      <Card title="🍽️ Еда">
        <div className="two">
          <div>
            <div className="big">{fmt(kcal, 0)}</div>
            <p className="muted small">ккал · ориентир ~{fmt(g.kcalMin, 0)}–{fmt(g.kcalMax, 0)}</p>
          </div>
          <div>
            <div className="big">{fmt(protein, 0)} г</div>
            <p className="muted small">белка · ориентир ~{g.proteinMin}–{g.proteinMax}</p>
          </div>
        </div>
        {items.length > 0 && (
          <ul className="food-list">
            {items.map((f) => (
              <li key={f.id}>
                <button type="button" className="food-row" onClick={() => setFood({ entry: f, isNew: false })}>
                  <span>{f.name}</span>
                  <span className="muted">{f.kcal != null ? `${fmt(f.kcal, 0)} ккал` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-primary" onClick={() => setFood({ entry: newFood(date), isNew: true })}>
          + Добавить еду
        </button>
        <div className="chips">
          {QUICK_FOOD.map((q) => (
            <button
              key={q.name}
              type="button"
              className="chip"
              onClick={() => setFood({ entry: { ...newFood(date), name: q.name, kcal: q.kcal, protein: q.protein }, isNew: true })}
            >
              + {q.name}
            </button>
          ))}
        </div>
        <p className="tip">💡 {tip}</p>
      </Card>

      <StepsCard date={date} steps={day.steps} />
      <WeightCard date={date} go={go} />

      <p className="muted small center">Калории, белок и шаги — ориентиры, а не медицинские предписания.</p>

      <Modal open={!!food} title={food?.isNew ? 'Добавить еду' : 'Изменить'} onClose={() => setFood(null)}>
        {food && <FoodForm entry={food.entry} isNew={food.isNew} onDone={() => setFood(null)} />}
      </Modal>
    </div>
  );
}

function WorkoutCard({ go }: { go: Go }) {
  const data = useData();
  const today = todayISO();
  const todaySession = sessionsBetween(data, today, today)[0];
  const next = upcomingSessions(data, 2).find((x) => x.date > today || x.status === 'planned');

  if (todaySession?.status === 'done') {
    return (
      <Card title="🏋️ Тренировка" className="card-ok">
        <div className="big">✓ Выполнена</div>
        <p className="muted">{next && next.date > today ? `Следующая: день ${next.type}, ${relativeDay(next.date)}` : 'Отличная работа!'}</p>
      </Card>
    );
  }
  if (todaySession?.status === 'planned') {
    const type = nextWorkoutType(data);
    return (
      <Card title="🏋️ Тренировка" className="card-accent">
        <div className="big">Сегодня: день {type}</div>
        <p className="muted small">{data.plan[type].map((e) => e.name).join(' · ')}</p>
        <button type="button" className="btn btn-primary btn-big" onClick={() => go('workout', 'log')}>
          Начать тренировку
        </button>
        <div className="row-actions start">
          <button type="button" className="link" onClick={() => setMark(today, { status: 'moved', movedTo: addDays(today, 1) })}>
            Перенести на завтра
          </button>
          <button type="button" className="link muted-link" onClick={() => setMark(today, { status: 'skipped' })}>
            Пропустить
          </button>
        </div>
      </Card>
    );
  }
  if (todaySession?.status === 'skipped' || todaySession?.status === 'moved') {
    return (
      <Card title="🏋️ Тренировка">
        <div className="big">{todaySession.status === 'skipped' ? 'Пропущена' : 'Перенесена'}</div>
        <p className="muted">{next ? `Следующая: день ${next.type}, ${relativeDay(next.date)}` : ''}</p>
        <button
          type="button"
          className="link start"
          onClick={() => setMark(today, null)}
        >
          Отменить
        </button>
      </Card>
    );
  }
  return (
    <Card title="🏋️ Тренировка">
      <div className="big">Сегодня отдых</div>
      <p className="muted">{next ? `Следующая: день ${next.type}, ${relativeDay(next.date)}` : 'Дни тренировок выбираются в настройках.'}</p>
      <button type="button" className="link start" onClick={() => go('workout', 'log')}>
        Всё равно записать тренировку
      </button>
    </Card>
  );
}

function StepsCard({ date, steps }: { date: string; steps: number | null }) {
  const data = useData();
  const g = data.settings.goals;
  const [val, setVal] = useState('');
  const [err, setErr] = useState<string>();
  const save = () => {
    const r = parseNum(val, { min: 0, max: 100000, integer: true, label: 'Шаги' });
    if (r.error) return setErr(r.error);
    if (r.value == null) return setErr('Введите число шагов');
    setErr(undefined);
    patchDaily(date, { steps: r.value });
    setVal('');
  };
  return (
    <Card title="👟 Шаги">
      <div className="big">
        {fmt(steps ?? 0, 0)} <span className="unit">из {fmt(g.stepsMin, 0)}–{fmt(g.stepsMax, 0)}</span>
      </div>
      <Progress value={steps ?? 0} min={g.stepsMin} max={g.stepsMax} label="Шаги за день" />
      <div className="inline-form">
        <Field label="Сколько шагов (из телефона или часов)" error={err}>
          {(p) => <input {...p} inputMode="numeric" placeholder="например, 8500" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />}
        </Field>
        <button type="button" className="btn" onClick={save}>
          OK
        </button>
      </div>
    </Card>
  );
}

function WeightCard({ date, go }: { date: string; go: Go }) {
  const data = useData();
  const s = data.settings;
  const [val, setVal] = useState('');
  const [err, setErr] = useState<string>();
  const [saved, setSaved] = useState(false);
  const last = [...data.body].filter((b) => b.weight != null).sort((a, b) => b.date.localeCompare(a.date))[0];
  const todays = data.body.find((b) => b.date === date && b.weight != null);

  const save = () => {
    const r = parseNum(val, { min: s.weightUnit === 'kg' ? 30 : 66, max: s.weightUnit === 'kg' ? 300 : 660, label: 'Вес' });
    if (r.error) return setErr(r.error);
    if (r.value == null) return setErr('Введите вес');
    setErr(undefined);
    const kg = wIn(s, r.value);
    const existing = data.body.find((b) => b.date === date);
    saveBody(existing ? { ...existing, weight: kg } : { id: uid(), date, weight: kg, waist: null, belly: null, chest: null, hips: null, note: '' });
    setVal('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card title="⚖️ Вес" action={<button type="button" className="link" onClick={() => go('progress')}>График →</button>}>
      <div className="big">{last ? fmtW(s, last.weight) : '—'}</div>
      <p className="muted small">{last ? `последняя запись: ${relativeDay(last.date)}` : 'Записей пока нет'}</p>
      <div className="inline-form">
        <Field label={todays ? `Исправить вес за этот день, ${wUnit(s)}` : `Вес за этот день, ${wUnit(s)}`} error={err}>
          {(p) => <input {...p} inputMode="decimal" placeholder="например, 85,2" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />}
        </Field>
        <button type="button" className="btn" onClick={save}>
          {saved ? '✓' : 'OK'}
        </button>
      </div>
    </Card>
  );
}
