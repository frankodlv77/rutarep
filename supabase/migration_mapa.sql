-- Ubicaciones en tiempo real por repartidor
CREATE TABLE IF NOT EXISTS ubicaciones (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  equipo_id  uuid NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  lat        double precision NOT NULL,
  lng        double precision NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ubicaciones ENABLE ROW LEVEL SECURITY;

-- Repartidor puede upsert su propia ubicación
CREATE POLICY "own_ubicacion" ON ubicaciones FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Encargado puede ver ubicaciones de su equipo
CREATE POLICY "encargado_read_ubicaciones" ON ubicaciones FOR SELECT USING (
  equipo_id IN (SELECT id FROM equipos WHERE owner_id = auth.uid())
);

ALTER PUBLICATION supabase_realtime ADD TABLE ubicaciones;
