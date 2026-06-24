CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  equipo_id    uuid REFERENCES equipos(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada usuario gestiona solo su propia suscripción
CREATE POLICY "own_push_sub" ON push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
