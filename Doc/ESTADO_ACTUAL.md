# Estado actual · Nova Assistant

Auditoría del repositorio para P00, contrastada con [PLAN_NOVA.md](./PLAN_NOVA.md). Se inspeccionaron los archivos y nombres de variables presentes localmente; no se copiaron valores secretos.

## 1. Versiones en `package.json`

| Paquete | Versión declarada |
|---|---|
| `next` | `^15.5.7` |
| `react` | `^19.1.0` |
| `typescript` | `^5.9.2` |
| `tailwindcss` | `^4.1.13` |
| `pg` | No existe |
| `zod` | `^4.1.8` |
| `@supabase/supabase-js` | `^2.117.2` |
| `jose` | No existe como dependencia directa |
| `bcryptjs` | No existe |
| `vitest` | `^3.2.4` |
| `@vercel/blob` | No existe como dependencia directa |
| `unpdf` | No existe |
| `pdf-parse` | No existe |
| `@google/generative-ai` (SDK Gemini) | No existe |

El build utilizó Next.js `15.5.27`, resuelto desde el rango del lockfile. `jose` y `@vercel/blob` están en `node_modules`, pero no declarados como dependencias directas en `package.json`.

## 2. Scripts de `package.json`

| Script | Comando |
|---|---|
| `dev` | `node scripts/tokenVercel.mjs && next dev` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `eslint .` |
| `format` | `prettier --write "src/**/*.{ts,tsx,css}"` |
| `type-check` | `tsc --noEmit` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `test:coverage` | `vitest run --coverage` |

No existen scripts de migración, verificación de base, prueba de reglas ni prueba RAG.

## 3. Estructura existente (hasta tres niveles)

El código de aplicación vive bajo `src/`; no hay `app/`, `lib/` ni `components/` en la raíz.
La carpeta de documentación del checkout se llama `Doc/` (D mayúscula); algunas referencias del plan usan `doc/`. Windows no distingue esas rutas, pero sistemas sensibles a mayúsculas sí.

```text
src/
├── app/
│   ├── (dashboard)/dashboard/, status/
│   ├── api/admin/users/, auth/{login,logout,password,recuperar,register,resend-confirmation,restablecer,session}/
│     ├── api/correo/prueba/, data/[collection]/, health/
│   ├── auth/callback/
│   ├── home/, login/, prueba-correo/, recuperar-contrasena/
│   ├── register/, restablecer-contrasena/
│   ├── globals.css, layout.tsx, page.tsx
├── components/
│   ├── admin/UserTable.tsx
│   ├── email/TestEmailForm.tsx
│   ├── home/{HolaMundo,UserPortal}.tsx
│   └── login/{ChangePasswordForm,LoginForm,LogoutButton,PasswordResetForm,RecoveryRequestForm,RegisterForm}.tsx
├── lib/
│   ├── __tests__/json-db.test.ts
│   ├── supabase/{admin,config,server}.ts (+ config.test.ts)
│   ├── correo.ts, dataService.ts, json-db.ts, plantillasCorreo.ts
│   ├── tokenRecuperacion.ts (+ test), types.ts, urlBase.ts, utils.ts
├── modules/
│   ├── auth/{admin,session}.ts (+ tests)
│   └── notes/{index,service,types}.ts
├── styles/tokens.ts
└── test/setup.ts

supabase/
├── migrations/
│   ├── 20261003110000_create_profiles.sql
│   ├── 20261003112000_create_users.sql
│   └── 20261003124000_add_user_profile_fields.sql
└── restablecimientos_contrasena.sql

scripts/
└── tokenVercel.mjs
```

No existe `src/components/ui/`. En el nivel inspeccionado tampoco existen `app/nova/` ni `app/api/nova/`.

## 4. Alias de importación

En `tsconfig.json`:

- `@/*` → `./src/*`
- `@data/*` → `./data/*`

## 5. Autenticación

