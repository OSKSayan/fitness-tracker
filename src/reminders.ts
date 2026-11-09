import { useEffect, useState } from 'react';
import type { Reminder, ReminderType } from './types';
import { nowTime, todayISO, weekdayIndex } from './dates';
import { getData, update } from './store';

export const REMINDER_LABELS: Record<ReminderType, { title: string; text: string; icon: string }> = {
  workout: { title: 'Тренировка', text: 'Сегодня по плану тренировка. Начинайте спокойно и прислушивайтесь к самочувствию.', icon: '🏋️' },
  weigh: { title: 'Взвешивание', text: 'Время записать вес — лучше утром, в одинаковых условиях.', icon: '⚖️' },
  water: { title: 'Вода', text: 'Не забудьте выпить воды и отметить её в приложении.', icon: '💧' },
  diary: { title: 'Дневник', text: 'Пара минут, чтобы заполнить дневник питания и шаги за день.', icon: '📝' },
};

export type NotifState = 'unsupported' | 'default' | 'granted' | 'denied';

export function notificationState(): NotifState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifState;
}

export async function requestNotifications(): Promise<NotifState> {
  if (notificationState() === 'unsupported') return 'unsupported';
  try {
    const res = await Notification.requestPermission();
    return res as NotifState;
  } catch {
    return notificationState();
  }
}

export function isDueToday(r: Reminder, date = todayISO()) {
  return r.enabled && r.days.includes(weekdayIndex(date));
}

export interface Toast {
  id: string;
  type: ReminderType;
}

/**
 * Проверка напоминаний раз в 30 секунд, пока приложение открыто.
 * Срабатывает один раз в день для каждого напоминания: системным уведомлением (если разрешено)
 * и всегда — сообщением внутри приложения.
 */
export function useReminderLoop(): [Toast[], (id: string) => void] {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const check = () => {
      const data = getData();
      const today = todayISO();
      const now = nowTime();
      const fired: Toast[] = [];
      for (const r of data.reminders) {
        if (!isDueToday(r, today) || now < r.time) continue;
        if (data.reminderFired[r.id]?.startsWith(today)) continue;
        fired.push({ id: r.id, type: r.type });
      }
      if (!fired.length) return;
      update((d) => {
        const rf = { ...d.reminderFired };
        fired.forEach((t) => (rf[t.id] = `${today} ${now}`));
        return { ...d, reminderFired: rf };
      });
      setToasts((prev) => [...prev.filter((p) => !fired.some((f) => f.id === p.id)), ...fired]);
      if (data.settings.notificationsWanted && notificationState() === 'granted') {
        for (const t of fired) {
          const l = REMINDER_LABELS[t.type];
          try {
            new Notification(`${l.icon} ${l.title}`, { body: l.text, tag: t.id });
          } catch {
            /* некоторые мобильные браузеры не позволяют создавать уведомления без service worker */
          }
        }
      }
    };
    check();
    const timer = window.setInterval(check, 30000);
    const onVis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return [toasts, (id) => setToasts((p) => p.filter((t) => t.id !== id))];
}
