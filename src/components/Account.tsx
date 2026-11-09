import { useState } from 'react';
import { cloudConfigured } from '../config';
import { signIn, signOut, signUp, syncNow, useSync, type SyncState } from '../sync';
import { useDemo } from '../store';
import { Field, Notice } from './ui';

export const SYNC_LABEL: Record<SyncState, string> = {
  off: 'Только на этом устройстве',
  'signed-out': 'Не выполнен вход',
  syncing: 'Сохраняю…',
  synced: 'Сохранено в облаке',
  offline: 'Нет сети — сохранится позже',
  error: 'Ошибка синхронизации',
};

export const SYNC_ICON: Record<SyncState, string> = {
  off: '📱',
  'signed-out': '☁️',
  syncing: '⏳',
  synced: '✅',
  offline: '📴',
  error: '⚠️',
};

export function Account() {
  const sync = useSync();
  const demo = useDemo();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger' | 'info'; text: string } | null>(null);

  if (!cloudConfigured) {
    return (
      <p className="muted">
        Облачная база ещё не подключена. Сейчас данные хранятся только в этом браузере — делайте резервную копию через экспорт.
      </p>
    );
  }

  if (sync.state !== 'signed-out') {
    return (
      <div className="stack">
        <p>
          Вы вошли как <strong>{sync.email}</strong>.
        </p>
        <p>
          {SYNC_ICON[sync.state]} {SYNC_LABEL[sync.state]}
          {sync.lastSync && sync.state === 'synced' && (
            <span className="muted small"> · {new Date(sync.lastSync).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </p>
        {sync.message && <Notice tone="danger">{sync.message}</Notice>}
        {demo && <Notice tone="info">В демо-режиме синхронизация выключена.</Notice>}
        <p className="muted small">Данные сохраняются в облаке автоматически. Войдите с тем же email на телефоне и компьютере — записи будут общими.</p>
        <div className="row-actions start">
          <button type="button" className="btn" onClick={() => void syncNow()}>
            Синхронизировать сейчас
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
            Выйти
          </button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setMsg({ tone: 'danger', text: 'Введите email.' });
    if (password.length < 6) return setMsg({ tone: 'danger', text: 'Пароль — минимум 6 символов.' });
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email, password);
      else {
        const needConfirm = await signUp(email, password);
        if (needConfirm) setMsg({ tone: 'info', text: 'Почти готово: откройте письмо от Supabase и нажмите ссылку. Потом войдите здесь.' });
      }
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="muted">Войдите, чтобы данные хранились в облаке и были одинаковыми на телефоне и компьютере.</p>
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'in'} className={`seg-btn ${mode === 'in' ? 'seg-on' : ''}`} onClick={() => setMode('in')}>
          Вход
        </button>
        <button type="button" role="tab" aria-selected={mode === 'up'} className={`seg-btn ${mode === 'up' ? 'seg-on' : ''}`} onClick={() => setMode('up')}>
          Регистрация
        </button>
      </div>
      <Field label="Email">{(p) => <input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label="Пароль" hint={mode === 'up' ? 'Минимум 6 символов' : undefined}>
        {(p) => (
          <input {...p} type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
      </Field>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Подождите…' : mode === 'in' ? 'Войти' : 'Создать аккаунт'}
      </button>
      <p className="muted small">Данные, которые уже есть на этом устройстве, при первом входе перенесутся в облако.</p>
    </form>
  );
}
