# Estado de ejecución · Nova Assistant

| Prompt | Estado | Build | Tests | Fecha de cierre |
|---|---|---|---|---|
| P00 Auditoría | completado | correcto | No ejecutados | 2026-10-31 |
| P01 Base de datos (pgvector) | completado | correcto | 47 pasan | 2026-11-05 |
| P02 Reglas de negocio | completado | correcto | 79 pasan (32 de reglas) | 2026-11-05 |
| P03 Servidor y cliente LLM | completado | correcto | 88 pasan | 2026-11-05 |
| P04 Datos: tareas, documentos, consulta | pendiente | | | |
| P05 API | pendiente | | | |
| P06 Interfaz base y tareas | pendiente | | | |
| P07 Documentos (subida e indexación) | pendiente | | | |
| P08 Chat del asistente | pendiente | | | |
| P09 Aceptación del MVP | pendiente | | | |
| P10 Opcionales: completar tarea e índice | pendiente | | | |
| P11 Opcional: búsqueda en Wikipedia | pendiente | | | |

## Bitácora

### P00 Auditoría

- **Archivos creados:** `doc/ESTADO_ACTUAL.md`, `.github/copilot-instructions.md`, `doc/ESTADO_EJECUCION.md`, `doc/checkpoints/FASE_0_COMPLETADA.md`.
- **Archivos modificados:** ninguno.
- **Comandos ejecutados y resultado:**
  - Inspección local de nombres de variables de `.env.local` y `.env.example` (sin leer ni mostrar valores): completada.
  - `npm run build`: bloqueado por la política de ejecución de PowerShell al invocar `npm.ps1`.
  - `npm.cmd run build`: correcto; build de Next.js completado con compilación, tipos y páginas estáticas.
  - Validación de `GEMINI_API_KEY`: autenticó en la API de modelos. Los modelos nombrados en el plan no están listados; se encontraron `gemini-embedding-001` y `gemini-2.5-flash`.
  - Conexión PostgreSQL y pgvector: con un cliente `pg` temporal, la conexión `NOVAASSISTANT_POSTGRES_URL_NON_POOLING` ejecutó consultas de solo lectura; `vector` está disponible y no instalada. No se añadieron dependencias al proyecto.
  - Pooler `NOVAASSISTANT_POSTGRES_URL` (Transaction pooler/6543): intento de consulta agotó el tiempo; no usar hasta diagnosticar.
  - `BLOB_READ_WRITE_TOKEN`: presente localmente; no se probó una operación de Blob.
- **Problemas y resolución:** `npm run build` fue bloqueado por la política de ejecución de PowerShell; `npm.cmd run build` completó correctamente. Se pudo comprobar pgvector instalando el cliente temporal fuera del proyecto, que luego se eliminó.
- **Pendientes:** P01 puede aplicar migraciones usando `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`. Diagnosticar el timeout del pooler antes de P03/producción; ajustar los modelos Gemini del plan antes de implementar P03. La disponibilidad de claves en Vercel no se ha verificado.

### P01 Base de datos (pgvector)

- **Archivos creados:** `supabase/migrations/20261003130000_nova_extension_tablas.sql` (M1), `20261003132000_nova_vector_seguridad.sql` (M2), `20261003134000_nova_indice_hnsw.sql` (M3), `supabase/prod-ca-2021.crt` (CA raíz pública de Supabase), `scripts/migrar.mjs`, `scripts/verificar-bd.mjs`, `scripts/cargar-env.mjs`, `doc/checkpoints/FASE_1_COMPLETADA.md`, `CLAUDE.md`.
- **Archivos modificados:** `package.json` (scripts `db:migrar`, `db:verificar`; dependencias `pg` y `@types/pg`) y `package-lock.json`.
- **Comandos:** `npm run db:migrar` aplicó las 5 migraciones (las 3 previas de profiles/users se registraron en `_migrations` al ser idempotentes) y luego M3; `npm run db:verificar` sin fallas; `npm run build` y `npm test` correctos.
- **Problemas y resolución:**
  - Certificado SSL: la URL directa de Supabase usa una CA propia que Node rechaza. En lugar de desactivar la verificación (`rejectUnauthorized:false` del plan), los scripts usan la CA oficial de Supabase con verificación completa.
  - El caso f) falló con el índice ivfflat del plan: sobre una tabla vacía/pequeña devolvía 1 fila de 2. Se añadió M3, que lo reemplaza por HNSW (sin entrenamiento). La función `buscar_fragmentos` y la dimensión 768 no cambian.
- **Pendientes:** ninguno de P00/P01 (ver ajustes posteriores abajo).

### Ajustes posteriores a P01 (2026-11-05)

- Carpeta renombrada `Doc/` → `doc/` (git mv) y referencias actualizadas.
- Declaradas `jose` y `@vercel/blob` en `package.json`.
- Pooler 6543: conecta correctamente con la CA de Supabase (el timeout previo no se reprodujo). Nota: la variable NON_POOLING apunta al host del pooler en puerto 5432 (session mode); sirve igual para migraciones.
- Modelos Gemini: `gemini-embedding-001` con `outputDimensionality: 768` devuelve 768 valores; chat `gemini-2.5-flash` (corregido en P03: ya no admite cuentas nuevas). Plan actualizado (2.1, 10.4).
- Plan actualizado con las dos desviaciones: HNSW/M3 (8.3) y SSL con CA de Supabase (10.7).

