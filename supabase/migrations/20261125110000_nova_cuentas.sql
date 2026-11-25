-- M25 (PLAN_AMPLIACION 6.21, 5.14 y 7.16; E20c-2): cuentas con niveles, administración y registro de acciones.
-- Solo aditiva: master no usa estas tablas (su acceso sigue siendo la lista de correos). Todas con RLS y sin
-- políticas: solo el servidor las lee. Las funciones nuevas no se pueden llamar desde la API pública de Supabase.
-- El correo del dueño es el incorporado en src/modules/auth/admin.ts (CORREO_DUENO).

-- 1. Una fila por cuenta: estado, nivel, permiso de la clave del proyecto y la contraseña temporal (E20c-3).
CREATE TABLE IF NOT EXISTS cuentas (
  usuario_id              UUID         PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  estado                  VARCHAR(10)  NOT NULL DEFAULT 'pendiente',
  bloqueada_en            TIMESTAMPTZ,
  nivel                   VARCHAR(7)   NOT NULL DEFAULT 'usuario',
  usa_clave_proyecto      BOOLEAN      NOT NULL DEFAULT false,
  debe_cambiar_contrasena BOOLEAN      NOT NULL DEFAULT false,
  temporal_vence_en       TIMESTAMPTZ,
  temporal_usada_en       TIMESTAMPTZ,
  ultimo_acceso           TIMESTAMPTZ,
  creada_en               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT cuentas_estado_valido CHECK (estado IN ('activa', 'pendiente', 'bloqueada')),
  CONSTRAINT cuentas_nivel_valido CHECK (nivel IN ('dueno', 'admin', 'usuario')),
  CONSTRAINT cuentas_bloqueo_con_fecha CHECK ((estado = 'bloqueada') = (bloqueada_en IS NOT NULL)),
  CONSTRAINT cuentas_temporal_con_vencimiento CHECK (temporal_usada_en IS NULL OR temporal_vence_en IS NOT NULL)
);
ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
-- Un solo dueño (RB-93).
CREATE UNIQUE INDEX IF NOT EXISTS cuentas_un_dueno ON cuentas (nivel) WHERE nivel = 'dueno';

-- El dueño: solo la cuenta del correo incorporado, siempre activa, sin bajar de nivel y sin borrar su fila
-- (salvo en el simulacro de restauración, que vacía las tablas dentro de una transacción que se revierte).
CREATE OR REPLACE FUNCTION nova_proteger_cuentas() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  correo TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.nivel = 'dueno' AND coalesce(current_setting('nova.restaurando', true), '') <> 'si'
       AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.usuario_id) THEN
      RAISE EXCEPTION 'La cuenta del dueño no se puede eliminar.';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.usuario_id <> OLD.usuario_id THEN
      RAISE EXCEPTION 'La cuenta de una fila no se cambia.';
    END IF;
    IF OLD.nivel = 'dueno' AND NEW.nivel <> 'dueno' THEN
      RAISE EXCEPTION 'Al dueño no se le puede bajar el nivel.';
    END IF;
  END IF;
  IF NEW.nivel = 'dueno' THEN
    SELECT lower(u.email) INTO correo FROM auth.users u WHERE u.id = NEW.usuario_id;
    IF correo IS DISTINCT FROM 'juandelarosa1617@gmail.com' THEN
      RAISE EXCEPTION 'Solo la cuenta del correo incorporado puede ser la dueña.';
    END IF;
    IF NEW.estado <> 'activa' THEN
      RAISE EXCEPTION 'La cuenta del dueño no se puede bloquear.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cuentas_proteger ON cuentas;
CREATE TRIGGER cuentas_proteger BEFORE INSERT OR UPDATE OR DELETE ON cuentas
  FOR EACH ROW EXECUTE FUNCTION nova_proteger_cuentas();

-- 2. Las cuentas que ya existen quedan activas; la del dueño, con nivel dueño.
INSERT INTO cuentas (usuario_id, estado, nivel, creada_en)
SELECT u.id, 'activa', CASE WHEN lower(u.email) = 'juandelarosa1617@gmail.com' THEN 'dueno' ELSE 'usuario' END, u.created_at
FROM auth.users u
ON CONFLICT (usuario_id) DO NOTHING;

