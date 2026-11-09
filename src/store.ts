import { useSyncExternalStore } from 'react';
import type { AppData } from './types';
import { createDefaultData, createDemoData } from './defaults';

const KEY = 'fitness-tracker:data';
const DEMO_KEY = 'fitness-tracker:demo';
const MODE_KEY = 'fitness-tracker:mode';

type Listener = () => void;
const listeners = new Set<Listener>();

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

export function update(fn: (d: AppData) => AppData) {
  data = fn(data);
  persist();
  emit();
}

export function replaceData(next: AppData) {
  data = next;
  persist();
  emit();
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

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useData(): AppData {
  return useSyncExternalStore(subscribe, getData);
}

export function useDemo(): boolean {
  return useSyncExternalStore(subscribe, isDemo);
}
