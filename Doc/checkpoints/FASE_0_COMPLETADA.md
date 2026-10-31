# Fase 0 completada · Nova Assistant

Fecha de cierre: 2026-10-31

## Compilación

`node_modules` ya existía, por lo que no se ejecutó `npm install`. `npm run build` fue bloqueado por la política de ejecución de PowerShell; el comando equivalente `npm.cmd run build` terminó correctamente. Next.js compiló, validó tipos y generó las páginas sin errores. No se modificaron código, configuración ni dependencias.

## Variables y claves

Se inspeccionaron solo nombres y si las asignaciones estaban vacías; ningún valor se mostró ni se copió.

- En `.env.local` están configuradas con asignación no vacía `GEMINI_API_KEY`, `BLOB_READ_WRITE_TOKEN` y las cadenas de conexión `NOVAASSISTANT_POSTGRES_URL` / `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`.
- `.env.example` no declara Gemini, Blob ni variables Postgres.
- `GEMINI_API_KEY` autenticó correctamente contra la API de modelos. `BLOB_READ_WRITE_TOKEN` se confirmó presente, pero no se probó una operación con Blob.
- `NOVAASSISTANT_POSTGRES_URL_NON_POOLING` ejecutó consultas de solo lectura; no se imprimió la URL. `NOVAASSISTANT_POSTGRES_URL` identifica un Transaction pooler en el puerto 6543, pero la conexión PostgreSQL agotó el tiempo de espera desde esta sesión.
- No se puede verificar desde el repositorio si las variables están creadas correctamente en Vercel.

## pgvector

Se verificó con consultas de solo lectura a Supabase: pgvector **está disponible** (`pg_available_extensions`) y **no está instalada** (`pg_extension`). P01 debe habilitarla con `CREATE EXTENSION IF NOT EXISTS vector`. Se usó un cliente `pg` temporal; no se modificaron dependencias.

## Decisiones derivadas

- Login existente: `/login`; autenticación Supabase SSR. La función `getCurrentUser()` devuelve el `User` de Supabase o `null`.
- El login existente redirige a `/dashboard` o `/home`; el plan requiere `/nova` en la fase correspondiente.
- Existe `middleware.ts`, pero solo refresca sesión; aún no autoriza rutas Nova. No hay `proxy.ts`.
- Continuar migraciones en `supabase/migrations/`; no hay script aplicador. P01 debe establecer `npm run db:migrar` o documentar el mecanismo de Supabase CLI disponible.
- Variable comprobada para aplicar migraciones P01: `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`. Para el runtime, la variable prevista es `NOVAASSISTANT_POSTGRES_URL` (Transaction pooler, puerto 6543), pero su conexión dio timeout desde esta sesión; diagnosticar antes de usarla en producción.
- Variable de Gemini: `GEMINI_API_KEY`.
- La clave Gemini autentica. El plan menciona modelos que no aparecen disponibles (`text-embedding-004`, `gemini-1.5-flash`); la API lista `gemini-embedding-001` y `gemini-2.5-flash`. Revisar antes de P03, no bloquea P01.
- Extracción PDF elegida: `unpdf` (preferida por el plan, aún no instalada).
- M1: `20261003130000_nova_extension_tablas.sql`.
- M2: `20261003132000_nova_vector_seguridad.sql`.
- Alias de `lib`: `@/lib/...` (`@/*` → `src/*`).
- No existen aún las rutas Nova, el pool de `pg` ni las tablas de Nova en las migraciones del repositorio.

## Condición para iniciar P01

P01 está habilitado: la conexión directa/no-pooling y la autenticación Gemini fueron verificadas, y pgvector está disponible para instalar. Aplicar las migraciones mediante `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`. No usar el Transaction pooler hasta resolver su timeout. La vigencia de `BLOB_READ_WRITE_TOKEN` y las variables configuradas en Vercel no se comprobó; no son requisitos para P01.