-- 3. Toda cuenta nueva nace pendiente (RB-92, condición del usuario del 2026-11-25): no entra hasta que la
--    habilite un administrador. Las que llegan con Google (E20c-3, ya pasaron el gancho del tope) nacen activas.
CREATE OR REPLACE FUNCTION public.nova_cuenta_nueva() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  dueno BOOLEAN := lower(coalesce(NEW.email, '')) = 'juandelarosa1617@gmail.com';
BEGIN
  INSERT INTO public.cuentas (usuario_id, estado, nivel)
  VALUES (
    NEW.id,
    CASE WHEN dueno OR coalesce(NEW.raw_app_meta_data ->> 'provider', '') = 'google' THEN 'activa' ELSE 'pendiente' END,
    CASE WHEN dueno THEN 'dueno' ELSE 'usuario' END
  )
  ON CONFLICT (usuario_id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.nova_cuenta_nueva() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS nova_cuenta_nueva ON auth.users;
CREATE TRIGGER nova_cuenta_nueva AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.nova_cuenta_nueva();

-- 4. Topes y estado de la limpieza diaria (una sola fila).
CREATE TABLE IF NOT EXISTS administracion (
  id               SMALLINT     PRIMARY KEY DEFAULT 1,
  tope_cuentas     SMALLINT     NOT NULL DEFAULT 15,
  tope_espacio_mb  SMALLINT     NOT NULL DEFAULT 30,
  actualizada_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ultima_limpieza  TIMESTAMPTZ,
  filas_limpiadas  INTEGER,
  CONSTRAINT administracion_una_fila CHECK (id = 1),
  CONSTRAINT administracion_tope_cuentas CHECK (tope_cuentas BETWEEN 1 AND 1000),
  CONSTRAINT administracion_tope_espacio CHECK (tope_espacio_mb BETWEEN 1 AND 500),
  CONSTRAINT administracion_filas_limpiadas CHECK (filas_limpiadas IS NULL OR filas_limpiadas >= 0)
);
ALTER TABLE administracion ENABLE ROW LEVEL SECURITY;
INSERT INTO administracion (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 5. Registro de acciones (RB-89): quién, qué, sobre qué correo y cuándo. Sin FK: queda aunque se borre la cuenta.
CREATE TABLE IF NOT EXISTS acciones_admin (
  id         BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id   UUID          NOT NULL,
  accion     VARCHAR(20)   NOT NULL,
  correo     VARCHAR(320),
  detalle    JSONB,
  creada_en  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT acciones_admin_accion_valida CHECK (accion IN (
    'bloquear', 'desbloquear', 'eliminar', 'topes', 'habilitar', 'nombrar_admin', 'quitar_admin',
    'permiso_clave_on', 'permiso_clave_off', 'contrasena_temporal'
  )),
  CONSTRAINT acciones_admin_correo_segun_accion CHECK ((accion = 'topes') = (correo IS NULL))
);
ALTER TABLE acciones_admin ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_acciones_admin_fecha ON acciones_admin (creada_en DESC);

-- 6. Espacio estimado por cuenta (7.16): el tamaño de sus filas en cada tabla con usuario_id, más sus fragmentos
--    con el vector otra vez por el índice HNSW. Postgres no reparte el espacio por usuario: es una estimación.
CREATE OR REPLACE FUNCTION nova_espacio(usuario UUID DEFAULT NULL)
RETURNS TABLE (usuario_id UUID, bytes BIGINT)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  tabla TEXT;
  partes TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR tabla IN
    SELECT c.relname FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attname = 'usuario_id' AND NOT a.attisdropped
    ORDER BY c.relname
  LOOP
    partes := partes || format('SELECT x.usuario_id, pg_column_size(x.*)::bigint AS b FROM public.%I x WHERE $1 IS NULL OR x.usuario_id = $1', tabla);
  END LOOP;
  partes := partes || 'SELECT d.usuario_id, (pg_column_size(f.*) + coalesce(pg_column_size(f.vector), 0))::bigint FROM public.fragmentos_pdf f JOIN public.documentos d ON d.id = f.documento_id WHERE $1 IS NULL OR d.usuario_id = $1'::text;
  RETURN QUERY EXECUTE
    'SELECT s.usuario_id, sum(s.b)::bigint FROM (' || array_to_string(partes, ' UNION ALL ') || ') s WHERE s.usuario_id IS NOT NULL GROUP BY s.usuario_id'
    USING usuario;
END $$;
REVOKE ALL ON FUNCTION nova_espacio(UUID) FROM PUBLIC, anon, authenticated;

-- 7. Gancho "Before User Created" de Supabase Auth (se activa en E20c-3): con el tope de cuentas alcanzado, la
--    cuenta no se crea (RB-81). Los administradores no cuentan para el tope.
CREATE OR REPLACE FUNCTION public.nova_antes_de_crear_usuario(event JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  tope INTEGER;
  usadas INTEGER;
BEGIN
  IF lower(coalesce(event -> 'user' ->> 'email', '')) = 'juandelarosa1617@gmail.com' THEN
    RETURN '{}'::jsonb;
  END IF;
  SELECT a.tope_cuentas INTO tope FROM public.administracion a WHERE a.id = 1;
  SELECT count(*) INTO usadas FROM public.cuentas c WHERE c.nivel = 'usuario';
  IF tope IS NOT NULL AND usadas >= tope THEN
    RETURN jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Nova llegó al máximo de cuentas por ahora. Escríbele al administrador.'
    ));
  END IF;
  RETURN '{}'::jsonb;
END $$;
REVOKE ALL ON FUNCTION public.nova_antes_de_crear_usuario(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nova_antes_de_crear_usuario(JSONB) TO supabase_auth_admin;
GRANT SELECT ON public.administracion, public.cuentas TO supabase_auth_admin;

-- 8. Limpieza diaria (3:00 a. m. de Bogotá): el registro de pg_cron de más de 7 días y las acciones de más de
--    180 días. Anota cuándo corrió y cuántas filas del registro de cron borró, para el bloque "Sistema".
CREATE OR REPLACE FUNCTION nova_limpiar_registros() RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  n INTEGER;
BEGIN
  DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.acciones_admin WHERE creada_en < now() - interval '180 days';
  UPDATE public.administracion SET ultima_limpieza = now(), filas_limpiadas = n WHERE id = 1;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION nova_limpiar_registros() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('nova-limpieza', '0 8 * * *', 'SELECT public.nova_limpiar_registros()');
