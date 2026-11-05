# Fase 3 completada · Nova Assistant

Fecha de cierre: 2026-11-05

## Verificado

- `npm run build` correcto; `npm test` 88/88.
- Embedding real con `gemini-embedding-001`: **768 dimensiones** (coincide con `vector(768)`).
- Chat real: responde con cita cuando el dato está en el contexto y "No encontré esto en tus documentos" cuando no.
- `conexion.ts`: consulta y transacción con `::vector` contra el pooler 6543, con la CA de Supabase.
- `extraerTexto`: extrae un PDF de texto; un archivo inválido da `PDF_INVALIDO`.

## Protección de rutas sin sesión (`next dev`)

| Ruta | Resultado |
|---|---|
| `/api/nova/sesion`, `/api/nova/tareas`, `/api/nova` | 401 `NO_AUTORIZADO`, `Cache-Control: no-store` |
| `/nova`, `/nova/tareas` | 307 a `/login` |
| `/novalgo` | 404 (no se protege por error) |
| `/login`, `/recuperar-contrasena`, `/api/health`, `/api/auth/session` | 200 |

## Sin verificar

- Redirección de `LoginForm` a `/nova` en un navegador (solo revisada en el código).
- Conexión a Postgres y a Gemini desde el despliegue de Vercel. `GEMINI_API_KEY` ya está en Vercel, pero su valor no se ha probado allí.

## Con sesión (usuario temporal, ya borrado)

`/api/nova/sesion` 200 con el correo correcto; `/home` 200; `/dashboard` 307 a `/home`; tras logout, 401 y 307 a `/login`.
