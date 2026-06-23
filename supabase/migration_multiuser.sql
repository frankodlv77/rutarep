-- RutaRep — Migración Multi-usuario
-- Ejecutar en SQL Editor de Supabase DESPUÉS del schema.sql inicial
-- Convierte la app en SaaS: cada usuario ve solo sus propios datos

-- =============================================
-- 1. AGREGAR user_id A TABLAS
-- =============================================

alter table clientes      add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table rutas         add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table historial     add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table sesion_activa add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- sesion_activa: cambiar unique de (fecha_iso) a (user_id, fecha_iso)
-- Necesario para que dos usuarios puedan tener sesión el mismo día
alter table sesion_activa drop constraint if exists sesion_activa_fecha_iso_key;
alter table sesion_activa add constraint if not exists sesion_activa_user_fecha_unique
  unique (user_id, fecha_iso);

-- =============================================
-- 2. ELIMINAR POLÍTICAS PERMISIVAS ANTERIORES
-- =============================================

drop policy if exists "allow_all" on clientes;
drop policy if exists "allow_all" on rutas;
drop policy if exists "allow_all" on ruta_clientes;
drop policy if exists "allow_all" on historial;
drop policy if exists "allow_all" on sesion_activa;

-- =============================================
-- 3. POLÍTICAS RLS POR usuario (auth.uid())
-- =============================================

-- clientes
create policy "own_clientes" on clientes
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- rutas
create policy "own_rutas" on rutas
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ruta_clientes (no tiene user_id propio — se aísla via JOIN a rutas)
create policy "own_ruta_clientes" on ruta_clientes
  for all
  using (
    exists (
      select 1 from rutas
      where rutas.id = ruta_clientes.ruta_id
        and rutas.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from rutas
      where rutas.id = ruta_clientes.ruta_id
        and rutas.user_id = auth.uid()
    )
  );

-- historial
create policy "own_historial" on historial
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- sesion_activa
create policy "own_sesion_activa" on sesion_activa
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =============================================
-- 4. STORAGE — mantener política permisiva
-- (las fotos se identifican por path, no por usuario)
-- =============================================
-- Sin cambios necesarios en storage.objects
