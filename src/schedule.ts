import type { AppData, ExerciseTemplate, MarkStatus, WorkoutLog, WorkoutType } from './types';
import { addDays, diffDays, todayISO, weekdayIndex } from './dates';

export interface Session {
  date: string;
  status: MarkStatus | 'planned' | 'missed';
  movedTo?: string;
  movedFrom?: string;
  log?: WorkoutLog;
}

/** Номер недели с даты старта (1, 2, 3 ...). До старта — 0. */
export function weekNumber(data: AppData, date = todayISO()): number {
  const d = diffDays(date, data.settings.startDate);
  if (d < 0) return 0;
  return Math.floor(d / 7) + 1;
}

export const isLightPhase = (data: AppData, date = todayISO()) => weekNumber(data, date) <= 2;

/** Список занятий в диапазоне дат: плановые дни + перенесённые. */
export function sessionsBetween(data: AppData, from: string, to: string): Session[] {
  const { startDate, workoutDays } = data.settings;
  const today = todayISO();
  const map = new Map<string, Session>();
  const start = from < startDate ? startDate : from;

  for (let d = start; d <= to; d = addDays(d, 1)) {
    if (workoutDays.includes(weekdayIndex(d))) map.set(d, { date: d, status: 'planned' });
  }
  // перенесённые
  for (const [date, mark] of Object.entries(data.marks)) {
    if (mark.status === 'moved' && mark.movedTo && mark.movedTo >= from && mark.movedTo <= to) {
      if (!map.has(mark.movedTo)) map.set(mark.movedTo, { date: mark.movedTo, status: 'planned', movedFrom: date });
      else map.get(mark.movedTo)!.movedFrom = date;
    }
  }
  // выполненные вне плана тоже показываем
  for (const w of data.workouts) {
    if (w.date >= from && w.date <= to && !map.has(w.date)) map.set(w.date, { date: w.date, status: 'done' });
  }

  for (const s of map.values()) {
    const mark = data.marks[s.date];
    if (mark) {
      s.status = mark.status;
      s.movedTo = mark.movedTo;
    }
    s.log = data.workouts.find((w) => w.date === s.date);
    if (s.log) s.status = 'done';
    if (s.status === 'planned' && s.date < today) s.status = 'missed';
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Тип следующей тренировки: чередование от последней выполненной. */
export function nextWorkoutType(data: AppData): WorkoutType {
  const last = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)[0];
  if (!last) return 'A';
  return last.type === 'A' ? 'B' : 'A';
}

export function upcomingSessions(data: AppData, count = 3): (Session & { type: WorkoutType })[] {
  const today = todayISO();
  const list = sessionsBetween(data, today, addDays(today, 60)).filter(
    (s) => s.status === 'planned' || (s.date === today && s.status === 'done'),
  );
  let t = nextWorkoutType(data);
  const out: (Session & { type: WorkoutType })[] = [];
  for (const s of list) {
    if (s.status === 'done') {
      out.push({ ...s, type: s.log?.type ?? t });
      continue;
    }
    out.push({ ...s, type: t });
    t = t === 'A' ? 'B' : 'A';
    if (out.length >= count) break;
  }
  return out.slice(0, count);
}

/** Последний лог упражнения (по id шаблона или имени) до даты. */
export function lastExerciseLog(data: AppData, ex: ExerciseTemplate, beforeDate: string) {
  const sorted = [...data.workouts].filter((w) => w.date < beforeDate).sort((a, b) => b.date.localeCompare(a.date));
  for (const w of sorted) {
    const e = w.exercises.find((x) => (x.templateId && x.templateId === ex.id) || x.name === ex.name);
    if (e) return { workout: w, exercise: e };
  }
  return null;
}

/**
 * Подсказка о прогрессии (не предписание): с 3-й недели, только если прошлая тренировка
 * была комфортной, техника сохранялась, не было симптомов и все подходы выполнены до верхней границы.
 */
export function progressionHint(data: AppData, ex: ExerciseTemplate, date: string): string | null {
  if (ex.kind !== 'reps' || weekNumber(data, date) < 3) return null;
  const last = lastExerciseLog(data, ex, date);
  if (!last) return null;
  const { workout, exercise } = last;
  if (!workout.comfortable || !workout.techniqueOk || workout.symptoms) return null;
  if (workout.feeling === 'hard' || workout.feeling === 'bad') return null;
  const done = exercise.sets.filter((s) => s.reps != null);
  if (done.length < ex.sets || !done.every((s) => (s.reps ?? 0) >= ex.repsMax)) return null;
  return 'Прошлый раз было комфортно и все подходы до верхней границы. Если чувствуете себя хорошо, можно попробовать +2–5 кг. Это только подсказка.';
}
