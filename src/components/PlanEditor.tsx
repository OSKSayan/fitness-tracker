import { useState } from 'react';
import type { ExerciseTemplate, WorkoutType } from '../types';
import { update, useData } from '../store';
import { parseNum } from '../units';
import { defaultPlan, uid } from '../defaults';
import { Field } from './ui';

export function PlanEditor() {
  const data = useData();
  const [day, setDay] = useState<WorkoutType>('A');
  const list = data.plan[day];

  const setList = (fn: (l: ExerciseTemplate[]) => ExerciseTemplate[]) => update((d) => ({ ...d, plan: { ...d.plan, [day]: fn(d.plan[day]) } }));
  const patch = (id: string, p: Partial<ExerciseTemplate>) => setList((l) => l.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const num = (raw: string, min: number, max: number, cur: number) => parseNum(raw, { min, max, integer: true }).value ?? cur;

  return (
    <div className="stack">
      <div className="seg" role="tablist" aria-label="День плана">
        {(['A', 'B'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={day === t} className={`seg-btn ${day === t ? 'seg-on' : ''}`} onClick={() => setDay(t)}>
            День {t}
          </button>
        ))}
      </div>
      <ol className="plan-list">
        {list.map((e, i) => (
          <li key={e.id} className="plan-item">
            <Field label={`Упражнение ${i + 1}`}>{(p) => <input {...p} value={e.name} onChange={(ev) => patch(e.id, { name: ev.target.value })} />}</Field>
            <div className="plan-grid">
              <Field label="Подходы">
                {(p) => <input {...p} type="number" min={1} max={10} value={e.sets} onChange={(ev) => patch(e.id, { sets: num(ev.target.value, 1, 10, e.sets) })} />}
              </Field>
              {e.kind === 'reps' ? (
                <>
                  <Field label="Повт. от">
                    {(p) => <input {...p} type="number" min={1} max={50} value={e.repsMin} onChange={(ev) => patch(e.id, { repsMin: num(ev.target.value, 1, 50, e.repsMin) })} />}
                  </Field>
                  <Field label="до">
                    {(p) => <input {...p} type="number" min={1} max={50} value={e.repsMax} onChange={(ev) => patch(e.id, { repsMax: num(ev.target.value, 1, 50, e.repsMax) })} />}
                  </Field>
                </>
              ) : (
                <Field label="Секунды">
                  {(p) => <input {...p} type="number" min={5} max={600} value={e.seconds} onChange={(ev) => patch(e.id, { seconds: num(ev.target.value, 5, 600, e.seconds) })} />}
                </Field>
              )}
            </div>
            <button
              type="button"
              className="link muted-link start"
              onClick={() => window.confirm(`Убрать «${e.name}» из плана?`) && setList((l) => l.filter((x) => x.id !== e.id))}
            >
              Убрать из плана
            </button>
          </li>
        ))}
      </ol>
      <div className="row-actions start">
        <button type="button" className="btn" onClick={() => setList((l) => [...l, { id: uid(), name: 'Новое упражнение', kind: 'reps', sets: 3, repsMin: 8, repsMax: 12, seconds: 0 }])}>
          + Упражнение
        </button>
        <button
          type="button"
          className="link muted-link"
          onClick={() => window.confirm('Вернуть исходный план A и B? Журнал не изменится.') && update((d) => ({ ...d, plan: defaultPlan() }))}
        >
          Вернуть план по умолчанию
        </button>
      </div>
    </div>
  );
}