- Archivos principales: `src/app/login/page.tsx`, `src/components/login/LoginForm.tsx`, `src/components/login/LogoutButton.tsx`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/session/route.ts`, `src/modules/auth/session.ts`, `src/lib/supabase/{config,server,admin}.ts` y `middleware.ts`.
- Mecanismo: Supabase Auth con `@supabase/ssr`; el servidor valida con `supabase.auth.getUser()`. El middleware refresca tokens, pero no es una puerta de autorización para `/nova` ni las API.
- Cookie: nombre administrado por Supabase SSR, con forma `sb-<project-ref>-auth-token` (puede dividirse en cookies con sufijo numérico); el proyecto no fija manualmente otro nombre.
- Lector de sesión: `getCurrentUser()` en `src/modules/auth/session.ts`; devuelve `Promise<User | null>`. Devuelve el usuario de Supabase o `null` ante sesión ausente/no autorizada; otros errores de verificación se lanzan.
- Página de login: `/login` (`src/app/login/page.tsx`).
- Después de autenticar: `src/components/login/LoginForm.tsx`, línea 60, envía administradores a `/dashboard` y los demás usuarios a `/home`. No redirige a `/nova` todavía.
- Middleware: existe `middleware.ts`. El matcher es `'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'`; cubre rutas salvo esos recursos excluidos. La implementación obtiene el usuario para refrescar la sesión, sin redirección de acceso.
- Cierre: `LogoutButton` hace `POST /api/auth/logout`; la ruta llama `supabase.auth.signOut()` y el cliente navega a `/login`.

## 6. Acceso a datos

- Cliente SSR: `src/lib/supabase/server.ts`, que crea un `createServerClient` de `@supabase/ssr` y utiliza cookies.
- Cliente administrativo: `src/lib/supabase/admin.ts`, que crea `createClient` de `@supabase/supabase-js` con la clave de servicio.
- No se encontró un cliente de navegador dedicado.
- El acceso de datos actual utiliza Supabase JS; `pg` no está declarado ni instalado y no hay pool PostgreSQL.
- `src/lib/dataService.ts` existe y actualmente gestiona operaciones de recuperación de contraseña en Supabase.
- Archivo de pool: No existe.

## 7. Migraciones

- Carpeta: `supabase/migrations/`.
- Migraciones existentes: `20261003110000_create_profiles.sql`, `20261003112000_create_users.sql`, `20261003124000_add_user_profile_fields.sql`; numeración temporal hasta `20261003124000`.
- También existe `supabase/restablecimientos_contrasena.sql`, fuera de la carpeta de migraciones.
- Tabla de control: el repositorio no la define ni registra su estado. Supabase CLI normalmente mantiene `supabase_migrations.schema_migrations`, pero su existencia/estado remoto no se pudo verificar.
- Aplicación: No existe script npm, página ni configuración `supabase/config.toml` que aplique estas migraciones. El mecanismo a continuar será `supabase/migrations/`; P01 debe establecer el comando `npm run db:migrar` según el plan, o documentar el mecanismo efectivamente disponible.

## 8. Variables de entorno

Solo se listan nombres; nunca valores.

**Nombres presentes en `.env.local`:**

`BLOB_READ_WRITE_TOKEN`, `GEMINI_API_KEY`, `NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_ANON_KEY`, `NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL`, `NOVAASSISTANT_POSTGRES_DATABASE`, `NOVAASSISTANT_POSTGRES_HOST`, `NOVAASSISTANT_POSTGRES_PASSWORD`, `NOVAASSISTANT_POSTGRES_PRISMA_URL`, `NOVAASSISTANT_POSTGRES_URL`, `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`, `NOVAASSISTANT_POSTGRES_USER`, `NOVAASSISTANT_SUPABASE_ANON_KEY`, `NOVAASSISTANT_SUPABASE_JWT_SECRET`, `NOVAASSISTANT_SUPABASE_SECRET_KEY`, `NOVAASSISTANT_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ADMIN_EMAILS`, `VERCEL_OIDC_TOKEN`.

Las variables requeridas `GEMINI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `NOVAASSISTANT_POSTGRES_URL` y `NOVAASSISTANT_POSTGRES_URL_NON_POOLING` tienen asignación no vacía localmente. La clave Gemini autenticó correctamente contra la API de modelos. La conexión `NOVAASSISTANT_POSTGRES_URL_NON_POOLING` pudo ejecutar consultas de solo lectura; el valor no se mostró. La conexión del pooler fue inaccesible por timeout desde esta sesión. La presencia y vigencia de variables en Vercel no se verificó.

**Nombres presentes en `.env.example`:** `DATA_DIR`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NODE_ENV`, `SUPABASE_ADMIN_EMAILS`.

- Cadena de conexión Postgres: sí hay nombres equivalentes, `NOVAASSISTANT_POSTGRES_URL` y `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`; no existe el nombre literal `DATABASE_URL`. La primera usa un host `pooler.supabase.com` y puerto `6543` (Transaction pooler); la segunda es la directa/no-pooling. Una consulta PostgreSQL tuvo éxito usando la directa. La conexión al pooler agotó el tiempo de espera incluso después de confirmar el puerto; investigar antes de usarla desde el runtime.
- `BLOB_READ_WRITE_TOKEN`: presente y no vacío en `.env.local`; ausente de `.env.example`.
- Clave Gemini: `GEMINI_API_KEY`, presente y no vacía en `.env.local`; autenticó correctamente al consultar la API de modelos. El plan usa `text-embedding-004` y `gemini-1.5-flash`, que no aparecen en la lista disponible para esta clave. Sí aparecen `gemini-embedding-001` y `gemini-2.5-flash`; confirmar/actualizar los nombres antes de implementar P03.
- No se inspeccionó configuración de variables en Vercel; su presencia allí no se puede afirmar.

## 9. Estilos

- Tailwind CSS `^4.1.13`; `src/app/globals.css` importa `tailwindcss`.
- Fuente: Inter con `next/font/google`, configurada en `src/app/layout.tsx`.
- Tokens globales actuales: `--background: #080b14` y `--foreground: #f8fafc`, en `src/app/globals.css`. También existe `src/styles/tokens.ts`; no se hallaron tokens de color `--color-*` en CSS.
- Librería de íconos: No existe/declarada ni se encontraron imports de librerías de íconos.

