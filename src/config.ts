/**
 * Подключение к Supabase (облачная база PostgreSQL).
 *
 * URL проекта и ключ `anon public` — публичные значения: они в любом случае попадают
 * в код сайта, а доступ к данным ограничивают правила RLS в базе (см. supabase/schema.sql).
 * НЕ вставляйте сюда ключ `service_role` и пароль базы.
 *
 * Если значения пустые, приложение работает только с хранилищем браузера.
 */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const cloudConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
