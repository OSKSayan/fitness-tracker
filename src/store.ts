import { useSyncExternalStore } from 'react';
import type { AppData } from './types';
import { createDefaultData, createDemoData } from './defaults';

const KEY = 'fitness-tracker:data';
const DEMO_KEY = 'fitness-tracker:demo';
const MODE_KEY = 'fitness-tracker:mode';

type Listener = () => void;
const listeners = new Set<Listener>();
/** Слушатели локальных изменений (для синхронизации с облаком). */
const changeListeners = new Set<Listener>();

let demo = safeGet(MODE_KEY) === 'demo';
let data: AppData = load();
let storageError: string | null = null;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Дополняет загруженные данные значениями по умолчанию (на случай старых/частичных файлов). */
export function normalize(raw: unknown): AppData {
  const def = createDefaultData();
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Partial<AppData>;
  return {
    version: 1,
    settings: {
      ...def.settings,
      ...(r.settings ?? {}),
      goals: { ...def.settings.goals, ...(r.settings?.goals ?? {}) },
    },
    plan: {
      A: Array.isArray(r.plan?.A) ? r.plan!.A : def.plan.A,
      B: Array.isArray(r.plan?.B) ? r.plan!.B : def.plan.B,
    },
    workouts: Array.isArray(r.workouts) ? r.workouts : [],
    marks: r.marks && typeof r.marks === 'object' ? r.marks : {},
    food: Array.isArray(r.food) ? r.food : [],
    daily: r.daily && typeof r.daily === 'object' ? r.daily : {},
    body: Array.isArray(r.body) ? r.body : [],
    reminders: Array.isArray(r.reminders) ? r.reminders : def.reminders,
    reminderFired: r.reminderFired && typeof r.reminderFired === 'object' ? r.reminderFired : {},
  };
}

/** Есть ли в данных пользовательские записи (а не только настройки по умолчанию). */
export function hasRecords(d: AppData) {
  return d.workouts.length > 0 || d.food.length > 0 || d.body.length > 0 || Object.keys(d.daily).length > 0;
}

function load(): AppData {
  const raw = safeGet(demo ? DEMO_KEY : KEY);
  if (!raw) return demo ? createDemoData() : createDefaultData();
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return createDefaultData();
  }
}

function persist() {
  try {
    localStorage.setItem(demo ? DEMO_KEY : KEY, JSON.stringify(data));
    storageError = null;
  } catch {
    storageError = 'Не удалось сохранить данные в браузере (хранилище недоступно или переполнено). Сделайте экспорт в JSON.';
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function getData() {
  return data;
}

/** Изменение пользователем: сохраняется локально и отправляется в облако. */
export function update(fn: (d: AppData) => AppData) {
  data = fn(data);
  persist();
  emit();
  if (!demo) changeListeners.forEach((l) => l());
}

/** Полная замена данных. fromRemote — данные пришли из облака, обратно не отправляем. */
export function replaceData(next: AppData, opts: { fromRemote?: boolean } = {}) {
  data = next;
  persist();
  emit();
  if (!demo && !opts.fromRemote) changeListeners.forEach((l) => l());
}

export function onLocalChange(l: Listener) {
  changeListeners.add(l);
  return () => {
    changeListeners.delete(l);
  };
}

export function isDemo() {
  return demo;
}

export function getStorageError() {
  return storageError;
}

export function setDemo(on: boolean) {
  demo = on;
  try {
    if (on) {
      localStorage.setItem(MODE_KEY, 'demo');
      localStorage.removeItem(DEMO_KEY); // каждый раз свежий пример
    } else {
      localStorage.removeItem(MODE_KEY);
      localStorage.removeItem(DEMO_KEY);
    }
  } catch {
    /* ignore */
  }
  data = load();
  emit();
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useData(): AppData {
  return useSyncExternalStore(subscribe, getData);
}

export function useDemo(): boolean {
  return useSyncExternalStore(subscribe, isDemo);
}
