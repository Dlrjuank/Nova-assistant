# /data — JSON Database Layer

Esta carpeta funciona como la capa de persistencia del sistema. Cada archivo `.json` representa una colección.

## Reglas

- Un archivo por colección en singular y kebab-case.
- Cada archivo debe tener `_meta` y `records`.
- Los IDs usan el prefijo de la colección, por ejemplo `ex_001`.
- El tamaño recomendado por archivo es de 5 MB como máximo.
- Los esquemas Zod viven en `_schema/`.
- Los backups automáticos viven en `_backups/` y no se versionan.

## Flujo CRUD

```text
Request -> API Route -> esquema Zod -> json-db -> archivo JSON
                                      |
                                      +-> backup antes de escribir
```

Para crear una colección, agrega `data/nombre.json`, su esquema en `data/_schema/` y registra el esquema en `registry.ts`.

El registro, inicio y cierre de sesión usan Supabase Auth. La migración `supabase/migrations/20261003110000_create_profiles.sql` crea `public.profiles`, sincronizada con `auth.users`, y aplica políticas RLS para que cada usuario lea únicamente su propio perfil. El antiguo `data/user.json` es almacenamiento local legado y no se migra automáticamente.

Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` (la aplicación también admite los nombres con prefijo que ya existan allí). Ejecuta la migración una vez en el SQL Editor del proyecto Supabase y agrega las URL absolutas de callback (`http://localhost:3000/auth/callback` y la URL equivalente de producción) a sus Redirect URLs para permitir la confirmación de correo.

En Vercel el sistema funciona en modo lectura: la persistencia de producción requiere una base de datos o almacenamiento externo.
