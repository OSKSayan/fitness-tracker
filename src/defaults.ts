import type { AppData, ExerciseTemplate, Reminder } from './types';
import { addDays, defaultStartDate, todayISO, weekdayIndex } from './dates';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const strength = (id: string, name: string): ExerciseTemplate => ({
  id,
  name,
  kind: 'reps',
  sets: 3,
  repsMin: 8,
  repsMax: 12,
  seconds: 0,
});

export const defaultPlan = (): AppData['plan'] => ({
  A: [
    strength('a1', 'Приседания или жим ногами'),
    strength('a2', 'Жим лёжа'),
    strength('a3', 'Тяга верхнего блока'),
    strength('a4', 'Жим гантелей над головой'),
    { id: 'a5', name: 'Планка', kind: 'time', sets: 3, repsMin: 0, repsMax: 0, seconds: 30 },
  ],
  B: [
    strength('b1', 'Румынская тяга'),
    strength('b2', 'Жим гантелей на наклонной скамье'),
    strength('b3', 'Тяга в наклоне'),
    strength('b4', 'Выпады'),
    strength('b5', 'Скручивания или подъём ног в висе'),
  ],
});

const defaultReminders = (): Reminder[] => [
  { id: 'r-workout', type: 'workout', enabled: false, time: '17:00', days: [0, 2, 4] },
  { id: 'r-weigh', type: 'weigh', enabled: false, time: '08:00', days: [0, 3] },
  { id: 'r-water', type: 'water', enabled: false, time: '13:00', days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'r-diary', type: 'diary', enabled: false, time: '21:00', days: [0, 1, 2, 3, 4, 5, 6] },
];

export function createDefaultData(): AppData {
  return {
    version: 1,
    settings: {
      startDate: defaultStartDate(),
      workoutDays: [0, 2, 4],
      weightUnit: 'kg',
      lengthUnit: 'cm',
      goals: {
        kcalMin: 2200,
        kcalMax: 2400,
        proteinMin: 150,
        proteinMax: 170,
        waterMinMl: 2000,
        waterMaxMl: 3000,
        stepsMin: 8000,
        stepsMax: 10000,
        weeklyLossKg: 0.5,
      },
      doctorAck: false,
      notificationsWanted: false,
    },
    plan: defaultPlan(),
    workouts: [],
    marks: {},
    food: [],
    daily: {},
    body: [],
    reminders: defaultReminders(),
    reminderFired: {},
  };
}

/** Пример данных — только для отдельного демонстрационного режима. */
export function createDemoData(): AppData {
  const data = createDefaultData();
  const today = todayISO();
  data.settings.startDate = addDays(today, -35);
  data.settings.doctorAck = true;
  const weights = [85.6, 85.9, 85.2, 85.4, 84.9, 85.1, 84.6, 84.8, 84.3, 84.5, 84.0, 83.9];
  weights.forEach((w, i) => {
    data.body.push({
      id: uid(),
      date: addDays(today, -33 + i * 3),
      weight: w,
      waist: i % 4 === 0 ? 92 - i * 0.2 : null,
      belly: i % 4 === 0 ? 96 - i * 0.25 : null,
      chest: null,
      hips: null,
      note: '',
    });
  });
  let type: 'A' | 'B' = 'A';
  for (let d = -33; d < 0; d++) {
    const date = addDays(today, d);
    const wd = weekdayIndex(date);
    if (![0, 2, 4].includes(wd)) continue;
    const week = Math.floor((d + 35) / 7);
    data.workouts.push({
      id: uid(),
      date,
      type,
      exercises: data.plan[type].map((t) => ({
        templateId: t.id,
        name: t.name,
        kind: t.kind,
        sets: Array.from({ length: t.sets }, () =>
          t.kind === 'time'
            ? { weight: null, reps: null, seconds: 30 + week * 5 }
            : { weight: 20 + week * 2.5, reps: 10 + Math.min(week, 2), seconds: null },
        ),
      })),
      feeling: 'good',
      comfortable: true,
      techniqueOk: true,
      symptoms: false,
      cardioMinutes: 15,
      cardioKind: 'Ходьба',
      note: '',
      createdAt: Date.now(),
    });
    data.marks[date] = { status: 'done' };
    type = type === 'A' ? 'B' : 'A';
  }
  for (let d = -6; d <= 0; d++) {
    data.daily[addDays(today, d)] = { steps: 7000 + ((d * 937) % 3000 + 3000) % 3000, waterMl: 1500 + (d + 6) * 150 };
  }
  data.food.push(
    { id: uid(), date: today, time: '08:30', name: 'Омлет из 3 яиц, хлеб', portion: 'normal', kcal: 420, protein: 24, note: '' },
    { id: uid(), date: today, time: '13:30', name: 'Куриная грудка, гречка (полпорции), салат', portion: 'normal', kcal: 550, protein: 45, note: '' },
  );
  return data;
}
