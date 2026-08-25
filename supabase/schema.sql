-- VoraRep — Schema Supabase
-- Ejecutar en el SQL Editor del proyecto Supabase

-- =============================================
-- TABLAS
-- =============================================

create table if not exists clientes (
  id          uuid primary key default gen_random_uuid(),
  codigo      text,
  nombre      text not null,
  telefono    text,
  direccion   text,
  zona        text default 'Centro',
  notas       text,
  deuda       numeric(12,2) default 0,
  lat         double precision,
  lon         double precision,
  created_at  timestamptz default now()
);

create table if not exists rutas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  created_at  timestamptz default now()
);

create table if not exists ruta_clientes (
  id          uuid primary key default gen_random_uuid(),
  ruta_id     uuid references rutas(id) on delete cascade,
  cliente_id  uuid references clientes(id) on delete cascade,
  orden       int default 0,
  unique(ruta_id, cliente_id)
);

create table if not exists historial (
  id              uuid primary key default gen_random_uuid(),
  fecha           text not null,
  comision_pct    float default 4,
  total_monto     numeric(12,2) default 0,
  total_entregados int default 0,
  total_clientes   int default 0,
  entregas        jsonb default '[]',
  created_at      timestamptz default now()
);

-- =============================================
-- MIGRACIONES (ejecutar si las tablas ya existen)
-- =============================================

-- Fecha ISO en historial (para filtros confiables, sin depender de strings en español)
alter table historial add column if not exists fecha_iso text;

-- Sesión activa: guarda el progreso del día en tiempo real
-- Permite recuperar entregas si la app se cierra antes de finalizar
create table if not exists sesion_activa (
  id           uuid primary key default gen_random_uuid(),
  fecha_iso    text not null unique,
  hoy          jsonb not null default '[]',
  entregas     jsonb not null default '{}',
  comision_pct float default 4,
  updated_at   timestamptz default now()
);
alter table sesion_activa enable row level security;
create policy "allow_all" on sesion_activa for all using (true) with check (true);

-- Si ya existe la tabla, agregar la columna telefono:
-- alter table clientes add column if not exists telefono text;

-- Agregar columnas nuevas si la tabla ya existe:
-- alter table clientes add column if not exists codigo text;
-- alter table clientes add column if not exists deuda numeric(12,2) default 0;
-- alter table clientes add column if not exists foto_url text;

-- =============================================
-- POLÍTICAS (RLS permisivo — app privada)
-- =============================================

alter table clientes  enable row level security;
alter table rutas     enable row level security;
alter table ruta_clientes enable row level security;
alter table historial enable row level security;

create policy "allow_all" on clientes      for all using (true) with check (true);
create policy "allow_all" on rutas         for all using (true) with check (true);
create policy "allow_all" on ruta_clientes for all using (true) with check (true);
create policy "allow_all" on historial     for all using (true) with check (true);

-- =============================================
-- STORAGE (bucket para fotos de entregas)
-- =============================================

insert into storage.buckets (id, name, public)
values ('fotos-entregas', 'fotos-entregas', true)
on conflict do nothing;

create policy "allow_all" on storage.objects
  for all using (bucket_id = 'fotos-entregas') with check (bucket_id = 'fotos-entregas');
