import { useEffect, useState } from 'react';
import type { WorkoutLog, WorkoutType } from '../types';
import { useData } from '../store';
import { addDays, diffDays, formatDate, relativeDay, todayISO } from '../dates';
import { isLightPhase, nextWorkoutType, sessionsBetween, upcomingSessions, weekNumber } from '../schedule';
import { setMark } from '../actions';
import { Card, Empty, Notice } from '../components/ui';
import { DoctorNotice } from '../components/MedicalNotes';
import { FEELINGS, WorkoutForm } from '../components/WorkoutForm';
import type { Go } from '../App';

export function Workouts({ go, action, clearAction }: { go: Go; action?: string; clearAction: () => void }) {
  const data = useData();
  const s = data.settings;
  const today = todayISO();
  const [form, setForm] = useState<{ log?: WorkoutLog; date?: string; type?: WorkoutType } | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (action === 'log') {
      setForm({ date: today, type: nextWorkoutType(data) });
      clearAction();
    }
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [form]);

  if (form) {
    return (
      <div className="page">
        <header className="page-head">
          <button type="button" className="link start" onClick={() => setForm(null)}>
            ← Назад
          </button>
          <h1>{form.log ? 'Изменить тренировку' : 'Тренировка'}</h1>
        </header>
        <WorkoutForm initial={form.log} date={form.date} type={form.type} onDone={() => setForm(null)} />
      </div>
    );
  }

  const upcoming = upcomingSessions(data, 3).filter((x) => x.status !== 'done');
  const unmarked = sessionsBetween(data, addDays(today, -14), addDays(today, -1)).filter((x) => x.status === 'missed');
  const journal = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const shown = showAll ? journal : journal.slice(0, 5);
  const week = weekNumber(data);
  const untilStart = diffDays(s.startDate, today);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Тренировки</h1>
        <p className="muted">
          3 раза в неделю, всё тело, по очереди день A и день B
          {untilStart > 0 ? ` · старт ${formatDate(s.startDate)}` : ` · неделя ${week}`}
        </p>
      </header>

      <DoctorNotice />
      {untilStart <= 0 && isLightPhase(data) && (
        <Notice tone="info">
          <strong>Первые 2 недели — лёгкие веса.</strong> Оставляйте запас, не работайте до отказа.
        </Notice>
      )}

      <button type="button" className="btn btn-primary btn-big" onClick={() => setForm({ date: today, type: nextWorkoutType(data) })}>
        Записать тренировку (день {nextWorkoutType(data)})
      </button>

      {unmarked.length > 0 && (
        <Card title="Не отмечено">
          <ul className="list">
            {unmarked.map((sn) => (
              <li key={sn.date} className="list-item">
                <div className="list-main">
                  <span>{formatDate(sn.date, { weekday: true })}</span>
                  <div className="row-actions">
                    <button type="button" className="btn btn-small" onClick={() => setForm({ date: sn.date, type: nextWorkoutType(data) })}>
                      Записать
                    </button>
                    <button type="button" className="btn btn-small btn-ghost" onClick={() => setMark(sn.date, { status: 'skipped' })}>
                      Пропущена
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Дальше по плану" action={<button type="button" className="link" onClick={() => go('settings', 'plan')}>Изменить дни</button>}>
        {upcoming.length ? (
          <ul className="list">
            {upcoming.map((sn) => (
              <li key={sn.date} className="list-item">
                <div className="list-main">
                  <span>
                    <strong>День {sn.type}</strong> · {relativeDay(sn.date)}
                  </span>
                  {sn.movedFrom && <span className="muted small">перенесена</span>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Выберите дни тренировок в настройках.</p>
        )}
      </Card>

      <Card title="История">
        {journal.length ? (
          <>
            <ul className="list">
              {shown.map((w) => {
                const f = FEELINGS.find((x) => x.value === w.feeling);
                return (
                  <li key={w.id}>
                    <button type="button" className="history-row" onClick={() => setForm({ log: w })}>
                      <span>
                        <strong>День {w.type}</strong> · {formatDate(w.date, { weekday: true })}
                      </span>
                      <span title={f?.label}>
                        {w.symptoms ? '⚠️ ' : ''}
                        {f?.icon}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {journal.length > 5 && (
              <button type="button" className="link start" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Свернуть' : `Показать все (${journal.length})`}
              </button>
            )}
          </>
        ) : (
          <Empty icon="🏋️">Здесь появятся ваши тренировки.</Empty>
        )}
      </Card>
    </div>
  );
}
