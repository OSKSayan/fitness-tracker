import { useEffect, useState } from 'react';
import type { ExerciseTemplate, WorkoutLog, WorkoutType } from '../types';
import { update, useData } from '../store';
import { addDays, diffDays, formatDate, relativeDay, todayISO } from '../dates';
import { fmt, parseNum, wOut, wUnit } from '../units';
import { defaultPlan, uid } from '../defaults';
import { isLightPhase, nextWorkoutType, sessionsBetween, upcomingSessions, weekNumber, type Session } from '../schedule';
import { deleteWorkout, patchSettings, setMark } from '../actions';
import { Card, ConfirmDialog, DayPicker, Empty, Field, Modal, Notice } from '../components/ui';
import { DoctorNotice } from '../components/MedicalNotes';
import { FEELINGS, WorkoutForm } from '../components/WorkoutForm';

const STATUS: Record<Session['status'], string> = {
  planned: 'запланирована',
  done: 'выполнена',
  skipped: 'пропущена',
  moved: 'перенесена',
  missed: 'не отмечена',
};

export function Workouts({ action, clearAction }: { action?: string; clearAction: () => void }) {
  const data = useData();
  const s = data.settings;
  const today = todayISO();
  const [form, setForm] = useState<{ log?: WorkoutLog; date?: string; type?: WorkoutType } | null>(null);
  const [moveDate, setMoveDate] = useState<{ from: string; to: string; error?: string } | null>(null);
  const [toDelete, setToDelete] = useState<WorkoutLog | null>(null);
  const [tab, setTab] = useState<'schedule' | 'plan' | 'journal'>('schedule');

  useEffect(() => {
    if (action === 'log') {
      setForm({ date: today, type: nextWorkoutType(data) });
      clearAction();
    }
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = upcomingSessions(data, 4);
  const recent = sessionsBetween(data, addDays(today, -21), addDays(today, -1)).reverse();
  const week = weekNumber(data);
  const journal = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  const sessionActions = (sn: Session & { type?: WorkoutType }) => (
    <div className="row-actions start">
      {sn.status !== 'done' && (
        <button type="button" className="btn btn-small btn-primary" disabled={sn.date > today} onClick={() => setForm({ date: sn.date, type: sn.type ?? nextWorkoutType(data) })}>
          Выполнена
        </button>
      )}
      {sn.status === 'done' && sn.log && (
        <button type="button" className="btn btn-small" onClick={() => setForm({ log: sn.log })}>
          Открыть запись
        </button>
      )}
      {sn.status !== 'done' && sn.status !== 'skipped' && (
        <button type="button" className="btn btn-small" onClick={() => setMark(sn.date, { status: 'skipped' })}>
          Пропущена
        </button>
      )}
      {sn.status !== 'done' && (
        <button type="button" className="btn btn-small" onClick={() => setMoveDate({ from: sn.date, to: addDays(sn.date < today ? today : sn.date, 1) })}>
          Перенести
        </button>
      )}
      {(sn.status === 'skipped' || sn.status === 'moved') && (
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setMark(sn.date, null)}>
          Отменить отметку
        </button>
      )}
    </div>
  );

  return (
    <div className="page">
      <header className="page-head">
        <h1>Тренировки</h1>
        <p className="muted">3 тренировки в неделю, всё тело, чередование A и B</p>
      </header>

      <DoctorNotice />

      {week === 0 ? (
        <Notice tone="info">
          Старт занятий: <strong>{formatDate(s.startDate, { weekday: true })}</strong> (через {diffDays(s.startDate, today)} дн.). Дату можно изменить ниже.
        </Notice>
      ) : isLightPhase(data) ? (
        <Notice tone="info">
          <strong>Неделя {week}: режим лёгких весов.</strong> Первые две недели работайте с лёгкими весами, оставляйте запас и не доводите подходы
          до отказа.
        </Notice>
      ) : (
        <Notice tone="ok">
          Неделя {week}. Если прошлая тренировка прошла комфортно и техника сохранялась, приложение подскажет, где можно попробовать +2–5 кг. Решение
          всегда за вами.
        </Notice>
      )}

      <div className="tabs" role="tablist" aria-label="Разделы тренировок">
        {(
          [
            ['schedule', 'Расписание'],
            ['plan', 'План A / B'],
            ['journal', `Журнал (${data.workouts.length})`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'tab-on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'schedule' && (
        <>
          <Card title="Ближайшие тренировки" action={<button type="button" className="btn btn-small btn-primary" onClick={() => setForm({ date: today, type: nextWorkoutType(data) })}>+ Записать</button>}>
            {upcoming.length ? (
              <ul className="list">
                {upcoming.map((sn) => (
                  <li key={sn.date} className="list-item">
                    <div className="list-main">
                      <div>
                        <strong>День {sn.type}</strong> · {relativeDay(sn.date)}
                        {sn.movedFrom && <span className="muted small"> (перенесена с {formatDate(sn.movedFrom)})</span>}
                      </div>
                      <span className={`badge badge-${sn.status}`}>{STATUS[sn.status]}</span>
                    </div>
                    {sessionActions(sn)}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="📅">Нет запланированных тренировок. Выберите дни недели ниже.</Empty>
            )}
          </Card>

          <Card title="Последние три недели">
            {recent.length ? (
              <ul className="list">
                {recent.map((sn) => (
                  <li key={sn.date} className="list-item">
                    <div className="list-main">
                      <div>
                        {sn.log ? <strong>День {sn.log.type}</strong> : <strong>Тренировка</strong>} · {relativeDay(sn.date)}
                        {sn.movedTo && <span className="muted small"> → {formatDate(sn.movedTo)}</span>}
                      </div>
                      <span className={`badge badge-${sn.status}`}>{STATUS[sn.status]}</span>
                    </div>
                    {sn.status !== 'moved' && sessionActions(sn)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Здесь появятся прошедшие тренировки.</p>
            )}
          </Card>

          <Card title="Дни и старт">
            <Field label="Дата начала занятий" hint="Используется для подсчёта недель и режима лёгких весов">
              {(p) => (
                <input {...p} type="date" value={s.startDate} onChange={(e) => e.target.value && patchSettings({ startDate: e.target.value })} />
              )}
            </Field>
            <p className="label">Дни тренировок</p>
            <DayPicker label="Дни тренировок" value={s.workoutDays} onChange={(v) => patchSettings({ workoutDays: v })} />
            {s.workoutDays.length !== 3 && <p className="field-hint">По плану — 3 тренировки в неделю. Сейчас выбрано: {s.workoutDays.length}.</p>}
            {s.workoutDays.some((d) => s.workoutDays.includes((d + 1) % 7)) && (
              <p className="field-hint">Между тренировками всего тела лучше оставлять день отдыха.</p>
            )}
          </Card>
        </>
      )}

      {tab === 'plan' && <PlanEditor />}

      {tab === 'journal' && (
        <Card title="Журнал тренировок">
          {journal.length ? (
            <ul className="list">
              {journal.map((w) => (
                <li key={w.id} className="list-item">
                  <div className="list-main">
                    <div>
                      <strong>День {w.type}</strong> · {formatDate(w.date, { weekday: true })}
                    </div>
                    <span className="badge">{FEELINGS.find((f) => f.value === w.feeling)?.label}</span>
                  </div>
                  <ul className="mini-list">
                    {w.exercises.map((e, i) => (
                      <li key={i}>
                        {e.name}:{' '}
                        {e.sets
                          .map((x) =>
                            x.seconds != null ? `${x.seconds} с` : `${x.weight != null ? fmt(wOut(s, x.weight)) + ' ' + wUnit(s) + '×' : ''}${x.reps ?? '—'}`,
                          )
                          .join(', ') || '—'}
                      </li>
                    ))}
                    {w.cardioMinutes != null && (
                      <li>
                        Кардио: {w.cardioKind || 'лёгкое'}, {w.cardioMinutes} мин
                      </li>
                    )}
                  </ul>
                  {w.symptoms && <p className="field-error">Отмечены необычные симптомы</p>}
                  {w.note && <p className="note">{w.note}</p>}
                  <div className="row-actions start">
                    <button type="button" className="btn btn-small" onClick={() => setForm({ log: w })}>
                      Изменить
                    </button>
                    <button type="button" className="btn btn-small btn-ghost danger" onClick={() => setToDelete(w)}>
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="🏋️">Журнал пуст. Запишите первую тренировку — кнопка «+ Записать» на вкладке «Расписание».</Empty>
          )}
        </Card>
      )}

      <Modal open={!!form} title={form?.log ? 'Изменить тренировку' : 'Записать тренировку'} onClose={() => setForm(null)}>
        {form && <WorkoutForm initial={form.log} date={form.date} type={form.type} onDone={() => setForm(null)} />}
      </Modal>

      <Modal open={!!moveDate} title="Перенести тренировку" onClose={() => setMoveDate(null)}>
        {moveDate && (
          <div className="stack">
            <p>Тренировка {formatDate(moveDate.from, { weekday: true })} будет перенесена.</p>
            <Field label="Новая дата" error={moveDate.error}>
              {(p) => <input {...p} type="date" min={today} value={moveDate.to} onChange={(e) => setMoveDate({ ...moveDate, to: e.target.value, error: undefined })} />}
            </Field>
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => setMoveDate(null)}>
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!moveDate.to) return setMoveDate({ ...moveDate, error: 'Выберите дату' });
                  if (moveDate.to === moveDate.from) return setMoveDate({ ...moveDate, error: 'Выберите другую дату' });
                  if (moveDate.to < today) return setMoveDate({ ...moveDate, error: 'Дата не может быть в прошлом' });
                  setMark(moveDate.from, { status: 'moved', movedTo: moveDate.to });
                  setMoveDate(null);
                }}
              >
                Перенести
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Удалить тренировку?"
        text={toDelete ? `Запись за ${formatDate(toDelete.date)} (день ${toDelete.type}) будет удалена без возможности восстановления.` : ''}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteWorkout(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}

function PlanEditor() {
  const data = useData();
  const [day, setDay] = useState<WorkoutType>('A');
  const [confirmReset, setConfirmReset] = useState(false);
  const list = data.plan[day];

  const setList = (fn: (l: ExerciseTemplate[]) => ExerciseTemplate[]) => update((d) => ({ ...d, plan: { ...d.plan, [day]: fn(d.plan[day]) } }));
  const patch = (id: string, p: Partial<ExerciseTemplate>) => setList((l) => l.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const num = (raw: string, min: number, max: number, cur: number) => {
    const r = parseNum(raw, { min, max, integer: true });
    return r.value ?? cur;
  };
  const move = (i: number, dir: -1 | 1) =>
    setList((l) => {
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const c = [...l];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  return (
    <Card
      title="План тренировок"
      action={
        <div className="seg" role="tablist" aria-label="День плана">
          {(['A', 'B'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={day === t} className={`seg-btn ${day === t ? 'seg-on' : ''}`} onClick={() => setDay(t)}>
              День {t}
            </button>
          ))}
        </div>
      }
    >
      <p className="muted small">По умолчанию: 3 подхода по 8–12 повторений, планка — подходы по времени. Изменения применяются к новым записям.</p>
      {list.length === 0 && <Empty icon="📋">В этом дне нет упражнений.</Empty>}
      <ol className="plan-list">
        {list.map((e, i) => (
          <li key={e.id} className="plan-item">
            <Field label={`Упражнение ${i + 1}`}>
              {(p) => <input {...p} value={e.name} onChange={(ev) => patch(e.id, { name: ev.target.value })} />}
            </Field>
            <div className="plan-grid">
              <Field label="Тип">
                {(p) => (
                  <select {...p} value={e.kind} onChange={(ev) => patch(e.id, { kind: ev.target.value as ExerciseTemplate['kind'], seconds: e.seconds || 30, repsMin: e.repsMin || 8, repsMax: e.repsMax || 12 })}>
                    <option value="reps">Повторы</option>
                    <option value="time">Время</option>
                  </select>
                )}
              </Field>
              <Field label="Подходы">
                {(p) => <input {...p} type="number" min={1} max={10} value={e.sets} onChange={(ev) => patch(e.id, { sets: num(ev.target.value, 1, 10, e.sets) })} />}
              </Field>
              {e.kind === 'reps' ? (
                <>
                  <Field label="Повт. от">
                    {(p) => <input {...p} type="number" min={1} max={50} value={e.repsMin} onChange={(ev) => patch(e.id, { repsMin: num(ev.target.value, 1, 50, e.repsMin) })} />}
                  </Field>
                  <Field label="Повт. до">
                    {(p) => <input {...p} type="number" min={1} max={50} value={e.repsMax} onChange={(ev) => patch(e.id, { repsMax: num(ev.target.value, 1, 50, e.repsMax) })} />}
                  </Field>
                </>
              ) : (
                <Field label="Секунды">
                  {(p) => <input {...p} type="number" min={5} max={600} value={e.seconds} onChange={(ev) => patch(e.id, { seconds: num(ev.target.value, 5, 600, e.seconds) })} />}
                </Field>
              )}
            </div>
            {e.kind === 'reps' && e.repsMin > e.repsMax && <p className="field-error">«Повт. от» больше, чем «до»</p>}
            <div className="row-actions start">
              <button type="button" className="btn btn-small btn-ghost" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" className="btn btn-small btn-ghost" aria-label="Ниже" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                ↓
              </button>
              <button type="button" className="btn btn-small btn-ghost danger" onClick={() => setList((l) => l.filter((x) => x.id !== e.id))}>
                Убрать
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="row-actions start">
        <button
          type="button"
          className="btn"
          onClick={() => setList((l) => [...l, { id: uid(), name: 'Новое упражнение', kind: 'reps', sets: 3, repsMin: 8, repsMax: 12, seconds: 0 }])}
        >
          + Упражнение
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)}>
          Вернуть план по умолчанию
        </button>
      </div>
      <ConfirmDialog
        open={confirmReset}
        title="Вернуть план по умолчанию?"
        text="Упражнения дней A и B будут заменены исходным планом. Журнал тренировок не изменится."
        confirmLabel="Вернуть"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          update((d) => ({ ...d, plan: defaultPlan() }));
          setConfirmReset(false);
        }}
      />
    </Card>
  );
}
