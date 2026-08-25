-- ================================================================
-- DEUDA: tracking de fecha de inicio + configuración recordatorio
-- Ejecutar en Supabase SQL Editor
-- ================================================================

-- Cuándo empezó la deuda (se setea cuando deuda pasa de 0 a positivo)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS deuda_desde timestamptz;

-- Días de tolerancia antes de mostrar alerta (configurable por usuario)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recordatorio_deuda_dias int DEFAULT 3;
