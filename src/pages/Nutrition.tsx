import { useEffect, useState } from 'react';
import type { FoodEntry, Portion } from '../types';
import { useData } from '../store';
import { addDays, nowTime, relativeDay, todayISO } from '../dates';
import { fmt, parseNum } from '../units';
import { uid } from '../defaults';
import { addWater, deleteFood, saveFood } from '../actions';
import { Card, ConfirmDialog, Empty, Field, Modal, Notice, Progress } from '../components/ui';

const PORTIONS: { value: Portion; label: string }[] = [
  { value: '', label: 'Не указано' },
  { value: 'small', label: 'Небольшая порция' },
  { value: 'normal', label: 'Обычная порция' },
  { value: 'large', label: 'Большая порция' },
];

/** Быстрые варианты — примерные значения, их можно поправить. */
const QUICK: { name: string; kcal: number; protein: number }[] = [
  { name: 'Яйца, 2 шт.', kcal: 150, protein: 13 },
  { name: 'Творог, 200 г', kcal: 250, protein: 34 },
  { name: 'Кефир, 250 мл', kcal: 130, protein: 8 },
  { name: 'Куриная грудка, 150 г', kcal: 250, protein: 45 },
  { name: 'Тунец, банка', kcal: 150, protein: 30 },
];

const HABITS = [
  'Гарнир — примерно вдвое меньше обычной порции',
  'Обходиться без добавки',
  'Чаще выбирать источник белка: яйца, творог, кефир, куриную грудку или тунец',
  'Сладкие напитки — лучше заменить водой; сладкое — примерно 1–2 раза в неделю',
];

