-- M28 (E21, revisión de seguridad): la tabla del registro de migraciones estaba sin RLS y con permisos para los
-- roles de la API pública de Supabase: con la clave publicable se podía leer, escribir y borrar.
-- Compatible con master: db:migrar se conecta como dueño de la tabla, al que RLS no afecta.
-- Aprobada y aplicada el 2026-11-26.

CREATE TABLE IF NOT EXISTS _migrations (nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE _migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON _migrations FROM anon, authenticated;

-- Funciones de disparador de los perfiles antiguos (aviso del asesor de Supabase): nadie las llama desde la API.
REVOKE ALL ON FUNCTION public.handle_auth_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_auth_user_public_account() FROM PUBLIC, anon, authenticated;
