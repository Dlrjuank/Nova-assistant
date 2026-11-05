# Nova Assistant · Contexto para Claude

Asistente RAG (Next.js 15 + Supabase/pgvector + Vercel Blob + Gemini), desplegado en Vercel.

## Documentos rectores
- Plan técnico: `doc/PLAN_NOVA.md` (prevalece sobre los prompts si hay conflicto).
- Prompts P00-P11: `doc/PROMPTS_NOVA.md`. El proyecto se construye siguiéndolos **en orden**.
- Estado real del repo: `doc/ESTADO_ACTUAL.md`. Avance: `doc/ESTADO_EJECUCION.md`.
- Reglas de código: `.github/copilot-instructions.md`.

## Progreso
- **Último prompt completado: P03** (esperando confirmación del usuario para P04) (actualizar esta línea al terminar cada prompt).
- Tras cada prompt: resumir qué se hizo, qué debe probar el usuario y esperar su confirmación antes del siguiente.

## Decisiones y restricciones
- Migraciones: usar `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`. El pooler (6543, `NOVAASSISTANT_POSTGRES_URL`) ya conecta con la CA de Supabase (verificado 2026-11-05); es el que usa el runtime.
- Blob store: `Nova-pdf` (público). `GEMINI_API_KEY` y `BLOB_READ_WRITE_TOKEN` están en Vercel (Production y Preview, verificado por nombre) y en `.env.local`. El valor de la clave en Vercel aún no se ha probado desde un despliegue.
- Modelos Gemini (ya actualizados en el plan): embeddings `gemini-embedding-001` con `outputDimensionality: 768` (verificado: devuelve 768); chat `gemini-3.5-flash` con respaldo `gemini-3.1-flash-lite` (`gemini-2.5-flash` ya no admite cuentas nuevas; Gemini da 503 con frecuencia, por eso `gemini.ts` reintenta).
- Nunca mostrar ni subir a git el contenido de `.env.local` (ni de `.env.respaldo.local`).
- Código bajo `src/` (alias `@/*` → `src/*`); la carpeta de docs es `doc/` (minúscula, como el plan).
- En esta máquina PowerShell bloquea `npm.ps1`: usar `npm.cmd` o el tool Bash.
- No hacer commit salvo que el usuario lo pida.
- Conexión SSL a Supabase: verificar el certificado con la CA de Supabase (`supabase/prod-ca-2021.crt` en scripts, `src/lib/db/supabaseCa.ts` en runtime); no usar `rejectUnauthorized:false`.
- El middleware vive en `src/middleware.ts`: con carpeta `src/`, Next ignora el de la raíz.
- `npm run dev` ejecuta `scripts/tokenVercel.mjs`, que reescribe `.env.local`; para pruebas automáticas usar `npx next dev`.
- Índice vectorial: HNSW (M3), no ivfflat (devolvía menos filas de las pedidas con pocos datos).