export function Nutrition({ action, clearAction }: { action?: string; clearAction: () => void }) {
  const data = useData();
  const g = data.settings.goals;
  const [date, setDate] = useState(todayISO());
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [toDelete, setToDelete] = useState<FoodEntry | null>(null);
  const [customWater, setCustomWater] = useState('');
  const [waterErr, setWaterErr] = useState<string>();

  useEffect(() => {
    if (action === 'add') {
      setEditing(newEntry(todayISO()));
      clearAction();
    }
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = data.food.filter((f) => f.date === date).sort((a, b) => a.time.localeCompare(b.time));
  const kcal = items.reduce((s, f) => s + (f.kcal ?? 0), 0);
  const protein = items.reduce((s, f) => s + (f.protein ?? 0), 0);
  const water = data.daily[date]?.waterMl ?? 0;
  const noKcal = items.filter((f) => f.kcal == null).length;

  const addCustomWater = () => {
    const r = parseNum(customWater, { min: -3000, max: 3000, integer: true, label: 'Вода, мл' });
    if (r.error) return setWaterErr(r.error);
    if (r.value == null) return setWaterErr('Введите количество в миллилитрах');
    setWaterErr(undefined);
    addWater(date, r.value);
    setCustomWater('');
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Питание</h1>
        <div className="date-nav">
          <button type="button" className="icon-btn" aria-label="Предыдущий день" onClick={() => setDate(addDays(date, -1))}>
            ‹
          </button>
          <label className="date-label">
            <span className="sr-only">Дата</span>
            <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <button type="button" className="icon-btn" aria-label="Следующий день" disabled={date >= todayISO()} onClick={() => setDate(addDays(date, 1))}>
            ›
          </button>
          <span className="muted">{relativeDay(date)}</span>
        </div>
      </header>

      <div className="grid">
        <Card title="Калории">
          <div className="big">
            {fmt(kcal, 0)} <span className="unit">/ {fmt(g.kcalMin, 0)}–{fmt(g.kcalMax, 0)} ккал</span>
          </div>
          <Progress value={kcal} min={g.kcalMin} max={g.kcalMax} label="Калории за день" />
          <p className="muted small">Ориентир, а не предписание. {noKcal > 0 && `Без калорий: ${noKcal} зап.`}</p>
        </Card>
        <Card title="Белок">
          <div className="big">
            {fmt(protein, 0)} <span className="unit">/ {g.proteinMin}–{g.proteinMax} г</span>
          </div>
          <Progress value={protein} min={g.proteinMin} max={g.proteinMax} label="Белок за день" />
        </Card>
        <Card title="Вода">
          <div className="big">
            {fmt(water / 1000, 2)} <span className="unit">/ {fmt(g.waterMinMl / 1000)}–{fmt(g.waterMaxMl / 1000)} л</span>
          </div>
          <Progress value={water} min={g.waterMinMl} max={g.waterMaxMl} label="Вода за день" />
          <div className="row-actions start">
            <button type="button" className="btn btn-small" onClick={() => addWater(date, 250)}>
              +250 мл
            </button>
            <button type="button" className="btn btn-small" onClick={() => addWater(date, 500)}>
              +500 мл
            </button>
            <button type="button" className="btn btn-small btn-ghost" disabled={water <= 0} onClick={() => addWater(date, -250)}>
              −250 мл
            </button>
          </div>
          <div className="inline-form">
            <Field label="Другое количество, мл" error={waterErr}>
              {(p) => (
                <input {...p} inputMode="numeric" value={customWater} placeholder="например, 330" onChange={(e) => setCustomWater(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustomWater()} />
              )}
            </Field>
            <button type="button" className="btn" onClick={addCustomWater}>
              Добавить
            </button>
          </div>
        </Card>
      </div>

      <Card title="Дневник" action={<button type="button" className="btn btn-small btn-primary" onClick={() => setEditing(newEntry(date))}>+ Еда или напиток</button>}>
        <div className="chips" aria-label="Быстро добавить белок">
          {QUICK.map((q) => (
            <button
              key={q.name}
              type="button"
              className="chip"
              onClick={() => setEditing({ ...newEntry(date), name: q.name, kcal: q.kcal, protein: q.protein, portion: 'normal' })}
            >
              + {q.name}
            </button>
          ))}
        </div>
        {items.length ? (
          <ul className="list">
            {items.map((f) => (
              <li key={f.id} className="list-item">
                <div className="list-main">
                  <div>
                    <span className="muted">{f.time}</span> <strong>{f.name}</strong>
                    {f.portion && <span className="muted small"> · {PORTIONS.find((p) => p.value === f.portion)?.label.toLowerCase()}</span>}
                  </div>
                  <div className="nums">
                    {f.kcal != null && <span>{fmt(f.kcal, 0)} ккал</span>}
                    {f.protein != null && <span>{fmt(f.protein, 0)} г белка</span>}
                  </div>
                </div>
                {f.note && <p className="note">{f.note}</p>}
                <div className="row-actions start">
                  <button type="button" className="btn btn-small" onClick={() => setEditing(f)}>
                    Изменить
                  </button>
                  <button type="button" className="btn btn-small btn-ghost danger" onClick={() => setToDelete(f)}>
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon="🍽️">За этот день записей нет. Можно записывать примерно — точный подсчёт не нужен.</Empty>
        )}
      </Card>

      <Card title="Мои привычки" className="soft">
        <ul className="habits">
          {HABITS.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <p className="muted small">Это мягкие ориентиры, а не запреты. Один «неидеальный» приём пищи ничего не портит.</p>
      </Card>

      <Modal open={!!editing} title={editing && data.food.some((f) => f.id === editing.id) ? 'Изменить запись' : 'Новая запись'} onClose={() => setEditing(null)}>
        {editing && <FoodForm entry={editing} onDone={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog
        open={!!toDelete}
        title="Удалить запись?"
        text={toDelete ? `«${toDelete.name}» будет удалена из дневника.` : ''}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteFood(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}

function newEntry(date: string): FoodEntry {
  return { id: uid(), date, time: nowTime(), name: '', portion: '', kcal: null, protein: null, note: '' };
}

function FoodForm({ entry, onDone }: { entry: FoodEntry; onDone: () => void }) {
  const [name, setName] = useState(entry.name);
  const [date, setDate] = useState(entry.date);
  const [time, setTime] = useState(entry.time);
  const [portion, setPortion] = useState<Portion>(entry.portion);
  const [kcal, setKcal] = useState(entry.kcal != null ? String(entry.kcal) : '');
  const [protein, setProtein] = useState(entry.protein != null ? String(entry.protein) : '');
  const [note, setNote] = useState(entry.note);
  const [err, setErr] = useState<Record<string, string>>({});

  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Напишите, что вы съели или выпили';
    if (!date) e.date = 'Укажите дату';
    else if (date > todayISO()) e.date = 'Дата не может быть в будущем';
    const k = parseNum(kcal, { min: 0, max: 5000 });
    const p = parseNum(protein, { min: 0, max: 300 });
    if (k.error) e.kcal = k.error;
    if (p.error) e.protein = p.error;
    setErr(e);
    if (Object.keys(e).length) return;
    saveFood({ ...entry, name: name.trim(), date, time: time || '12:00', portion, kcal: k.value, protein: p.value, note: note.trim() });
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
        {(p) => <input {...p} value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="например, гречка с курицей" />}
      </Field>
      <div className="two">
        <Field label="Дата" error={err.date}>
          {(p) => <input {...p} type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Время">{(p) => <input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
      </div>
      <Field label="Примерная порция">
        {(p) => (
          <select {...p} value={portion} onChange={(e) => setPortion(e.target.value as Portion)}>
            {PORTIONS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="two">
        <Field label="Калории, ккал (примерно)" hint="Необязательно" error={err.kcal}>
          {(p) => <input {...p} inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} />}
        </Field>
        <Field label="Белок, г (примерно)" hint="Необязательно" error={err.protein}>
          {(p) => <input {...p} inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />}
        </Field>
      </div>
      <Field label="Заметка">{(p) => <textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
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
