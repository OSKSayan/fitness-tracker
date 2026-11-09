import { useSyncExternalStore } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { cloudConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { getData, hasRecords, isDemo, normalize, onLocalChange, replaceData } from './store';

/**
 * Синхронизация с Supabase.
 * Все данные пользователя хранятся одной строкой (jsonb) в таблице fitness_data.
 * Браузер остаётся локальной копией: приложение работает и без сети,
 * изменения отправляются в облако через ~1,5 с после правки или при появлении сети.
 */

const TABLE = 'fitness_data';
const META_KEY = 'fitness-tracker:sync';

export type SyncState = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';

interface Status {
  state: SyncState;
  email: string | null;
  message: string | null;
  lastSync: number | null;
}

let status: Status = { state: cloudConfigured ? 'signed-out' : 'off', email: null, message: null, lastSync: null };
const listeners = new Set<() => void>();
let client: SupabaseClient | null = null;
let session: Session | null = null;
let pushTimer: number | undefined;
let pushing = false;

interface Meta {
  dirty: boolean;
  userId: string | null;
}

function readMeta(): Meta {
  try {
    return { dirty: false, userId: null, ...JSON.parse(localStorage.getItem(META_KEY) || '{}') };
  } catch {
    return { dirty: false, userId: null };
  }
}
function writeMeta(m: Partial<Meta>) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ ...readMeta(), ...m }));
  } catch {
    /* ignore */
  }
}

function setStatus(p: Partial<Status>) {
  status = { ...status, ...p };
  listeners.forEach((l) => l());
}

export function useSync(): Status {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => status,
  );
}

function sb(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
  }
  return client;
}

function errText(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/Invalid login credentials/i.test(m)) return 'Неверный email или пароль.';
  if (/Email not confirmed/i.test(m)) return 'Email не подтверждён. Откройте письмо от Supabase и перейдите по ссылке.';
  if (/User already registered/i.test(m)) return 'Такой пользователь уже есть — войдите.';
  if (/Password should be at least/i.test(m)) return 'Пароль слишком короткий (минимум 6 символов).';
  if (/relation .* does not exist|Could not find the table/i.test(m)) return 'В базе нет таблицы fitness_data. Выполните SQL из файла supabase/schema.sql.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Нет связи с сервером.';
  return m;
}

/** Загрузить данные из облака и сверить с локальными. */
async function pull() {
  if (!session || isDemo()) return;
  setStatus({ state: 'syncing', message: null });
  try {
    const { data: row, error } = await sb().from(TABLE).select('data, updated_at').eq('user_id', session.user.id).maybeSingle();
    if (error) throw error;
    const meta = readMeta();
    const sameUser = meta.userId === session.user.id;
    if (!row) {
      // В облаке пусто — отправляем то, что есть на устройстве.
      writeMeta({ userId: session.user.id });
      await push(true);
      return;
    }
    if (sameUser && meta.dirty) {
      // Есть неотправленные изменения на этом устройстве — они новее.
      await push(true);
      return;
    }
    if (!sameUser && hasRecords(getData()) && !hasRecords(normalize(row.data))) {
      writeMeta({ userId: session.user.id });
      await push(true);
      return;
    }
    replaceData(normalize(row.data), { fromRemote: true });
    writeMeta({ userId: session.user.id, dirty: false });
    setStatus({ state: 'synced', lastSync: Date.now() });
  } catch (e) {
    setStatus({ state: navigator.onLine ? 'error' : 'offline', message: errText(e) });
  }
}

async function push(force = false) {
  if (!session || isDemo()) return;
  if (pushing) {
    schedulePush();
    return;
  }
  if (!force && !readMeta().dirty) return;
  if (!navigator.onLine) {
    setStatus({ state: 'offline', message: null });
    return;
  }
  pushing = true;
  setStatus({ state: 'syncing', message: null });
  try {
    const { error } = await sb()
      .from(TABLE)
      .upsert({ user_id: session.user.id, data: getData(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    writeMeta({ dirty: false, userId: session.user.id });
    setStatus({ state: 'synced', lastSync: Date.now() });
  } catch (e) {
    setStatus({ state: navigator.onLine ? 'error' : 'offline', message: errText(e) });
  } finally {
    pushing = false;
  }
}

function schedulePush() {
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void push(), 1500);
}

let started = false;
export function startSync() {
  if (started || !cloudConfigured) return;
  started = true;

  onLocalChange(() => {
    writeMeta({ dirty: true });
    if (session) schedulePush();
  });

  sb().auth.onAuthStateChange((event, s) => {
    const prev = session?.user.id;
    session = s;
    if (!s) {
      setStatus({ state: 'signed-out', email: null, message: null });
      return;
    }
    setStatus({ email: s.user.email ?? null });
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (prev !== s.user.id) void pull();
    }
  });

  window.addEventListener('online', () => {
    if (session) void (readMeta().dirty ? push() : pull());
  });
  document.addEventListener('visibilitychange', () => {
    // Вернулись в приложение — подтянуть изменения с другого устройства.
    if (document.visibilityState === 'visible' && session && !readMeta().dirty) void pull();
  });
}

export async function signIn(email: string, password: string) {
  const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(errText(error));
}

/** Возвращает true, если нужно подтвердить email. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await sb().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw new Error(errText(error));
  return !data.session;
}

export async function signOut() {
  await push();
  await sb().auth.signOut();
}

export async function syncNow() {
  if (readMeta().dirty) await push();
  else await pull();
}
