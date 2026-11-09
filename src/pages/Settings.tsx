import { useRef, useState } from 'react';
import type { AppData, Goals, Reminder } from '../types';
import { normalize, replaceData, setDemo, update, useData, useDemo } from '../store';
import { createDefaultData } from '../defaults';
import { todayISO } from '../dates';
import { fmt, parseNum } from '../units';
import { patchSettings } from '../actions';
import { notificationState, REMINDER_LABELS, requestNotifications, type NotifState } from '../reminders';
import { Card, ConfirmDialog, DayPicker, Field, Notice } from '../components/ui';
import { DISCLAIMER } from '../components/MedicalNotes';

const NOTIF_TEXT: Record<NotifState, string> = {
  unsupported: 'Этот браузер не поддерживает уведомления. Напоминания будут показываться внутри приложения.',
  default: 'Разрешение на уведомления ещё не запрошено.',
  granted: 'Уведомления разрешены.',
  denied:
    'Уведомления запрещены в настройках браузера. Чтобы включить их, разрешите уведомления для этого сайта в настройках браузера (значок замка в адресной строке). Пока что напоминания будут показываться внутри приложения.',
};

export function Settings() {
  const data = useData();
  const demo = useDemo();
  const s = data.settings;
  const [notif, setNotif] = useState<NotifState>(notificationState());
  const [confirm, setConfirm] = useState<null | 'import' | 'wipe'>(null);
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const [importMsg, setImportMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const patchReminder = (id: string, p: Partial<Reminder>) =>
    update((d) => ({ ...d, reminders: d.reminders.map((r) => (r.id === id ? { ...r, ...p } : r)) }));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: 'fitness-tracker', exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitness-tracker-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFile = async (file: File | undefined) => {
    setImportMsg(null);
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const raw = json && typeof json === 'object' && 'data' in json ? json.data : json;
      if (!raw || typeof raw !== 'object' || !('settings' in raw)) throw new Error('format');
      setPendingImport(normalize(raw));
      setConfirm('import');
    } catch {
      setImportMsg({ tone: 'danger', text: 'Не удалось прочитать файл. Выберите JSON-файл, ранее экспортированный из этого приложения.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Напоминания и настройки</h1>
      </header>

      <Card title="Напоминания">
        <Notice tone="info">
          Напоминания работают, <strong>пока приложение открыто</strong> во вкладке браузера (в том числе в фоне). Когда вкладка закрыта,
          уведомления не приходят — это ограничение браузера без серверной части. Внутри приложения напоминание появится при следующем открытии.
        </Notice>
        <div className="setting-row">
          <label className="check">
            <input
              type="checkbox"
              checked={s.notificationsWanted}
              disabled={notif === 'unsupported'}
              onChange={async (e) => {
                const on = e.target.checked;
                patchSettings({ notificationsWanted: on });
                if (on && notificationState() === 'default') setNotif(await requestNotifications());
              }}
            />
            Показывать системные уведомления браузера
          </label>
          <p className={notif === 'denied' ? 'field-error' : 'field-hint'}>{NOTIF_TEXT[notif]}</p>
          {notif === 'default' && (
            <button type="button" className="btn btn-small" onClick={async () => setNotif(await requestNotifications())}>
              Запросить разрешение
            </button>
          )}
          {notif === 'granted' && s.notificationsWanted && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => new Notification('Проверка', { body: 'Так будут выглядеть напоминания.' })}>
              Проверить уведомление
            </button>
          )}
        </div>
        <ul className="list">
          {data.reminders.map((r) => {
            const l = REMINDER_LABELS[r.type];
            return (
              <li key={r.id} className="list-item">
                <div className="list-main">
                  <label className="check">
                    <input type="checkbox" checked={r.enabled} onChange={(e) => patchReminder(r.id, { enabled: e.target.checked })} />
                    <span>
                      {l.icon} <strong>{l.title}</strong>
                    </span>
                  </label>
                  <label className="inline-select">
                    <span className="sr-only">Время напоминания «{l.title}»</span>
                    <input type="time" value={r.time} disabled={!r.enabled} onChange={(e) => e.target.value && patchReminder(r.id, { time: e.target.value })} />
                  </label>
                </div>
                {r.enabled && (
                  <>
                    <DayPicker label={`Дни напоминания «${l.title}»`} value={r.days} onChange={(v) => patchReminder(r.id, { days: v })} />
                    {r.days.length === 0 && <p className="field-error">Выберите хотя бы один день</p>}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <GoalsCard goals={s.goals} weightUnit={s.weightUnit} />

      <Card title="Единицы измерения">
        <div className="two">
          <Field label="Вес">
            {(p) => (
              <select {...p} value={s.weightUnit} onChange={(e) => patchSettings({ weightUnit: e.target.value as 'kg' | 'lb' })}>
                <option value="kg">Килограммы (кг)</option>
                <option value="lb">Фунты (lb)</option>
              </select>
            )}
          </Field>
          <Field label="Замеры">
            {(p) => (
              <select {...p} value={s.lengthUnit} onChange={(e) => patchSettings({ lengthUnit: e.target.value as 'cm' | 'in' })}>
                <option value="cm">Сантиметры (см)</option>
                <option value="in">Дюймы (in)</option>
              </select>
            )}
          </Field>
        </div>
        <p className="muted small">Данные хранятся в кг и см и пересчитываются при показе — смена единиц ничего не портит.</p>
      </Card>

      <Card title="Данные и резервная копия">
        <p className="muted">
          Все данные хранятся только в этом браузере (localStorage) на этом устройстве. Регистрации и сервера нет. Делайте экспорт, чтобы не
          потерять записи при очистке браузера или переносе на другое устройство.
        </p>
        <div className="row-actions start">
          <button type="button" className="btn btn-primary" onClick={exportJson}>
            Экспорт в JSON
          </button>
          <label className="btn">
            Импорт из JSON
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <button type="button" className="btn btn-ghost danger" onClick={() => setConfirm('wipe')}>
            Удалить все данные
          </button>
        </div>
        {importMsg && (
          <Notice tone={importMsg.tone} onClose={() => setImportMsg(null)}>
            {importMsg.text}
          </Notice>
        )}
      </Card>

      <Card title="Демонстрационный режим">
        <p className="muted">
          Показывает приложение с примером данных. Пример хранится отдельно и не попадает в ваш журнал; при выключении режима вы вернётесь к своим
          данным.
        </p>
        <label className="check">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          Включить демо-режим
        </label>
      </Card>

      <Card title="О приложении" className="soft">
        <p className="small">{DISCLAIMER}</p>
        <p className="small muted">
          При необычных симптомах или ухудшении самочувствия прекратите нагрузку и обратитесь за медицинской помощью.
        </p>
      </Card>

      <ConfirmDialog
        open={confirm === 'import'}
        title="Заменить данные?"
        confirmLabel="Импортировать"
        text={
          pendingImport
            ? `Текущие данные${demo ? ' демо-режима' : ''} будут заменены данными из файла: тренировок — ${pendingImport.workouts.length}, записей питания — ${pendingImport.food.length}, записей веса и замеров — ${pendingImport.body.length}. Рекомендуем сначала сделать экспорт.`
            : ''
        }
        onCancel={() => {
          setConfirm(null);
          setPendingImport(null);
        }}
        onConfirm={() => {
          if (pendingImport) replaceData(pendingImport);
          setConfirm(null);
          setPendingImport(null);
          setImportMsg({ tone: 'ok', text: 'Данные импортированы.' });
        }}
      />
      <ConfirmDialog
        open={confirm === 'wipe'}
        title="Удалить все данные?"
        text="Будут удалены все тренировки, питание, вес, замеры и настройки. Это действие нельзя отменить. Сделайте экспорт, если хотите сохранить копию."
        confirmLabel="Удалить всё"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          replaceData(createDefaultData());
          setConfirm(null);
        }}
      />
    </div>
  );
}

const GOAL_FIELDS: { key: keyof Goals; label: string; scale?: number; min: number; max: number; integer?: boolean }[] = [
  { key: 'kcalMin', label: 'Калории от, ккал', min: 800, max: 6000, integer: true },
  { key: 'kcalMax', label: 'Калории до, ккал', min: 800, max: 6000, integer: true },
  { key: 'proteinMin', label: 'Белок от, г', min: 0, max: 400, integer: true },
  { key: 'proteinMax', label: 'Белок до, г', min: 0, max: 400, integer: true },
  { key: 'waterMinMl', label: 'Вода от, л', scale: 1000, min: 0.5, max: 8 },
  { key: 'waterMaxMl', label: 'Вода до, л', scale: 1000, min: 0.5, max: 8 },
  { key: 'stepsMin', label: 'Шаги от', min: 0, max: 50000, integer: true },
  { key: 'stepsMax', label: 'Шаги до', min: 0, max: 50000, integer: true },
  { key: 'weeklyLossKg', label: 'Ориентир темпа, кг в неделю', min: 0, max: 1.5 },
];

function GoalsCard({ goals, weightUnit }: { goals: Goals; weightUnit: 'kg' | 'lb' }) {
  const init = () => Object.fromEntries(GOAL_FIELDS.map((f) => [f.key, String(goals[f.key] / (f.scale ?? 1))])) as Record<keyof Goals, string>;
  const [vals, setVals] = useState(init);
  const [err, setErr] = useState<Partial<Record<keyof Goals, string>>>({});
  const [saved, setSaved] = useState(false);

  const save = () => {
    const e: Partial<Record<keyof Goals, string>> = {};
    const out = { ...goals };
    for (const f of GOAL_FIELDS) {
      const r = parseNum(vals[f.key], { min: f.min, max: f.max, integer: f.integer });
      if (r.error) e[f.key] = r.error;
      else if (r.value == null) e[f.key] = 'Заполните поле';
      else out[f.key] = Math.round(r.value * (f.scale ?? 1) * 100) / 100;
    }
    const pairs: [keyof Goals, keyof Goals][] = [
      ['kcalMin', 'kcalMax'],
      ['proteinMin', 'proteinMax'],
      ['waterMinMl', 'waterMaxMl'],
      ['stepsMin', 'stepsMax'],
    ];
    for (const [a, b] of pairs) if (!e[a] && !e[b] && out[a] > out[b]) e[b] = 'Должно быть не меньше нижней границы';
    setErr(e);
    if (Object.keys(e).length) return;
    patchSettings({ goals: out });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card title="Цели и ориентиры">
      <p className="muted small">
        Ориентиры для самоконтроля, а не медицинские нормы. Приложение не рассчитывает дефицит калорий — значения задаёте вы.
        {weightUnit === 'lb' && ' Темп указывается в килограммах.'}
      </p>
      <form
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          save();
        }}
      >
        <div className="two">
          {GOAL_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} error={err[f.key]}>
              {(p) => <input {...p} inputMode="decimal" value={vals[f.key]} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />}
            </Field>
          ))}
        </div>
        <div className="row-actions start">
          <button type="submit" className="btn btn-primary">
            Сохранить ориентиры
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setVals(Object.fromEntries(GOAL_FIELDS.map((f) => [f.key, String(createDefaultData().settings.goals[f.key] / (f.scale ?? 1))])) as Record<keyof Goals, string>)}>
            Значения по умолчанию
          </button>
          {saved && <span className="ok-text" role="status">Сохранено ✓</span>}
        </div>
        <p className="muted small">
          По умолчанию: {fmt(2200, 0)}–{fmt(2400, 0)} ккал, 150–170 г белка, 2–3 л воды, {fmt(8000, 0)}–{fmt(10000, 0)} шагов, около 0,5 кг в неделю.
        </p>
      </form>
    </Card>
  );
}
