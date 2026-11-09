import { useState } from 'react';
import { useData } from '../store';
import { diffDays, formatDate, relativeDay, todayISO } from '../dates';
import { fmt, fmtW, parseNum } from '../units';
import { isLightPhase, upcomingSessions, weekNumber } from '../schedule';
import { addWater, patchDaily } from '../actions';
import { isDueToday, REMINDER_LABELS } from '../reminders';
import { Card, Field, Progress } from '../components/ui';
import { DoctorNotice } from '../components/MedicalNotes';
import type { Go } from '../App';

export function Home({ go }: { go: Go }) {
  const data = useData();
  const { settings } = data;
  const g = settings.goals;
  const today = todayISO();
  const day = data.daily[today] ?? { steps: null, waterMl: 0 };
  const food = data.food.filter((f) => f.date === today);
  const kcal = food.reduce((s, f) => s + (f.kcal ?? 0), 0);
  const protein = food.reduce((s, f) => s + (f.protein ?? 0), 0);
  const lastWeight = [...data.body].filter((b) => b.weight != null).sort((a, b) => b.date.localeCompare(a.date))[0];
  const next = upcomingSessions(data, 1)[0];
  const week = weekNumber(data);
  const untilStart = diffDays(settings.startDate, today);
  const dueReminders = data.reminders.filter((r) => isDueToday(r));

  const [steps, setSteps] = useState('');
  const [stepsErr, setStepsErr] = useState<string>();

  const saveSteps = () => {
    const r = parseNum(steps, { min: 0, max: 100000, integer: true, label: 'Шаги' });
    if (r.error) return setStepsErr(r.error);
    if (r.value == null) return setStepsErr('Введите количество шагов');
    setStepsErr(undefined);
    patchDaily(today, { steps: r.value });
    setSteps('');
  };

  return (
    <div className="page">
      <header className="page-head">
        <p className="muted">{formatDate(today, { weekday: true })}</p>
        <h1>Сегодня</h1>
        <p className="muted">
          {untilStart > 0
            ? `До старта зала: ${untilStart} дн. (${formatDate(settings.startDate)})`
            : `Неделя ${week} с начала занятий${isLightPhase(data) ? ' · режим лёгких весов' : ''}`}
        </p>
      </header>

      <DoctorNotice />

      <div className="quick">
        <button type="button" className="btn btn-primary" onClick={() => go('workouts', 'log')}>
          + Тренировка
        </button>
        <button type="button" className="btn" onClick={() => go('nutrition', 'add')}>
          + Еда
        </button>
        <button type="button" className="btn" onClick={() => addWater(today, 250)}>
          + 250 мл воды
        </button>
        <button type="button" className="btn" onClick={() => go('progress', 'add')}>
          + Вес
        </button>
      </div>

      <div className="grid">
        <Card title="Вес">
          {lastWeight ? (
            <>
              <div className="big">{fmtW(settings, lastWeight.weight)}</div>
              <p className="muted">последняя запись: {relativeDay(lastWeight.date)}</p>
            </>
          ) : (
            <p className="muted">Пока нет записей веса.</p>
          )}
        </Card>

        <Card title="Следующая тренировка">
          {next ? (
            <>
              <div className="big">День {next.type}</div>
              <p className="muted">
                {relativeDay(next.date)}
                {next.status === 'done' && ' · выполнена ✓'}
              </p>
              {next.status !== 'done' && (
                <ul className="mini-list">
                  {data.plan[next.type].map((e) => (
                    <li key={e.id}>{e.name}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="muted">Выберите дни тренировок в разделе «Тренировки».</p>
          )}
        </Card>

        <Card title="Шаги">
          <div className="big">
            {fmt(day.steps ?? 0, 0)} <span className="unit">/ {fmt(g.stepsMin, 0)}–{fmt(g.stepsMax, 0)}</span>
          </div>
          <Progress value={day.steps ?? 0} min={g.stepsMin} max={g.stepsMax} label="Шаги за день" />
          <div className="inline-form">
            <Field label="Шаги за сегодня (вручную)" error={stepsErr}>
              {(p) => (
                <input
                  {...p}
                  inputMode="numeric"
                  placeholder={day.steps != null ? String(day.steps) : 'например, 8500'}
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveSteps()}
                />
              )}
            </Field>
            <button type="button" className="btn" onClick={saveSteps}>
              Сохранить
            </button>
          </div>
        </Card>

        <Card title="Вода">
          <div className="big">
            {fmt(day.waterMl / 1000, 2)} <span className="unit">/ {fmt(g.waterMinMl / 1000)}–{fmt(g.waterMaxMl / 1000)} л</span>
          </div>
          <Progress value={day.waterMl} min={g.waterMinMl} max={g.waterMaxMl} label="Вода за день" />
          <div className="row-actions start">
            <button type="button" className="btn btn-small" onClick={() => addWater(today, 250)}>
              +250 мл
            </button>
            <button type="button" className="btn btn-small" onClick={() => addWater(today, 500)}>
              +500 мл
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => addWater(today, -250)} disabled={day.waterMl <= 0}>
              −250 мл
            </button>
          </div>
        </Card>

        <Card title="Питание" action={<button type="button" className="link" onClick={() => go('nutrition')}>Открыть</button>}>
          <div className="two">
            <div>
              <div className="big">{fmt(kcal, 0)}</div>
              <p className="muted">ккал · ориентир {fmt(g.kcalMin, 0)}–{fmt(g.kcalMax, 0)}</p>
            </div>
            <div>
              <div className="big">{fmt(protein, 0)} г</div>
              <p className="muted">белок · ориентир {g.proteinMin}–{g.proteinMax} г</p>
            </div>
          </div>
          <p className="muted small">{food.length ? `Записей сегодня: ${food.length}` : 'Сегодня записей ещё нет.'}</p>
        </Card>

        <Card title="Напоминания на сегодня" action={<button type="button" className="link" onClick={() => go('settings')}>Настроить</button>}>
          {dueReminders.length ? (
            <ul className="mini-list">
              {dueReminders.map((r) => (
                <li key={r.id}>
                  {REMINDER_LABELS[r.type].icon} {r.time} — {REMINDER_LABELS[r.type].title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Напоминаний на сегодня нет. Их можно включить в настройках.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
