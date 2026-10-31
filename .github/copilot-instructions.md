# Nova Assistant · Instrucciones para Copilot

## Documentos rectores
- Plan técnico: Doc/PLAN_NOVA.md. Si una instrucción contradice el plan, prevalece el plan.
- Estado real del repositorio: Doc/ESTADO_ACTUAL.md.
- Avance: Doc/ESTADO_EJECUCION.md. Se actualiza al final de cada tarea.

## Stack
- Next.js App Router + TypeScript + Tailwind CSS. Despliegue en Vercel.
- Postgres de Supabase con pgvector, el paquete pg y `NOVAASSISTANT_POSTGRES_URL_NON_POOLING` para aplicar las migraciones P01. `NOVAASSISTANT_POSTGRES_URL` es el Transaction pooler para runtime, pero su conexión todavía requiere diagnóstico.
- Embeddings y chat con la API de Gemini (clave en `GEMINI_API_KEY`). Antes de P03, confirmar modelos: los del plan no aparecen en la API; `gemini-embedding-001` y `gemini-2.5-flash` sí.
- PDF de hasta 15 MB subidos a Vercel Blob (`BLOB_READ_WRITE_TOKEN`); extracción de texto con `unpdf`.
- Validación con Zod. Pruebas con Vitest.
- Login existente: Supabase Auth con `@supabase/ssr`, cookie `sb-<project-ref>-auth-token`; se conserva y no se reescribe. El login actual redirige a `/dashboard` o `/home`; el plan prevé `/nova`. Puerta única, sin roles para Nova.

## Convenciones
- Identificadores, comentarios, mensajes y textos de interfaz en español.
- Los mensajes exactos de la sección 5.1 del plan se usan textualmente.
- Reglas puras en lib/reglas/: funciones puras, sin pg, sin red, sin variables de entorno y sin reloj (excepto fechas.ts). Se prueban con Vitest.
- Solo lib/llm/ conoce a Gemini; el resto usa su interfaz LLMClient. La clave se lee de variable de entorno, nunca en el código.
- Solo lib/datos/ importa lib/db/conexion.ts. Rutas y páginas importan datos únicamente desde lib/dataService.ts.
- Toda ruta en app/api/nova/ llama await exigirSesion() como primera instrucción.
- El PDF se sube a Vercel Blob desde el navegador; la ruta de indexación recibe la URL, no el archivo. El tamaño se valida también en el servidor sobre el archivo real (RN-01).
- Las rutas que llaman a Gemini declaran export const maxDuration holgado.
- Vectores: columna vector(768); a SQL van como literal '[...]' casteado con ::vector; recuperación con el operador <=> (coseno).
- Entradas validadas con los esquemas de lib/validacion/esquemas.ts.
- Errores de negocio con ErrorDeNegocio(codigo); respuestas con lib/http/respuestas.ts.
- Fechas 'YYYY-MM-DD' como texto entre capas. Zona horaria America/Bogota; "hoy" solo con hoyBogota().
- En rutas dinámicas params es una Promise: const { id } = await params.
- SQL siempre con parámetros ($1, $2). Nunca concatenar valores.
- Las tareas y los documentos no se editan ni se borran (salvo la transición opcional a Completada).
- No instalar librerías de componentes (shadcn, MUI u otras). Usar components/ui/.
- Prefijo de imports para lib: `@/lib/...`.
- Archivo de protección de rutas: `middleware.ts` (existe, pero actualmente solo refresca la sesión y todavía no protege las rutas Nova). Ruta de login: `/login`.

## Al terminar cada tarea
1. npm run build sin errores.
2. npm test sin fallas (desde que exista Vitest).
3. Actualizar Doc/ESTADO_EJECUCION.md.
4. No hacer commit: el estudiante revisa y hace el commit.
