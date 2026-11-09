import { useMemo, useState } from 'react';
import type { ExerciseKind, ExerciseTemplate, Feeling, WorkoutLog, WorkoutType } from '../types';
import { useData } from '../store';
import { todayISO } from '../dates';
import { uid } from '../defaults';
import { fmt, parseNum, wIn, wOut, wUnit } from '../units';
import { isLightPhase, lastExerciseLog, progressionHint } from '../schedule';
import { saveWorkout } from '../actions';
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
}

export const FEELINGS: { value: Feeling; label: string }[] = [
  { value: 'great', label: 'Отлично' },
  { value: 'good', label: 'Хорошо' },
  { value: 'ok', label: 'Нормально' },
  { value: 'hard', label: 'Тяжело' },
  { value: 'bad', label: 'Плохо' },
];

const emptySet = (): DraftSet => ({ weight: '', reps: '', seconds: '' });

export function WorkoutForm({
  initial,
  date: initialDate,
  type: initialType,
  onDone,
}: {
  initial?: WorkoutLog | null;
  date?: string;
  type?: WorkoutType;
  onDone: () => void;
}) {
  const data = useData();
  const s = data.settings;
  const [date, setDate] = useState(initial?.date ?? initialDate ?? todayISO());
  const [type, setType] = useState<WorkoutType>(initial?.type ?? initialType ?? 'A');

  const fromTemplate = (t: WorkoutType): DraftEx[] =>
    data.plan[t].map((e) => ({
      key: uid(),
      templateId: e.id,
      name: e.name,
      kind: e.kind,
      sets: Array.from({ length: Math.max(1, e.sets) }, emptySet),
    }));

  const [exercises, setExercises] = useState<DraftEx[]>(() =>
    initial
      ? initial.exercises.map((e) => ({
          key: uid(),
          templateId: e.templateId,
          name: e.name,
          kind: e.kind,
          sets: e.sets.map((x) => ({
            weight: x.weight != null ? String(+wOut(s, x.weight).toFixed(1)) : '',
            reps: x.reps != null ? String(x.reps) : '',
            seconds: x.seconds != null ? String(x.seconds) : '',
          })),
        }))
      : fromTemplate(initialType ?? 'A'),
  );
  const [feeling, setFeeling] = useState<Feeling>(initial?.feeling ?? 'good');
  const [comfortable, setComfortable] = useState(initial?.comfortable ?? true);
  const [techniqueOk, setTechniqueOk] = useState(initial?.techniqueOk ?? true);
  const [symptoms, setSymptoms] = useState(initial?.symptoms ?? false);
  const [cardioOn, setCardioOn] = useState(initial ? initial.cardioMinutes != null : false);
  const [cardioMin, setCardioMin] = useState(initial?.cardioMinutes != null ? String(initial.cardioMinutes) : '15');
  const [cardioKind, setCardioKind] = useState(initial?.cardioKind || 'Ходьба');
  const [note, setNote] = useState(initial?.note ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const templates = useMemo(() => {
    const m = new Map<string, ExerciseTemplate>();
    [...data.plan.A, ...data.plan.B].forEach((t) => m.set(t.id, t));
    return m;
  }, [data.plan]);

  const changeType = (t: WorkoutType) => {
    setType(t);
    if (!initial) setExercises(fromTemplate(t));
  };

  const patchEx = (key: string, fn: (e: DraftEx) => DraftEx) => setExercises((xs) => xs.map((e) => (e.key === key ? fn(e) : e)));

  const submit = () => {
    const errs: string[] = [];
    if (!date) errs.push('Укажите дату');
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
    if (!exs.length) errs.push('Заполните хотя бы один подход');
    let cardio: number | null = null;
    if (cardioOn) {
      const c = parseNum(cardioMin, { min: 1, max: 300, integer: true, label: 'Кардио, минуты' });
      if (c.error) errs.push(c.error);
      else if (c.value == null) errs.push('Укажите минуты кардио или снимите отметку');
      cardio = c.value;
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
        comfortable,
        techniqueOk,
        symptoms,
        cardioMinutes: cardio,
        cardioKind: cardioOn ? cardioKind : '',
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
      <div className="two">
        <Field label="Дата">
          {(p) => <input {...p} type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />}
        </Field>
        <Field label="Тренировка" hint={initial ? undefined : 'Смена дня подставит упражнения из плана'}>
          {(p) => (
            <select {...p} value={type} onChange={(e) => changeType(e.target.value as WorkoutType)}>
              <option value="A">День A</option>
              <option value="B">День B</option>
            </select>
          )}
        </Field>
      </div>

      {light ? (
        <Notice tone="info">
          <strong>Режим лёгких весов (первые две недели).</strong> Оставляйте запас 2–3 повтора, не работайте до отказа. Главное — техника и
          самочувствие.
        </Notice>
      ) : null}

      {exercises.map((e, ei) => {
        const tpl = e.templateId ? templates.get(e.templateId) : undefined;
        const prev = tpl ? lastExerciseLog(data, tpl, date) : null;
        const hint = tpl ? progressionHint(data, tpl, date) : null;
        return (
          <fieldset key={e.key} className="exercise">
            <legend className="sr-only">Упражнение {ei + 1}</legend>
            <div className="exercise-head">
              <Field label={`Упражнение ${ei + 1}`}>
                {(p) => <input {...p} value={e.name} onChange={(ev) => patchEx(e.key, (x) => ({ ...x, name: ev.target.value }))} />}
              </Field>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Убрать упражнение ${e.name}`}
                onClick={() => setExercises((xs) => xs.filter((x) => x.key !== e.key))}
              >
                🗑
              </button>
            </div>
            {tpl && (
              <p className="muted small">
                План: {tpl.sets} × {tpl.kind === 'time' ? `${tpl.seconds} сек` : `${tpl.repsMin}–${tpl.repsMax}`}
                {prev && (
                  <>
                    {' · '}прошлый раз:{' '}
                    {prev.exercise.sets
                      .map((x) =>
                        x.seconds != null
                          ? `${x.seconds} с`
                          : `${x.weight != null ? fmt(wOut(s, x.weight)) + ' ' + wUnit(s) + ' × ' : ''}${x.reps ?? '—'}`,
                      )
                      .join(', ')}
                  </>
                )}
              </p>
            )}
            {hint && !light && <p className="hint-chip">💡 {hint}</p>}
            <div className="sets">
              {e.sets.map((x, si) => (
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
                          placeholder={wUnit(s)}
                          value={x.weight}
                          onChange={(ev) =>
                            patchEx(e.key, (q) => ({ ...q, sets: q.sets.map((y, j) => (j === si ? { ...y, weight: ev.target.value } : y)) }))
                          }
                        />
                      </label>
                      <span aria-hidden>×</span>
                      <label className="set-field">
                        <span className="sr-only">
                          {e.name}, подход {si + 1}, повторы
                        </span>
                        <input
                          inputMode="numeric"
                          placeholder="повт."
                          value={x.reps}
                          onChange={(ev) =>
                            patchEx(e.key, (q) => ({ ...q, sets: q.sets.map((y, j) => (j === si ? { ...y, reps: ev.target.value } : y)) }))
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <label className="set-field">
                      <span className="sr-only">
                        {e.name}, подход {si + 1}, секунды
                      </span>
                      <input
                        inputMode="numeric"
                        placeholder="сек"
                        value={x.seconds}
                        onChange={(ev) =>
                          patchEx(e.key, (q) => ({ ...q, sets: q.sets.map((y, j) => (j === si ? { ...y, seconds: ev.target.value } : y)) }))
                        }
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    className="icon-btn small"
                    aria-label={`Убрать подход ${si + 1}`}
                    disabled={e.sets.length <= 1}
                    onClick={() => patchEx(e.key, (q) => ({ ...q, sets: q.sets.filter((_, j) => j !== si) }))}
                  >
                    −
                  </button>
                </div>
              ))}
            </div>
            <div className="row-actions start">
              <button type="button" className="btn btn-small btn-ghost" onClick={() => patchEx(e.key, (q) => ({ ...q, sets: [...q.sets, emptySet()] }))}>
                + подход
              </button>
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => patchEx(e.key, (q) => ({ ...q, kind: q.kind === 'reps' ? 'time' : 'reps' }))}
              >
                {e.kind === 'reps' ? 'по времени' : 'по повторам'}
              </button>
            </div>
          </fieldset>
        );
      })}

      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setExercises((xs) => [...xs, { key: uid(), templateId: null, name: '', kind: 'reps', sets: [emptySet(), emptySet(), emptySet()] }])}
      >
        + Добавить упражнение
      </button>

      <fieldset className="exercise">
        <legend>Кардио после тренировки (необязательно)</legend>
        <label className="check">
          <input type="checkbox" checked={cardioOn} onChange={(e) => setCardioOn(e.target.checked)} />
          Было кардио — 15–20 минут ходьбы или лёгкого кардио
        </label>
        {cardioOn && (
          <div className="two">
            <Field label="Минуты">{(p) => <input {...p} inputMode="numeric" value={cardioMin} onChange={(e) => setCardioMin(e.target.value)} />}</Field>
            <Field label="Вид">{(p) => <input {...p} value={cardioKind} onChange={(e) => setCardioKind(e.target.value)} />}</Field>
          </div>
        )}
      </fieldset>

      <fieldset className="exercise">
        <legend>Самочувствие</legend>
        <div className="chips" role="radiogroup" aria-label="Самочувствие">
          {FEELINGS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={feeling === f.value}
              className={`chip ${feeling === f.value ? 'chip-on' : ''}`}
              onClick={() => setFeeling(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={comfortable} onChange={(e) => setComfortable(e.target.checked)} />
          Нагрузка была комфортной
        </label>
        <label className="check">
          <input type="checkbox" checked={techniqueOk} onChange={(e) => setTechniqueOk(e.target.checked)} />
          Техника сохранялась во всех подходах
        </label>
        <label className="check">
          <input type="checkbox" checked={symptoms} onChange={(e) => setSymptoms(e.target.checked)} />
          Были необычные симптомы или ухудшение самочувствия
        </label>
        {(symptoms || feeling === 'bad') && <SymptomsNotice />}
      </fieldset>

      <Field label="Заметка">
        {(p) => <textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Как прошло, что заметили" />}
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
        <button type="button" className="btn" onClick={onDone}>
          Отмена
        </button>
        <button type="submit" className="btn btn-primary">
          Сохранить тренировку
        </button>
      </div>
    </form>
  );
}