## 10. Pruebas

Framework: Vitest `^3.2.4`, con `vitest.config.ts`; scripts `test`, `test:watch` y `test:coverage`. Hay pruebas para autenticación, configuración Supabase, correo, health y utilidades. No hay todavía pruebas de reglas Nova.

## 11. Conflictos con el plan

- `app/nova`: No existe.
- `app/api/nova`: No existe.
- `lib/dataService.ts`: existe como `src/lib/dataService.ts`, pero no implementa los servicios Nova.
- `components/ui`: No existe (`src/components/ui/`).
- `src/app/page.tsx`: código propio mínimo que redirige a `/login`; no es la plantilla de bienvenida de Next.js.
- Las migraciones del repositorio crean `profiles` y `users`; no crean `tareas_personales`, `documentos`, `fragmentos_pdf` ni `fuentes_web`. La existencia de esas tablas en el Supabase remoto no se pudo consultar.
- La redirección posterior al login es `/dashboard` o `/home`, no `/nova`.

## 12. Disponibilidad de pgvector

Se ejecutó mediante una conexión PostgreSQL de solo lectura usando un cliente `pg` temporal, sin añadir dependencias al proyecto:

```sql
SELECT name FROM pg_available_extensions WHERE name = 'vector';
SELECT extname FROM pg_extension WHERE extname = 'vector';
```

Resultado: `vector` **está disponible** (`pg_available_extensions`) pero **no está instalada** (`pg_extension`). P01 puede habilitarla con `CREATE EXTENSION IF NOT EXISTS vector`. La consulta se hizo por `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`; las URLs del pooler `NOVAASSISTANT_POSTGRES_URL` y `NOVAASSISTANT_POSTGRES_PRISMA_URL` agotaron el tiempo de conexión en esta sesión.

## 13. Decisiones derivadas

- Ruta de login existente: `/login` (`src/app/login/page.tsx`). El plan requiere cambiar el destino de login a `/nova` en su prompt correspondiente; no se cambia en P00.
- Protección de rutas: existe `middleware.ts` (Next.js 15); refresca la sesión Supabase, pero aún no protege las rutas Nova. No existe `proxy.ts`.
- Migraciones: continuar en `supabase/migrations/`; no hay aplicador existente. P01 deberá establecer `npm run db:migrar` o verificar y documentar el uso de Supabase CLI.
- Variable para ejecutar las migraciones P01: `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`, comprobada con consultas exitosas de solo lectura. El runtime de Vercel debería usar el Transaction pooler `NOVAASSISTANT_POSTGRES_URL`, pero la conexión desde esta sesión dio timeout y requiere diagnóstico antes de P03/producción.
- Variable Gemini: `GEMINI_API_KEY`.
- Gemini: la clave autentica; los nombres de modelo del plan (`text-embedding-004`, `gemini-1.5-flash`) no aparecen disponibles. `gemini-embedding-001` y `gemini-2.5-flash` sí aparecen en la API de modelos. Revisar la sección 10.4 del plan antes de P03; no afecta la migración P01.
- Extracción PDF: `unpdf`, preferida por el plan; no está instalada.
- M1: `20261003130000_nova_extension_tablas.sql`.
- M2: `20261003132000_nova_vector_seguridad.sql`.
- Prefijo de imports para `lib`: `@/lib/...` (alias `@/*` apunta a `src/*`).

## 14. Compilación de base

- `node_modules` ya existía; no se ejecutó `npm install`.
- `npm run build` no pudo iniciarse porque PowerShell bloquea `npm.ps1` por la política de ejecución.
- Se ejecutó el equivalente `npm.cmd run build`: **correcto**. Next.js compiló, validó tipos y generó las 20 páginas sin errores.
- No se corrigió ningún error de código/configuración ni se modificaron dependencias.
- Pruebas de conectividad de requisitos: `GEMINI_API_KEY` autenticó; `NOVAASSISTANT_POSTGRES_URL_NON_POOLING` ejecutó las consultas de pgvector; `BLOB_READ_WRITE_TOKEN` solo se verificó por presencia, no se hizo una operación de Blob.
