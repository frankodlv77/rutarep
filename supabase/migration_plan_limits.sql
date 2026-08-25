-- ================================================================
-- PLAN MEMBER LIMITS ENFORCEMENT
-- Ejecutar en Supabase SQL Editor
-- ================================================================

-- Tabla de límites por plan. Fuente única de verdad para DB y frontend.
-- free / solo       → 5 repartidores
-- equipo-chico      → 5 repartidores
-- equipo-grande     → 30 repartidores
-- ================================================================

CREATE OR REPLACE FUNCTION get_plan_member_limit(p_plan text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'equipo-chico'  THEN 5
    WHEN 'equipo-grande' THEN 30
    ELSE 5
  END;
$$;

-- ================================================================
-- accept_invitation: agrega chequeo de límite de miembros por plan
-- ================================================================

CREATE OR REPLACE FUNCTION accept_invitation(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv          invitaciones%ROWTYPE;
  v_equipo       equipos%ROWTYPE;
  v_uid          uuid := auth.uid();
  v_owner_plan   text;
  v_member_count int;
  v_limit        int;
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

  IF v_equipo.owner_id = v_uid THEN
    RETURN json_build_object('ok', false, 'error', 'Sos el encargado de este equipo');
  END IF;

  -- Si ya es miembro, no contar como nuevo ni quemar uso
  IF EXISTS (
    SELECT 1 FROM equipo_miembros
    WHERE equipo_id = v_inv.equipo_id AND user_id = v_uid
  ) THEN
    RETURN json_build_object('ok', true, 'equipo_nombre', v_equipo.nombre);
  END IF;

  -- Obtener plan del encargado y calcular límite
  SELECT COALESCE(plan, 'free') INTO v_owner_plan
  FROM profiles WHERE id = v_equipo.owner_id;

  v_limit := get_plan_member_limit(v_owner_plan);

  -- Contar repartidores actuales (no contar al encargado)
  SELECT COUNT(*) INTO v_member_count
  FROM equipo_miembros
  WHERE equipo_id = v_inv.equipo_id AND rol = 'repartidor';

  IF v_member_count >= v_limit THEN
    RETURN json_build_object(
      'ok',      false,
      'error',   'Este equipo alcanzó el límite de repartidores para su plan actual',
      'limit',   v_limit,
      'current', v_member_count
    );
  END IF;

  -- Insertar miembro
  INSERT INTO equipo_miembros (equipo_id, user_id, rol)
  VALUES (v_inv.equipo_id, v_uid, 'repartidor');

  -- Incrementar usos
  UPDATE invitaciones
  SET uses   = uses + 1,
      status = CASE WHEN uses + 1 >= max_uses THEN 'accepted' ELSE status END
  WHERE id = v_inv.id;

  RETURN json_build_object('ok', true, 'equipo_nombre', v_equipo.nombre);
END;
$$;

-- ================================================================
-- create_invitation: bloquea si el equipo ya está en el límite
-- ================================================================

CREATE OR REPLACE FUNCTION create_invitation(p_max_uses int DEFAULT 1)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_equipo_id    uuid;
  v_token        text;
  v_owner_plan   text;
  v_member_count int;
  v_limit        int;
BEGIN
  SELECT id INTO v_equipo_id FROM equipos WHERE owner_id = auth.uid();

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'No tenés un equipo creado');
  END IF;

  SELECT COALESCE(plan, 'free') INTO v_owner_plan
  FROM profiles WHERE id = auth.uid();

  v_limit := get_plan_member_limit(v_owner_plan);

  SELECT COUNT(*) INTO v_member_count
  FROM equipo_miembros
  WHERE equipo_id = v_equipo_id AND rol = 'repartidor';

  IF v_member_count >= v_limit THEN
    RETURN json_build_object(
      'ok',      false,
      'error',   'Alcanzaste el límite de repartidores de tu plan',
      'limit',   v_limit,
      'current', v_member_count
    );
  END IF;

  INSERT INTO invitaciones (equipo_id, max_uses)
  VALUES (v_equipo_id, p_max_uses)
  RETURNING token INTO v_token;

  RETURN json_build_object(
    'ok',      true,
    'token',   v_token,
    'limit',   v_limit,
    'current', v_member_count
  );
END;
$$;
