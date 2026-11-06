# Nova Assistant

Asistente personal que responde preguntas sobre tus propios documentos PDF y tus tareas. Usa RAG (Retrieval-Augmented Generation): en lugar de responder de memoria, busca los fragmentos de tus PDF que más se parecen a la pregunta y le pide al modelo de lenguaje que conteste solo con ellos, citando de dónde salió cada dato.

Proyecto de Lógica y Programación. Plan técnico completo: [`doc/PLAN_NOVA.md`](doc/PLAN_NOVA.md).

Producción: https://nova-assistantsm-kappa.vercel.app

## Funcionalidades

- **Tareas:** registrar (título, categoría, prioridad 1 a 3, fecha límite con máscara AAAA-MM-DD), listar y filtrar por estado, completar con los minutos dedicados y eliminar con confirmación.
- **Documentos:** subir un PDF de hasta 15 MB, que se divide en fragmentos y se vectoriza; listar y eliminar con confirmación. No se admiten PDF escaneados (sin OCR).
- **Asistente:** chat que responde con la información de los PDF y de las tareas pendientes y muestra las fuentes (PDF y fragmento, o tarea). Si el dato no está, responde "No encontré esto en tus documentos". Entiende preguntas de seguimiento como "¿y el segundo?" y guarda la conversación por usuario; "Conversación nueva" empieza otra.
- **Acceso:** con el login de Supabase; solo entran los correos de la lista de administradores.

- **Productividad:** índice del día de 0 a 100 según las tareas completadas y los minutos dedicados, con nivel (Bajo, Aceptable, Excelente) y una recomendación breve.
- **Web:** busca un tema en Wikipedia en español, resume los 3 primeros artículos y guarda la fuente por categoría (máximo 20 por categoría).

## Tecnologías

Next.js 15 (App Router) con TypeScript y Tailwind CSS 4 · Supabase (Auth y Postgres con pgvector) · Vercel Blob para los PDF · Gemini para embeddings (`gemini-embedding-001`, 768 dimensiones) y respuestas · Vitest para las pruebas · despliegue en Vercel.

## Requisitos

- Node.js 18.18 o superior, el mínimo de Next.js 15 (se desarrolló con Node.js 24).
- Un proyecto de Supabase con la extensión `vector` disponible.
- Una clave de la API de Gemini (Google AI Studio).
- Un almacén de Vercel Blob (público) y su token de lectura y escritura.

## Cómo correr en local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear `.env.local` en la raíz (ver `.env.example`). Solo se listan los nombres; los valores se copian del panel de Supabase, de Vercel y de Google AI Studio:

   | Variable | Para qué |
   |---|---|
   | `NOVAASSISTANT_POSTGRES_URL` | Conexión a Postgres por el pooler; la usa la aplicación |
   | `NOVAASSISTANT_POSTGRES_URL_NON_POOLING` | Conexión directa; la usan las migraciones y los scripts |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase (login) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase (login) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio de Supabase (operaciones de administración del login) |
   | `SUPABASE_ADMIN_EMAILS` | Correos con acceso a Nova, separados por comas |
   | `GEMINI_API_KEY` | Clave de Gemini |
   | `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob |

   El código también acepta los nombres que crea la integración de Supabase en Vercel (`NEXT_PUBLIC_NOVAASSISTANT_…`, `NOVAASSISTANT_SUPABASE_…`).

3. Crear las tablas:

   ```bash
   npm run db:migrar
   npm run db:verificar
   ```

4. Levantar el servidor y abrir http://localhost:3000:

   ```bash
   npm run dev
   ```

## Scripts

| Script | Propósito |
|---|---|
| `npm run dev` | Servidor de desarrollo (antes renueva `VERCEL_OIDC_TOKEN` en `.env.local` con `scripts/tokenVercel.mjs`) |
| `npm run build` / `npm start` | Compilar y servir la versión de producción |
| `npm test` | Pruebas con Vitest (reglas, servidor e interfaz) |
| `npm run lint` / `npm run type-check` | ESLint y TypeScript |
| `npm run db:migrar` | Aplica en orden las migraciones de `supabase/migrations/` que falten |
| `npm run db:verificar` | Comprueba extensión, tablas, restricciones, RLS y búsqueda vectorial (en una transacción que se revierte) |
| `npm run probar:reglas` | Prueba las reglas de negocio con datos de ejemplo |
| `npm run probar:rag` | Flujo completo contra la base, Blob y Gemini reales; borra lo que crea |
| `npm run db:limpiar` | Lista los datos de prueba (tareas "Prueba…", documentos "prueba…"); los borra con `-- --confirmar` |

## Estructura

```text
src/
  app/nova/            páginas: Asistente, Tareas, Documentos, Productividad, Web
  app/api/nova/        rutas de la API (todas exigen sesión)
  components/nova/     chat, tablas, formularios y acciones
  components/ui/       componentes base (botón, campo, aviso...)
  lib/reglas/          reglas de negocio puras (sin red ni base de datos)
  lib/datos/           servicios: tareas, documentos, consulta RAG, historial, productividad, Wikipedia
  lib/llm/             cliente de Gemini y System Prompt (único lugar que conoce al proveedor)
  lib/db/              conexión a Postgres con la CA de Supabase
  lib/dataService.ts   fachada de datos que usan páginas y rutas
  middleware.ts        protege /nova y /api/nova
supabase/migrations/   migraciones SQL (M1 a M4)
scripts/               migraciones, verificación y pruebas de punta a punta
tests/                 pruebas de reglas, servidor e interfaz
doc/                   plan, prompts, bitácora, aceptación y checkpoints
```

## Privacidad

Cada pregunta, los fragmentos recuperados de tus PDF y tus tareas pendientes se envían a Gemini, el proveedor del modelo, para generar la respuesta. Las búsquedas de la sección Web se envían a Wikipedia y, con los extractos, a Gemini. **No subas documentos con datos sensibles.** Los PDF se borran de Vercel Blob al terminar la indexación; su texto queda en la base como fragmentos hasta que eliminas el documento.

## Claves y seguridad

- La clave de Gemini y las demás claves **nunca van en el repositorio**: viven en `.env.local` (ignorado por git) y en las variables de entorno de Vercel.
- Las tablas de Nova tienen RLS activo sin políticas: la clave pública de Supabase no puede leerlas; solo el servidor accede con la conexión directa.
- La conexión a Postgres verifica el certificado con la CA de Supabase.
