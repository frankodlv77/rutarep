-- Chat interno por equipo
CREATE TABLE IF NOT EXISTS mensajes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  equipo_id  uuid NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto      text NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mensajes_equipo_created ON mensajes (equipo_id, created_at DESC);

ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

-- Miembro o dueño del equipo puede leer mensajes
CREATE POLICY "team_read_mensajes" ON mensajes FOR SELECT USING (
  equipo_id IN (
    SELECT equipo_id FROM equipo_miembros WHERE user_id = auth.uid()
    UNION
    SELECT id FROM equipos WHERE owner_id = auth.uid()
  )
);

-- Miembro o dueño puede insertar mensajes (solo los propios)
CREATE POLICY "team_insert_mensajes" ON mensajes FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND equipo_id IN (
    SELECT equipo_id FROM equipo_miembros WHERE user_id = auth.uid()
    UNION
    SELECT id FROM equipos WHERE owner_id = auth.uid()
  )
);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE mensajes;
