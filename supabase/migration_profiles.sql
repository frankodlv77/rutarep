-- VoraRep — Migración tabla profiles y eliminación de cuenta
-- Ejecutar en SQL Editor de Supabase

-- =============================================
-- 1. TABLA profiles
-- =============================================

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  negocio    text,
  rol        text default 'repartidor',
  nombre     text,
  created_at timestamptz default now()
);

-- Columnas adicionales si la tabla ya existía
alter table profiles add column if not exists negocio text;
alter table profiles add column if not exists rol     text default 'repartidor';
alter table profiles add column if not exists nombre  text;

-- RLS
alter table profiles enable row level security;

drop policy if exists "own_profile" on profiles;
create policy "own_profile" on profiles
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- =============================================
-- 2. TRIGGER: auto-crear fila en profiles al registrarse
-- =============================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- =============================================
-- 3. FUNCIÓN: eliminar cuenta completa
-- (cascades en user_id eliminan clientes/rutas/historial/sesion_activa)
-- =============================================

create or replace function delete_current_user()
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
