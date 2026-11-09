import type { BodyEntry, DailyEntry, FoodEntry, SessionMark, Settings, WorkoutLog } from './types';
import { update } from './store';

export function patchDaily(date: string, patch: Partial<DailyEntry>) {
  update((d) => {
    const cur: DailyEntry = d.daily[date] ?? { steps: null, waterMl: 0 };
    return { ...d, daily: { ...d.daily, [date]: { ...cur, ...patch } } };
  });
}

export function addWater(date: string, ml: number) {
  update((d) => {
    const cur: DailyEntry = d.daily[date] ?? { steps: null, waterMl: 0 };
    return { ...d, daily: { ...d.daily, [date]: { ...cur, waterMl: Math.max(0, cur.waterMl + ml) } } };
  });
}

export function patchSettings(patch: Partial<Settings>) {
  update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
}

export function saveFood(entry: FoodEntry) {
  update((d) => {
    const exists = d.food.some((f) => f.id === entry.id);
    return { ...d, food: exists ? d.food.map((f) => (f.id === entry.id ? entry : f)) : [...d.food, entry] };
  });
}

export function deleteFood(id: string) {
  update((d) => ({ ...d, food: d.food.filter((f) => f.id !== id) }));
}

export function saveBody(entry: BodyEntry) {
  update((d) => {
    const exists = d.body.some((f) => f.id === entry.id);
    return { ...d, body: exists ? d.body.map((f) => (f.id === entry.id ? entry : f)) : [...d.body, entry] };
  });
}

export function deleteBody(id: string) {
  update((d) => ({ ...d, body: d.body.filter((f) => f.id !== id) }));
}

export function saveWorkout(log: WorkoutLog, previousDate?: string) {
  update((d) => {
    const exists = d.workouts.some((w) => w.id === log.id);
    const marks = { ...d.marks };
    if (previousDate && previousDate !== log.date && marks[previousDate]?.status === 'done') delete marks[previousDate];
    marks[log.date] = { status: 'done' };
    return {
      ...d,
      marks,
      workouts: exists ? d.workouts.map((w) => (w.id === log.id ? log : w)) : [...d.workouts, log],
    };
  });
}

export function deleteWorkout(id: string) {
  update((d) => {
    const w = d.workouts.find((x) => x.id === id);
    const marks = { ...d.marks };
    if (w && marks[w.date]?.status === 'done' && !d.workouts.some((x) => x.id !== id && x.date === w.date)) delete marks[w.date];
    return { ...d, marks, workouts: d.workouts.filter((x) => x.id !== id) };
  });
}

export function setMark(date: string, mark: SessionMark | null) {
  update((d) => {
    const marks = { ...d.marks };
    if (mark) marks[date] = mark;
    else delete marks[date];
    return { ...d, marks };
  });
}
