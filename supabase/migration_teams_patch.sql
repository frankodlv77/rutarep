-- ================================================================
-- PATCH: Profiles visibles para miembros del mismo equipo
-- Ejecutar DESPUÉS de migration_teams.sql
-- ================================================================

-- El encargado necesita ver los perfiles de sus repartidores (nombres/negocio)
-- Los repartidores del mismo equipo se pueden ver entre ellos

-- Primero eliminar la política restrictiva original si existe
DROP POLICY IF EXISTS "own_profile" ON profiles;

-- Nueva política: propio perfil siempre; encargado ve los de sus repartidores
CREATE POLICY "view_own_and_team_profiles" ON profiles FOR SELECT
  USING (
    -- Siempre puedo ver el mío
    id = auth.uid()
    OR
    -- Solo el encargado ve los perfiles de sus repartidores
    id IN (
      SELECT em.user_id
      FROM equipo_miembros em
      JOIN equipos e ON e.id = em.equipo_id
      WHERE e.owner_id = auth.uid()
    )
  );

-- UPDATE: solo el propio perfil
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  USING (id = auth.uid());

-- INSERT: solo el propio perfil
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());
