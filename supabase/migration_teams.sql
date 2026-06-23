-- ================================================================
-- TEAMS + ROLES MIGRATION
-- Ejecutar en Supabase SQL Editor
-- ================================================================

-- 1. Agregar columna rol a profiles (si no existe)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'repartidor'
  CHECK (rol IN ('repartidor', 'encargado'));

-- 2. Tabla equipos (un encargado = un equipo)
CREATE TABLE IF NOT EXISTS equipos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(owner_id)
);

-- 3. Miembros del equipo
CREATE TABLE IF NOT EXISTS equipo_miembros (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id  uuid NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol        text NOT NULL CHECK (rol IN ('repartidor', 'encargado')),
  joined_at  timestamptz DEFAULT now(),
  UNIQUE(equipo_id, user_id)
);

-- 4. Invitaciones
CREATE TABLE IF NOT EXISTS invitaciones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id  uuid NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  uses       int NOT NULL DEFAULT 0,
  max_uses   int NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- RLS
-- ================================================================

ALTER TABLE equipos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipo_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitaciones    ENABLE ROW LEVEL SECURITY;

-- equipos: solo el owner ve/modifica su equipo
CREATE POLICY "own_team" ON equipos
  USING (owner_id = auth.uid());

-- equipo_miembros: el encargado (owner) ve todos, repartidor ve los de su equipo
CREATE POLICY "team_member_select" ON equipo_miembros FOR SELECT
  USING (
    user_id = auth.uid()
    OR equipo_id IN (SELECT id FROM equipos WHERE owner_id = auth.uid())
  );

CREATE POLICY "team_member_insert" ON equipo_miembros FOR INSERT
  WITH CHECK (
    equipo_id IN (SELECT id FROM equipos WHERE owner_id = auth.uid())
  );

CREATE POLICY "team_member_delete" ON equipo_miembros FOR DELETE
  USING (
    equipo_id IN (SELECT id FROM equipos WHERE owner_id = auth.uid())
  );

-- invitaciones: solo el owner del equipo puede crear/ver
CREATE POLICY "own_invitations" ON invitaciones
  USING (equipo_id IN (SELECT id FROM equipos WHERE owner_id = auth.uid()));

-- ================================================================
-- ENCARGADO puede ver historial y sesion_activa de sus repartidores
-- ================================================================

-- Política adicional en historial para lectura del encargado
CREATE POLICY "encargado_read_team_historial" ON historial FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT em.user_id FROM equipo_miembros em
      JOIN equipos e ON e.id = em.equipo_id
      WHERE e.owner_id = auth.uid()
    )
  );

-- Política adicional en sesion_activa para lectura del encargado
CREATE POLICY "encargado_read_team_sesion" ON sesion_activa FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT em.user_id FROM equipo_miembros em
      JOIN equipos e ON e.id = em.equipo_id
      WHERE e.owner_id = auth.uid()
    )
  );

-- ================================================================
-- FUNCIÓN: Aceptar invitación (security definer para bypass RLS)
-- El repartidor llama esto con el token, se agrega al equipo
-- ================================================================

CREATE OR REPLACE FUNCTION accept_invitation(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv    invitaciones%ROWTYPE;
  v_equipo equipos%ROWTYPE;
  v_uid    uuid := auth.uid();
BEGIN
  -- Buscar invitación válida
  SELECT * INTO v_inv FROM invitaciones
  WHERE token = p_token AND status = 'pending' AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Invitación inválida o expirada');
  END IF;

  IF v_inv.uses >= v_inv.max_uses THEN
    RETURN json_build_object('ok', false, 'error', 'Esta invitación ya fue usada');
  END IF;

  -- Buscar equipo
  SELECT * INTO v_equipo FROM equipos WHERE id = v_inv.equipo_id;

  -- Verificar que no sea el mismo owner
  IF v_equipo.owner_id = v_uid THEN
    RETURN json_build_object('ok', false, 'error', 'Sos el encargado de este equipo');
  END IF;

  -- Insertar miembro (ignorar si ya existe)
  INSERT INTO equipo_miembros (equipo_id, user_id, rol)
  VALUES (v_inv.equipo_id, v_uid, 'repartidor')
  ON CONFLICT (equipo_id, user_id) DO NOTHING;

  -- Incrementar usos
  UPDATE invitaciones SET uses = uses + 1,
    status = CASE WHEN uses + 1 >= max_uses THEN 'accepted' ELSE status END
  WHERE id = v_inv.id;

  RETURN json_build_object('ok', true, 'equipo_nombre', v_equipo.nombre);
END;
$$;

-- ================================================================
-- FUNCIÓN: Crear equipo (encargado al registrarse/primer login)
-- ================================================================

CREATE OR REPLACE FUNCTION create_equipo(p_nombre text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id  uuid;
  v_uid uuid := auth.uid();
BEGIN
  INSERT INTO equipos (nombre, owner_id) VALUES (p_nombre, v_uid)
  ON CONFLICT (owner_id) DO UPDATE SET nombre = EXCLUDED.nombre
  RETURNING id INTO v_id;

  -- Agregar al encargado como miembro también
  INSERT INTO equipo_miembros (equipo_id, user_id, rol)
  VALUES (v_id, v_uid, 'encargado')
  ON CONFLICT (equipo_id, user_id) DO NOTHING;

  RETURN v_id;
END;
$$;

-- ================================================================
-- FUNCIÓN: Generar nueva invitación
-- ================================================================

CREATE OR REPLACE FUNCTION create_invitation(p_max_uses int DEFAULT 1)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_equipo_id uuid;
  v_token     text;
BEGIN
  SELECT id INTO v_equipo_id FROM equipos WHERE owner_id = auth.uid();

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'No tenés un equipo creado');
  END IF;

  INSERT INTO invitaciones (equipo_id, max_uses)
  VALUES (v_equipo_id, p_max_uses)
  RETURNING token INTO v_token;

  RETURN json_build_object('ok', true, 'token', v_token);
END;
$$;
