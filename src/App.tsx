import { useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { Workouts } from './pages/Workouts';
import { Nutrition } from './pages/Nutrition';
import { Progress } from './pages/Progress';
import { Settings } from './pages/Settings';
import { getStorageError, setDemo, useData, useDemo } from './store';
import { REMINDER_LABELS, useReminderLoop } from './reminders';

export type Tab = 'home' | 'workouts' | 'nutrition' | 'progress' | 'settings';
export type Go = (tab: Tab, action?: string) => void;

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Главная', icon: '🏠' },
  { id: 'workouts', label: 'Тренировки', icon: '🏋️' },
  { id: 'nutrition', label: 'Питание', icon: '🥗' },
  { id: 'progress', label: 'Прогресс', icon: '📈' },
  { id: 'settings', label: 'Настройки', icon: '⚙️' },
];

const readHash = (): Tab => {
  const h = window.location.hash.replace('#', '') as Tab;
  return TABS.some((t) => t.id === h) ? h : 'home';
};

export function App() {
  useData();
  const demo = useDemo();
  const [tab, setTab] = useState<Tab>(readHash);
  const [action, setAction] = useState<string | undefined>();
  const [toasts, dismiss] = useReminderLoop();
  const storageError = getStorageError();

  useEffect(() => {
    const onHash = () => setTab(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go: Go = (t, a) => {
    setAction(a);
    if (window.location.hash !== `#${t}`) window.location.hash = t;
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  const clearAction = () => setAction(undefined);

  return (
    <div className="app">
      <a href="#main" className="skip">
        К содержимому
      </a>
      <nav className="nav" aria-label="Разделы">
        <div className="brand" aria-hidden>
          <span className="brand-mark">▮▬▮</span> Мой трекер
        </div>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`nav-btn ${tab === t.id ? 'nav-on' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => go(t.id)}
          >
            <span className="nav-icon" aria-hidden>
              {t.icon}
            </span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <main id="main" className="main">
        {demo && (
          <div className="demo-bar" role="status">
            Демо-режим: показан пример данных, ваш журнал не затронут.
            <button type="button" className="btn btn-small" onClick={() => setDemo(false)}>
              Выйти из демо
            </button>
          </div>
        )}
        {storageError && (
          <div className="notice notice-danger" role="alert">
            {storageError}
          </div>
        )}
        {tab === 'home' && <Home go={go} />}
        {tab === 'workouts' && <Workouts action={action} clearAction={clearAction} />}
        {tab === 'nutrition' && <Nutrition action={action} clearAction={clearAction} />}
        {tab === 'progress' && <Progress action={action} clearAction={clearAction} />}
        {tab === 'settings' && <Settings />}
      </main>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => {
          const l = REMINDER_LABELS[t.type];
          return (
            <div key={t.id} className="toast">
              <div>
                <strong>
                  {l.icon} {l.title}
                </strong>
                <div className="small">{l.text}</div>
              </div>
              <button type="button" className="icon-btn" aria-label="Закрыть напоминание" onClick={() => dismiss(t.id)}>
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
