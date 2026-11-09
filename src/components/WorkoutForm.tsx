import { useMemo, useState } from 'react';
import type { ExerciseKind, ExerciseTemplate, Feeling, SetEntry, WorkoutLog, WorkoutType } from '../types';
import { useData } from '../store';
import { formatDate, todayISO } from '../dates';
import { uid } from '../defaults';
import { fmt, parseNum, wIn, wOut, wUnit } from '../units';
import { isLightPhase, lastExerciseLog, progressionHint } from '../schedule';
import { deleteWorkout, saveWorkout } from '../actions';
import { Field, Notice } from './ui';
import { SymptomsNotice } from './MedicalNotes';

interface DraftSet {
  weight: string;
  reps: string;
  seconds: string;
}
interface DraftEx {
  key: string;
  templateId: string | null;
  name: string;
  kind: ExerciseKind;
  sets: DraftSet[];
  prev: SetEntry[] | null;
}

export const FEELINGS: { value: Feeling; label: string; icon: string }[] = [
  { value: 'great', label: 'Отлично', icon: '😄' },
  { value: 'good', label: 'Хорошо', icon: '🙂' },
  { value: 'ok', label: 'Нормально', icon: '😐' },
  { value: 'hard', label: 'Тяжело', icon: '😓' },
  { value: 'bad', label: 'Плохо', icon: '🤒' },
];

const emptySet = (): DraftSet => ({ weight: '', reps: '', seconds: '' });

