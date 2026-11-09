import { useState } from 'react';
import type { FoodEntry, Portion } from '../types';
import { nowTime } from '../dates';
import { parseNum } from '../units';
import { uid } from '../defaults';
import { deleteFood, saveFood } from '../actions';
import { Field } from './ui';

const PORTIONS: { value: Portion; label: string }[] = [
  { value: 'small', label: 'Мало' },
  { value: 'normal', label: 'Обычно' },
  { value: 'large', label: 'Много' },
];

/** Быстрые варианты — примерные значения, их можно поправить. */
export const QUICK_FOOD: { name: string; kcal: number; protein: number }[] = [
  { name: 'Яйца, 2 шт.', kcal: 150, protein: 13 },
  { name: 'Творог, 200 г', kcal: 250, protein: 34 },
  { name: 'Кефир, 250 мл', kcal: 130, protein: 8 },
  { name: 'Куриная грудка, 150 г', kcal: 250, protein: 45 },
  { name: 'Тунец, банка', kcal: 150, protein: 30 },
];

export function newFood(date: string): FoodEntry {
  return { id: uid(), date, time: nowTime(), name: '', portion: 'normal', kcal: null, protein: null, note: '' };
}

export function FoodForm({ entry, isNew, onDone }: { entry: FoodEntry; isNew: boolean; onDone: () => void }) {
  const [name, setName] = useState(entry.name);
  const [portion, setPortion] = useState<Portion>(entry.portion || 'normal');
  const [kcal, setKcal] = useState(entry.kcal != null ? String(entry.kcal) : '');
  const [protein, setProtein] = useState(entry.protein != null ? String(entry.protein) : '');
  const [err, setErr] = useState<Record<string, string>>({});

  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Напишите, что вы съели или выпили';
    const k = parseNum(kcal, { min: 0, max: 5000 });
    const p = parseNum(protein, { min: 0, max: 300 });
    if (k.error) e.kcal = k.error;
    if (p.error) e.protein = p.error;
    setErr(e);
    if (Object.keys(e).length) return;
    saveFood({ ...entry, name: name.trim(), portion, kcal: k.value, protein: p.value });
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
      <Field label="Что съели или выпили" error={err.name}>
        {(p) => <input {...p} value={name} autoFocus={isNew} onChange={(e) => setName(e.target.value)} placeholder="например, гречка с курицей" />}
      </Field>
      <div>
        <p className="label">Порция</p>
        <div className="chips" role="radiogroup" aria-label="Порция">
          {PORTIONS.map((x) => (
            <button key={x.value} type="button" role="radio" aria-checked={portion === x.value} className={`chip ${portion === x.value ? 'chip-on' : ''}`} onClick={() => setPortion(x.value)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="two">
        <Field label="Ккал" hint="если знаете" error={err.kcal}>
          {(p) => <input {...p} inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} />}
        </Field>
        <Field label="Белок, г" hint="если знаете" error={err.protein}>
          {(p) => <input {...p} inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />}
        </Field>
      </div>
      <div className="row-actions">
        {!isNew && (
          <button
            type="button"
            className="btn btn-ghost danger"
            onClick={() => {
              if (window.confirm(`Удалить «${entry.name}»?`)) {
                deleteFood(entry.id);
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