### P02 Reglas de negocio

- **Archivos creados:** `src/lib/config/nova.ts`, `src/lib/reglas/{errores,fechas,tarea,consulta,documento,fragmentacion,productividad}.ts`, `tests/reglas/{ayudas.ts,tarea,consulta,documento,fragmentacion,fechas,productividad}.test.ts`, `scripts/probar-reglas.ts`, `doc/checkpoints/FASE_2_COMPLETADA.md`.
- **Archivos modificados:** `vitest.config.ts` (incluye `tests/**/*.test.ts`), `package.json` (scripts `test:ver`, `probar:reglas`; devDependency `tsx`).
- **Ubicación:** el plan usa `lib/`; en este repo el código vive en `src/`, por eso `src/lib/...` (alias `@/lib/...`).
- **Comandos:** `npm test` 79/79 (T-01 a T-28 más casos extra y las 47 previas), `npm run probar:reglas` 12/12, `npm run build` correcto.
- **Decisiones:** las pruebas de reglas usan `// @vitest-environment node` (la config global es jsdom). `calcularIndice` calcula `completadas*70/totales` antes de dividir y suma 1e-9 antes del `floor` para evitar errores binarios de flotantes (p. ej. 49.5). T-27 usa 999/1000 con 40 min (bruto 79.93).
- **Problemas:** `npm run type-check` ya tenía 2 errores previos en `src/lib/__tests__/json-db.test.ts` (no relacionados; no se tocaron).
- **Pendientes:** ninguno.

### P03 Servidor y cliente LLM

- **Archivos creados:** `src/lib/db/{conexion,supabaseCa}.ts`, `src/lib/auth/sesion.ts`, `src/lib/http/respuestas.ts`, `src/lib/validacion/esquemas.ts`, `src/lib/formato.ts`, `src/lib/llm/{gemini,prompts}.ts`, `src/lib/pdf/extraer.ts`, `src/app/api/nova/sesion/route.ts`, `tests/servidor/{gemini,respuestas}.test.ts`, `doc/checkpoints/FASE_3_COMPLETADA.md`.
- **Archivos modificados:** `middleware.ts` → `src/middleware.ts` (movido y con protección de `/nova` y `/api/nova`), `src/components/login/LoginForm.tsx` (destino `/nova`), `src/lib/config/nova.ts`, `package.json` (`@google/genai`, `unpdf`).
- **Comandos:** `npm test` 88/88; `npm run build` correcto; embedding real de 768 dimensiones; respuesta real con cita y "No encontré esto en tus documentos"; PDF real extraído y PDF inválido → `PDF_INVALIDO`.
- **Problemas y resolución:**
  - **Middleware inactivo (fallo previo):** con carpeta `src/`, Next ignora `middleware.ts` en la raíz; el manifiesto estaba vacío. Se movió a `src/middleware.ts`. Efecto adicional: el refresco de sesión de Supabase ahora sí corre en toda la app.
  - **Modelo de chat:** `gemini-2.5-flash` responde 404 para cuentas nuevas. Se usa `gemini-3.5-flash`.
  - **503 frecuentes de Gemini:** `gemini.ts` reintenta (500 ms y 1,5 s) ante 429/500/503 y, en el chat, pasa a `gemini-3.1-flash-lite`.
  - **SDK:** se usa `@google/genai`, no `@google/generative-ai` (prompt P03 lo admite: "el SDK de Gemini").
- **Pendientes:**
  - Hasta P06, `/nova` da 404 con sesión, y por tanto tras el login.
  - `GEMINI_API_KEY`: agregada por el usuario en Vercel (Production y Preview, verificado por nombre); su valor aún no se ha probado desde un despliegue. La clave de `.env.local` responde con `gemini-3.5-flash`.
  - `NOVAASSISTANT_POSTGRES_URL` sí está en Vercel (Production y Preview), pero la conexión desde el despliegue no se ha probado.

#### Verificación adicional de P03 (2026-11-05)

- **Con sesión, usuario temporal contra `next dev`:** login 200; `/api/nova/sesion` 200 con el correo correcto; `/nova` 404 (pasa el middleware; la página llega en P06); `/home` 200; `/dashboard` 307 a `/home` (usuario no admin); tras logout, `/api/nova/sesion` 401 y `/nova` 307 a `/login`. Usuario borrado: 0 filas en auth, `profiles` y `users`.
- **Sin comprobar:** la redirección de `LoginForm` a `/nova` en un navegador (solo revisada en el código).
- **Gemini real, 6 llamadas:** 6/6 correctas, con una que usó el modelo de respaldo. Latencia de 3,6 a 32,7 s: tenerlo en cuenta para `maxDuration` en P05.
- **Lint:** corregidos los 3 errores (`z.ZodObject` sin `any` en `data/_schema/registry.ts`; `next-env.d.ts`, generado, ignorado en ESLint). Queda 1 aviso en `eslint.config.mjs`. `npm run type-check` sigue con 2 errores previos en `json-db.test.ts`.