export function WorkoutForm({
  initial,
  type: initialType,
  date: initialDate,
  onDone,
}: {
  initial?: WorkoutLog | null;
  type?: WorkoutType;
  date?: string;
  onDone: () => void;
}) {
  const data = useData();
  const s = data.settings;
  const [date, setDate] = useState(initial?.date ?? initialDate ?? todayISO());
  const [type, setType] = useState<WorkoutType>(initial?.type ?? initialType ?? 'A');
  const [showDate, setShowDate] = useState(false);

  const toStr = (x: SetEntry): DraftSet => ({
    weight: x.weight != null ? String(+wOut(s, x.weight).toFixed(1)) : '',
    reps: x.reps != null ? String(x.reps) : '',
    seconds: x.seconds != null ? String(x.seconds) : '',
  });

  const fromTemplate = (t: WorkoutType, d: string): DraftEx[] =>
    data.plan[t].map((e) => ({
      key: uid(),
      templateId: e.id,
      name: e.name,
      kind: e.kind,
      sets: Array.from({ length: Math.max(1, e.sets) }, emptySet),
      prev: lastExerciseLog(data, e, d)?.exercise.sets ?? null,
    }));

  const [exercises, setExercises] = useState<DraftEx[]>(() =>
    initial
      ? initial.exercises.map((e) => ({ key: uid(), templateId: e.templateId, name: e.name, kind: e.kind, sets: e.sets.map(toStr), prev: null }))
      : fromTemplate(initialType ?? 'A', initialDate ?? todayISO()),
  );
  const [feeling, setFeeling] = useState<Feeling>(initial?.feeling ?? 'good');
  const [allGood, setAllGood] = useState(initial ? initial.comfortable && initial.techniqueOk : true);
  const [symptoms, setSymptoms] = useState(initial?.symptoms ?? false);
  const [cardioOn, setCardioOn] = useState(initial ? initial.cardioMinutes != null : false);
  const [cardioMin, setCardioMin] = useState(initial?.cardioMinutes != null ? String(initial.cardioMinutes) : '15');
  const [note, setNote] = useState(initial?.note ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const templates = useMemo(() => {
    const m = new Map<string, ExerciseTemplate>();
    [...data.plan.A, ...data.plan.B].forEach((t) => m.set(t.id, t));
    return m;
  }, [data.plan]);

  const patchEx = (key: string, fn: (e: DraftEx) => DraftEx) => setExercises((xs) => xs.map((e) => (e.key === key ? fn(e) : e)));
  const patchSet = (key: string, i: number, p: Partial<DraftSet>) =>
    patchEx(key, (q) => ({ ...q, sets: q.sets.map((y, j) => (j === i ? { ...y, ...p } : y)) }));

  const submit = () => {
    const errs: string[] = [];
    if (date > todayISO()) errs.push('Нельзя записать тренировку на будущую дату');
    const exs = exercises
      .filter((e) => e.name.trim())
      .map((e) => ({
        templateId: e.templateId,
        name: e.name.trim(),
        kind: e.kind,
        sets: e.sets
          .map((x, i) => {
            const label = `${e.name}, подход ${i + 1}`;
            const w = parseNum(x.weight, { min: 0, max: 1000, label: `${label}, вес` });
            const r = parseNum(x.reps, { min: 0, max: 200, integer: true, label: `${label}, повторы` });
            const sec = parseNum(x.seconds, { min: 0, max: 3600, integer: true, label: `${label}, секунды` });
            [w, r, sec].forEach((p) => p.error && errs.push(p.error));
            return { weight: w.value != null ? wIn(s, w.value) : null, reps: r.value, seconds: sec.value };
          })
          .filter((x) => x.weight != null || x.reps != null || x.seconds != null),
      }))
      .filter((e) => e.sets.length > 0);
    if (!exs.length && !errs.length) errs.push('Заполните хотя бы один подход');
    let cardio: number | null = null;
    if (cardioOn) {
      const c = parseNum(cardioMin, { min: 1, max: 300, integer: true, label: 'Кардио, минуты' });
      if (c.error) errs.push(c.error);
      cardio = c.value ?? 15;
    }
    setErrors(errs);
    if (errs.length) return;
    saveWorkout(
      {
        id: initial?.id ?? uid(),
        date,
        type,
        exercises: exs,
        feeling,
        comfortable: allGood,
        techniqueOk: allGood,
        symptoms,
        cardioMinutes: cardio,
        cardioKind: cardioOn ? initial?.cardioKind || 'Ходьба' : '',
        note: note.trim(),
        createdAt: initial?.createdAt ?? Date.now(),
      },
      initial?.date,
    );
    if (symptoms || feeling === 'bad') setSaved(true);
    else onDone();
  };

  if (saved) {
    return (
      <div className="stack">
        <Notice tone="ok">Тренировка сохранена.</Notice>
        <SymptomsNotice />
        <button type="button" className="btn btn-primary" onClick={onDone}>
          Понятно
        </button>
      </div>
    );
  }

  const light = isLightPhase(data, date);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <div className="workout-top">
        <div className="seg" role="radiogroup" aria-label="День тренировки">
          {(['A', 'B'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              className={`seg-btn ${type === t ? 'seg-on' : ''}`}
              onClick={() => {
                setType(t);
                if (!initial) setExercises(fromTemplate(t, date));
              }}
            >
              День {t}
            </button>
          ))}
        </div>
        {showDate ? (
          <label className="inline-select">
            <span className="sr-only">Дата</span>
            <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
        ) : (
          <button type="button" className="link" onClick={() => setShowDate(true)}>
            {date === todayISO() ? 'сегодня' : formatDate(date)} ✎
          </button>
        )}
      </div>

      {light && (
        <Notice tone="info">
          <strong>Первые 2 недели — лёгкие веса.</strong> Оставляйте запас 2–3 повтора, не работайте до отказа.
        </Notice>
      )}

      {exercises.map((e, ei) => {
        const tpl = e.templateId ? templates.get(e.templateId) : undefined;
        const hint = tpl && !light ? progressionHint(data, tpl, date) : null;
        const goal = tpl ? (tpl.kind === 'time' ? `${tpl.sets} × ${tpl.seconds} сек` : `${tpl.sets} × ${tpl.repsMin}–${tpl.repsMax}`) : '';
        return (
          <fieldset key={e.key} className="exercise">
            <legend className="sr-only">{e.name || `Упражнение ${ei + 1}`}</legend>
            <div className="exercise-head">
              {tpl ? (
                <div className="exercise-title">
                  <strong>{e.name}</strong>
                  <span className="muted small">{goal}</span>
                </div>
              ) : (
                <Field label="Упражнение">
                  {(p) => <input {...p} value={e.name} placeholder="Название" onChange={(ev) => patchEx(e.key, (x) => ({ ...x, name: ev.target.value }))} />}
                </Field>
              )}
              {e.prev && (
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  onClick={() => patchEx(e.key, (q) => ({ ...q, sets: e.prev!.map(toStr) }))}
                >
                  как в прошлый раз
                </button>
              )}
            </div>
            {hint && <p className="hint-chip">💡 {hint}</p>}
            <div className="sets">
              {e.sets.map((x, si) => {
                const pv = e.prev?.[si];
                return (
                  <div key={si} className="set-row">
                    <span className="set-num" aria-hidden>
                      {si + 1}
                    </span>
                    {e.kind === 'reps' ? (
                      <>
                        <label className="set-field">
                          <span className="sr-only">
                            {e.name}, подход {si + 1}, вес
                          </span>
                          <input
                            inputMode="decimal"
                            placeholder={pv?.weight != null ? fmt(wOut(s, pv.weight)) : wUnit(s)}
                            value={x.weight}
                            onChange={(ev) => patchSet(e.key, si, { weight: ev.target.value })}
                          />
                        </label>
                        <span className="muted" aria-hidden>
                          {wUnit(s)} ×
                        </span>
                        <label className="set-field">
                          <span className="sr-only">
                            {e.name}, подход {si + 1}, повторы
                          </span>
                          <input
                            inputMode="numeric"
                            placeholder={pv?.reps != null ? String(pv.reps) : 'повт.'}
                            value={x.reps}
                            onChange={(ev) => patchSet(e.key, si, { reps: ev.target.value })}
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="set-field">
                          <span className="sr-only">
                            {e.name}, подход {si + 1}, секунды
                          </span>
                          <input
                            inputMode="numeric"
                            placeholder={pv?.seconds != null ? String(pv.seconds) : 'сек'}
                            value={x.seconds}
                            onChange={(ev) => patchSet(e.key, si, { seconds: ev.target.value })}
                          />
                        </label>
                        <span className="muted" aria-hidden>
                          сек
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="row-actions start">
              <button type="button" className="link" onClick={() => patchEx(e.key, (q) => ({ ...q, sets: [...q.sets, emptySet()] }))}>
                + подход
              </button>
              {e.sets.length > 1 && (
                <button type="button" className="link muted-link" onClick={() => patchEx(e.key, (q) => ({ ...q, sets: q.sets.slice(0, -1) }))}>
                  − подход
                </button>
              )}
            </div>
          </fieldset>
        );
      })}

      <button
        type="button"
        className="link start"
        onClick={() => setExercises((xs) => [...xs, { key: uid(), templateId: null, name: '', kind: 'reps', sets: [emptySet(), emptySet(), emptySet()], prev: null }])}
      >
        + другое упражнение
      </button>

      <fieldset className="exercise">
        <legend>Как самочувствие?</legend>
        <div className="feelings" role="radiogroup" aria-label="Самочувствие">
          {FEELINGS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={feeling === f.value}
              className={`feeling ${feeling === f.value ? 'feeling-on' : ''}`}
              onClick={() => setFeeling(f.value)}
            >
              <span aria-hidden>{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={allGood} onChange={(e) => setAllGood(e.target.checked)} />
          Нагрузка комфортная, техника в порядке
        </label>
        <div className="check-row">
          <label className="check">
            <input type="checkbox" checked={cardioOn} onChange={(e) => setCardioOn(e.target.checked)} />
            После — ходьба / лёгкое кардио
          </label>
          {cardioOn && (
            <>
              <input className="mini-input" aria-label="Минуты кардио" inputMode="numeric" value={cardioMin} onChange={(e) => setCardioMin(e.target.value)} />
              <span className="muted">мин</span>
            </>
          )}
        </div>
        <label className="check">
          <input type="checkbox" checked={symptoms} onChange={(e) => setSymptoms(e.target.checked)} />
          Были необычные симптомы или стало хуже
        </label>
        {(symptoms || feeling === 'bad') && <SymptomsNotice />}
      </fieldset>

      <Field label="Заметка (необязательно)">
        {(p) => <textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>

      {errors.length > 0 && (
        <Notice tone="danger">
          <strong>Проверьте данные:</strong>
          <ul>
            {errors.slice(0, 6).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="row-actions sticky-actions">
        {initial && (
          <button
            type="button"
            className="btn btn-ghost danger"
            onClick={() => {
              if (window.confirm(`Удалить тренировку за ${formatDate(initial.date)}?`)) {
                deleteWorkout(initial.id);
                onDone();
              }
            }}
          >
            Удалить
          </button>
        )}
        <span className="spacer" />
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
