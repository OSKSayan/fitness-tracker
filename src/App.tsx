import { useEffect, useState } from 'react';
import { Today } from './pages/Today';
import { Workouts } from './pages/Workouts';
import { Progress } from './pages/Progress';
import { Settings } from './pages/Settings';
import { getStorageError, setDemo, useData, useDemo } from './store';
import { REMINDER_LABELS, useReminderLoop } from './reminders';
import { startSync, useSync } from './sync';
import { SYNC_ICON, SYNC_LABEL } from './components/Account';

export type Tab = 'today' | 'workout' | 'progress' | 'settings';
export type Go = (tab: Tab, action?: string) => void;

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Сегодня', icon: '🏠' },
  { id: 'workout', label: 'Тренировки', icon: '🏋️' },
  { id: 'progress', label: 'Прогресс', icon: '📈' },
  { id: 'settings', label: 'Настройки', icon: '⚙️' },
];

const readHash = (): Tab => {
  const h = window.location.hash.replace('#', '') as Tab;
  return TABS.some((t) => t.id === h) ? h : 'today';
};

startSync();

export function App() {
  useData();
  const demo = useDemo();
  const sync = useSync();
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
        <div className="topbar">
          {sync.state !== 'off' && !demo && (
            <button type="button" className={`sync-chip sync-${sync.state}`} onClick={() => go('settings', 'account')} title={sync.message ?? undefined}>
              {SYNC_ICON[sync.state]} {sync.state === 'signed-out' ? 'Войти, чтобы сохранять в облако' : SYNC_LABEL[sync.state]}
            </button>
          )}
        </div>
        {demo && (
          <div className="demo-bar" role="status">
            Демо-режим: пример данных, ваши записи не затронуты.
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
        {tab === 'today' && <Today go={go} action={action} clearAction={clearAction} />}
        {tab === 'workout' && <Workouts go={go} action={action} clearAction={clearAction} />}
        {tab === 'progress' && <Progress action={action} clearAction={clearAction} />}
        {tab === 'settings' && <Settings key={action ?? 'none'} section={action} />}
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
