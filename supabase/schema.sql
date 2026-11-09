-- Таблица для данных фитнес-трекера.
-- Выполните этот скрипт один раз: Supabase → SQL Editor → New query → вставить → Run.

create table if not exists public.fitness_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Каждый пользователь видит и меняет только свою строку.
alter table public.fitness_data enable row level security;

drop policy if exists "own row select" on public.fitness_data;
drop policy if exists "own row insert" on public.fitness_data;
drop policy if exists "own row update" on public.fitness_data;
drop policy if exists "own row delete" on public.fitness_data;

create policy "own row select" on public.fitness_data for select using (auth.uid() = user_id);
create policy "own row insert" on public.fitness_data for insert with check (auth.uid() = user_id);
create policy "own row update" on public.fitness_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row delete" on public.fitness_data for delete using (auth.uid() = user_id);

-- Удобные представления для просмотра в pgAdmin / Table Editor (только чтение).
create or replace view public.v_weight with (security_invoker = true) as
select f.user_id,
       (e->>'date')::date        as date,
       (e->>'weight')::numeric   as weight_kg,
       (e->>'waist')::numeric    as waist_cm,
       (e->>'belly')::numeric    as belly_cm,
       e->>'note'                as note
from public.fitness_data f, jsonb_array_elements(f.data->'body') e
order by date;

create or replace view public.v_workouts with (security_invoker = true) as
select f.user_id,
       (e->>'date')::date             as date,
       e->>'type'                     as day,
       e->>'feeling'                  as feeling,
       jsonb_array_length(e->'exercises') as exercises,
       (e->>'cardioMinutes')::int     as cardio_min,
       e->>'note'                     as note
from public.fitness_data f, jsonb_array_elements(f.data->'workouts') e
order by date;

create or replace view public.v_food with (security_invoker = true) as
select f.user_id,
       (e->>'date')::date        as date,
       e->>'time'                as time,
       e->>'name'                as name,
       (e->>'kcal')::numeric     as kcal,
       (e->>'protein')::numeric  as protein_g
from public.fitness_data f, jsonb_array_elements(f.data->'food') e
order by date, time;
