# Nova Assistant · Contexto para Claude

Asistente RAG (Next.js 15 + Supabase/pgvector + Vercel Blob + Gemini), desplegado en Vercel.

## Documentos rectores
- Plan técnico: `doc/PLAN_NOVA.md` (prevalece sobre los prompts si hay conflicto).
- Prompts P00-P11: `doc/PROMPTS_NOVA.md`. El proyecto se construye siguiéndolos **en orden**.
- Estado real del repo: `doc/ESTADO_ACTUAL.md`. Avance: `doc/ESTADO_EJECUCION.md`.
- Reglas de código: `.github/copilot-instructions.md`.

## Progreso
- **Prompts completados: P00 a P11 (todos), más los ajustes P08b y P08c. Último: P11** (búsqueda en Wikipedia; esperando que el usuario lo pruebe y confirme). P10 (índice de productividad) está en producción y lo probó el usuario en local; P11 aún no tiene commit. P09: aceptación en Vercel ejecutada por el usuario: A-01 a A-15 y A-19 a A-21 pasan (A-14: 10 de 10). P09 dejó `doc/ACEPTACION.md`, `README.md` y los checkpoints de las fases 5 y 6; corrigió las citas de tareas (`construirContexto` ya no usa índices `[T1]`). P08b: fecha pasada con aviso, máscara AAAA-MM-DD, historial del chat en la base (M4) y preguntas de seguimiento. P08c: eliminar documento (RN-22). Si un despliegue falla con `BUILD_FAILED` "Resource provisioning timed out", es de Vercel: reintentar con `npx vercel redeploy <url> --target production` (en Git Bash, `MSYS_NO_PATHCONV=1` para `vercel api`). Actualizar esta línea al terminar cada prompt.
- Completar tarea (F5) y eliminar tarea se hicieron en P07 a pedido del usuario; P10 hizo el índice de productividad (F6) y P11 la búsqueda en Wikipedia (F4). Fase 7 cerrada.
- Tras cada prompt: resumir qué se hizo, qué debe probar el usuario y esperar su confirmación antes del siguiente.

## Decisiones y restricciones
- Producción: https://nova-assistantsm-kappa.vercel.app (despliega con push a `master`). `nova-assistant.vercel.app` NO es de este proyecto.
- Migraciones: usar `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`. El pooler (6543, `NOVAASSISTANT_POSTGRES_URL`) ya conecta con la CA de Supabase (verificado 2026-11-05); es el que usa el runtime.
- Blob store: `Nova-pdf` (público). `GEMINI_API_KEY` y `BLOB_READ_WRITE_TOKEN` están en Vercel (Production y Preview, verificado por nombre) y en `.env.local`. El valor de la clave en Vercel aún no se ha probado desde un despliegue.
- Modelos Gemini (ya actualizados en el plan): embeddings `gemini-embedding-001` con `outputDimensionality: 768` (verificado: devuelve 768); chat `gemini-3.1-flash-lite` con respaldo `gemini-3.5-flash-lite`. `gemini-3.5-flash` solo permite 20 peticiones/día en el plan gratuito (cuota por modelo): no gastar cuota en pruebas innecesarias. `gemini.ts` reintenta ante 500/503; en el chat, ante 429 pasa directo al respaldo. Embeddings: 30.000 tokens/min en el plan gratuito, lotes de 20 y espera de `retryDelay`; por eso `POST /api/nova/documentos` usa `maxDuration = 300`. Requiere Fluid Compute en Vercel (activado por el usuario).
- Acceso a Nova: solo correos de la lista de admins (`SUPABASE_ADMIN_EMAILS` + el incorporado en `modules/auth/admin.ts`), porque `/register` está abierto. Sin sesión 401; con sesión fuera de la lista 403 `ACCESO_DENEGADO`; en páginas, redirige a `/login` o `/home`. En Vercel `SUPABASE_ADMIN_EMAILS` no existe: allí solo entra el correo incorporado.
- Los documentos se pueden eliminar (RN-22, a pedido del usuario; el plan funcional lo dejaba fuera de alcance). Los PDF se borran de Blob al terminar la indexación. `npm run db:limpiar` solo lista; borra con `-- --confirmar`.
- Nunca mostrar ni subir a git el contenido de `.env.local` (ni de `.env.respaldo.local`).
- Código bajo `src/` (alias `@/*` → `src/*`); la carpeta de docs es `doc/` (minúscula, como el plan).
- En esta máquina PowerShell bloquea `npm.ps1`: usar `npm.cmd` o el tool Bash.
- No hacer commit salvo que el usuario lo pida.
- Conexión SSL a Supabase: verificar el certificado con la CA de Supabase (`supabase/prod-ca-2021.crt` en scripts, `src/lib/db/supabaseCa.ts` en runtime); no usar `rejectUnauthorized:false`.
- El middleware vive en `src/middleware.ts`: con carpeta `src/`, Next ignora el de la raíz.
- `npm run dev` ejecuta `scripts/tokenVercel.mjs`, que reescribe `.env.local`; para pruebas automáticas usar `npx next dev`. `next build` reescribe `.next` y rompe un `next dev` que esté corriendo: detenerlo antes y reiniciarlo después.
- Índice vectorial: HNSW (M3), no ivfflat (devolvía menos filas de las pedidas con pocos datos).
- Historial del chat (M4, RN-20 y RN-21): tablas `conversaciones` y `mensajes_chat` con `usuario_id` (son las únicas con dueño); la pantalla muestra la conversación más reciente y "Conversación nueva" conserva las anteriores. El modelo recibe los últimos 6 mensajes y la búsqueda usa la pregunta anterior con la nueva.
- Fechas pasadas: se permiten (RN-07, T-15); el formulario solo avisa. El usuario lo decidió así.
- `doc/CORREO RESEND VERCEL CONNECT (1).md` no es de este trabajo: no tiene secretos, pero no se incluye en los commits.
