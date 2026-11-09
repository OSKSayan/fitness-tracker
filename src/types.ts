export type WorkoutType = 'A' | 'B';
export type ExerciseKind = 'reps' | 'time';

export interface ExerciseTemplate {
  id: string;
  name: string;
  kind: ExerciseKind;
  sets: number;
  repsMin: number;
  repsMax: number;
  /** для упражнений по времени, секунды */
  seconds: number;
}

export interface SetEntry {
  weight: number | null; // кг
  reps: number | null;
  seconds: number | null;
}

export interface ExerciseLog {
  templateId: string | null;
  name: string;
  kind: ExerciseKind;
  sets: SetEntry[];
}

export type Feeling = 'great' | 'good' | 'ok' | 'hard' | 'bad';

export interface WorkoutLog {
  id: string;
  date: string; // YYYY-MM-DD
  type: WorkoutType;
  exercises: ExerciseLog[];
  feeling: Feeling;
  comfortable: boolean;
  techniqueOk: boolean;
  symptoms: boolean;
  cardioMinutes: number | null;
  cardioKind: string;
  note: string;
  createdAt: number;
}

export type MarkStatus = 'done' | 'skipped' | 'moved';

export interface SessionMark {
  status: MarkStatus;
  movedTo?: string;
}

export type Portion = 'small' | 'normal' | 'large' | '';

export interface FoodEntry {
  id: string;
  date: string;
  time: string; // HH:MM
  name: string;
  portion: Portion;
  kcal: number | null;
  protein: number | null;
  note: string;
}

export interface DailyEntry {
  steps: number | null;
  waterMl: number;
}

export interface BodyEntry {
  id: string;
  date: string;
  weight: number | null; // кг
  waist: number | null; // см
  belly: number | null;
  chest: number | null;
  hips: number | null;
  note: string;
}

export type ReminderType = 'workout' | 'weigh' | 'water' | 'diary';

export interface Reminder {
  id: string;
  type: ReminderType;
  enabled: boolean;
  time: string; // HH:MM
  days: number[]; // 0 = понедельник ... 6 = воскресенье
}

export interface Goals {
  kcalMin: number;
  kcalMax: number;
  proteinMin: number;
  proteinMax: number;
  waterMinMl: number;
  waterMaxMl: number;
  stepsMin: number;
  stepsMax: number;
  weeklyLossKg: number;
}

export interface Settings {
  startDate: string;
  workoutDays: number[]; // 0 = пн
  weightUnit: 'kg' | 'lb';
  lengthUnit: 'cm' | 'in';
  goals: Goals;
  doctorAck: boolean;
  notificationsWanted: boolean;
}

export interface AppData {
  version: 1;
  settings: Settings;
  plan: Record<WorkoutType, ExerciseTemplate[]>;
  workouts: WorkoutLog[];
  marks: Record<string, SessionMark>;
  food: FoodEntry[];
  daily: Record<string, DailyEntry>;
  body: BodyEntry[];
  reminders: Reminder[];
  reminderFired: Record<string, string>; // id -> "YYYY-MM-DD HH:MM" последнего срабатывания
}
