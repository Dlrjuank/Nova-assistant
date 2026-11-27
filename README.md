# Nova Assistant

Asistente de estudio que responde preguntas sobre tus propios documentos y tareas, y ayuda a organizar el semestre. Usa RAG (Retrieval-Augmented Generation): en lugar de responder de memoria, busca los fragmentos de tus documentos que más se parecen a la pregunta y le pide al modelo que conteste solo con ellos, citando de dónde salió cada dato.

Proyecto de Lógica y Programación. Plan del MVP: [`doc/PLAN_NOVA.md`](doc/PLAN_NOVA.md). Plan de la ampliación: [`doc/PLAN_AMPLIACION.md`](doc/PLAN_AMPLIACION.md).

Producción: https://novaassistantjc.vercel.app (https://nova-assistantsm-kappa.vercel.app redirige a ella)

> **Aviso (27 de noviembre de 2026):** la cuenta gratuita de Vercel está en pausa por consumo de CPU hasta el 27 de diciembre de 2026, así que el enlace de producción no carga por ahora. Mientras tanto, Nova corre en un computador y se publica con un enlace temporal de Cloudflare Tunnel. La versión entregada está en esta rama (`ampliacion`) y se explica, con capturas, en el [documento del proyecto v3](doc/DOCUMENTO_PROYECTO_v3.md) ([PDF](doc/DOCUMENTO_PROYECTO_v3.pdf)).

## Funcionalidades

| Sección | Qué hace |
|---|---|
| **Inicio** | La semana, las prioridades de hoy, las tareas vencidas y "Pregúntale a Nova" |
| **Asistente** | Chat con citas sobre documentos y tareas. "Buscar en" elige un documento, las fuentes web guardadas, Wikipedia o la IA general (marcada como respuesta sin fuentes). Preguntas por fecha, página, capítulo, sección o diapositiva, y "Explicar de otra manera" |
| **Calendario** | Mes con tareas por color de categoría, cortes y notas con fecha |
| **Tareas** | Crear, editar, completar con los minutos y eliminar; categorías propias, horario, recordatorio y "Agregar a mi calendario" |
| **Fuentes** | Documentos de hasta 15 MB: PDF (también escaneados, con OCR y preguntando antes de gastar), Word, PowerPoint, Markdown, texto y fotos. "Ver contenido", plan de lectura y fuentes web guardadas |
| **Cuestionarios** | Preguntas generadas desde un documento (selección única y múltiple, verdadero o falso, completar y abierta), historial y repaso de lo fallado |
| **Semestre** | Materias, cortes, componentes y notas; calculadora de "¿cuánto necesito?", metas, fallas, temas, plan de estudio y estadísticas |
| **Productividad** | Índice del día de 0 a 100 y metas semanales de tareas o de tiempo |
| **Configuración** | Nombre y contraseña, tema claro, oscuro o automático, formato de hora, notas, notificaciones, clave de Gemini propia y privacidad |
| **Administración** | Solo administradores: cuentas, espacio, topes, bloquear, contraseña temporal y registro de acciones |

Además: app instalable en el teléfono, consulta sin conexión, creación de tareas sin conexión, notificaciones de recordatorios y resumen diario.

### Acceso y cuentas

- Las cuentas nuevas se crean con **"Entrar con Google"**. El registro con correo está cerrado.
- Cada persona ve solo sus datos. El estado (activa, pendiente o bloqueada) y el nivel (dueño, administrador o usuario) se comprueban en cada pedido.
- La IA de cada usuario usa **su propia clave de Gemini**, guardada cifrada. Hay un tope de cuentas y de espacio por persona.
- Política de privacidad: `/privacidad`.

## Tecnologías

Next.js 15 (App Router) con TypeScript y Tailwind CSS 4 · Supabase (Auth, Postgres con pgvector, pg_cron y Vault) · Vercel Blob para las subidas · Gemini para embeddings (`gemini-embedding-001`, 768 dimensiones), respuestas y OCR · Web Push · Sentry · Vitest · despliegue en Vercel.

## Requisitos

- Node.js 18.18 o superior (se desarrolla con Node.js 24).
- Un proyecto de Supabase con la extensión `vector`, `pg_cron` y `pg_net`.
- Una clave de la API de Gemini (Google AI Studio).
- Un almacén público de Vercel Blob y su token de lectura y escritura.

## Cómo correr en local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear `.env.local` en la raíz a partir de `.env.example`. Los valores se copian del panel de cada servicio o se generan; nunca van en el repositorio.

   | Variable | Para qué | ¿Obligatoria? |
   |---|---|---|
   | `NOVAASSISTANT_POSTGRES_URL` | Postgres por el pooler; la usa la aplicación | Sí |
   | `NOVAASSISTANT_POSTGRES_URL_NON_POOLING` | Conexión directa; migraciones y scripts | Sí |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase | Sí |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase | Sí |
   | `SUPABASE_SERVICE_ROLE_KEY` | Operaciones de administración de cuentas | Sí |
   | `GEMINI_API_KEY` | Clave de Gemini del proyecto (dueño y cuentas con permiso) | Sí |
   | `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob | Sí |
   | `NOVA_LLAVE_CLAVES_ACTUAL` y `NOVA_LLAVE_CLAVES_V1` | Versión y llave (32 bytes en base64) que cifra las claves de Gemini de cada persona | Para claves propias |
   | `SUPABASE_ADMIN_EMAILS` | Correos que cuentan como administradores | No |
   | `APP_URL` | Dirección pública para los enlaces | No |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Notificaciones push | Para recordatorios |
   | `RECORDATORIOS_SECRETO` | Protege el aviso de cada minuto | Para recordatorios |
   | `NOVA_TICK_URL` | Dirección a la que llama el aviso de cada minuto | Para recordatorios |
   | `CRON_SECRET` | Protege el cron diario de Vercel | En producción |
   | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | Avisos de errores; sin DSN quedan apagados | No |

   El código también acepta los nombres que crea la integración de Supabase en Vercel (`NEXT_PUBLIC_NOVAASSISTANT_…`, `NOVAASSISTANT_SUPABASE_…`).

3. Crear las tablas y comprobarlas:

   ```bash
   npm run db:migrar
   npm run db:verificar
   ```

   La migración M5 necesita que ya exista en Supabase Auth la cuenta del dueño (`src/modules/auth/admin.ts`). Las migraciones que aún no se deben aplicar están en [`supabase/pendientes/`](supabase/pendientes/README.md).

4. Levantar el servidor y abrir http://localhost:3000:

   ```bash
   npm run dev
   ```

## Tareas programadas

- **Cada minuto** (pg_cron en Supabase → `POST /api/nova/recordatorios/tick`): recordatorios, resumen diario, avance de documentos a medias y vencimientos. Se configura con `npm run db:configurar-tick`. Con M29 (pendiente) la llamada sale solo cuando hay algo que hacer.
- **Cada día** (cron de Vercel, `vercel.json` → `GET /api/nova/salud`): consulta mínima a la base. Solo corre en producción.
- **Cada noche** (pg_cron): limpieza de registros antiguos.

## Scripts

| Script | Propósito |
|---|---|
| `npm run dev` | Servidor de desarrollo (antes renueva `VERCEL_OIDC_TOKEN` en `.env.local`) |
| `npm run build` / `npm start` | Compilar y servir la versión de producción |
| `npm test` | Pruebas con Vitest (reglas, servidor e interfaz) |
| `npm run lint` / `npm run type-check` | ESLint y TypeScript |
| `npm run db:migrar` | Aplica en orden las migraciones de `supabase/migrations/` que falten |
| `npm run db:verificar` | Comprueba tablas, restricciones, RLS y búsquedas (en una transacción que se revierte) |
| `npm run db:respaldar` / `npm run db:restaurar` | Respaldo en `respaldos/` y restauración (con `--probar`, un simulacro) |
| `npm run db:limpiar` | Lista los datos de prueba; los borra con `-- --confirmar` |
| `npm run db:configurar-tick` | Guarda en Supabase Vault la dirección y el secreto del aviso de cada minuto |
| `npm run claves:recifrar` | Vuelve a cifrar las claves de Gemini con la llave actual |
| `node scripts/m27.mjs --ensayo` | Ensaya la migración pendiente M27 sin cambiar la base |
| `npm run probar:reglas` | Reglas de negocio con datos de ejemplo |
| `npm run probar:…` | Flujos contra servicios reales (`rag`, `libro`, `cuestionario`, `recordatorios`, `sin-conexion`, `semestre`, `metas`, `temas`, `plan`, `clave`, `ocr`). Varios gastan cuota de Gemini |

## Estructura

```text
src/
  app/nova/            páginas de Nova
  app/api/nova/        API (cada ruta exige sesión; el aviso por minuto y el cron, su secreto)
  components/nova/     interfaz de Nova
  components/ui/       componentes base
  lib/reglas/          reglas de negocio puras (sin red ni base de datos)
  lib/datos/           servicios y consultas
  lib/llm/             cliente de Gemini y prompts (único lugar que conoce al proveedor)
  lib/db/              conexión a Postgres con la CA de Supabase
  lib/dataService.ts   fachada de datos que usan páginas y rutas
  middleware.ts        renueva la sesión y protege las páginas de Nova (la API se protege sola)
public/                service worker, íconos y archivos de la app instalable
supabase/migrations/   migraciones SQL
supabase/pendientes/   migraciones preparadas y todavía sin aplicar
scripts/               migraciones, respaldos, verificación y pruebas de punta a punta
tests/                 pruebas de reglas, servidor e interfaz
doc/                   planes, prompts, bitácora, aceptación y checkpoints
```

## Privacidad

Las preguntas, los fragmentos recuperados de tus documentos y tus tareas pendientes se envían a Gemini para generar la respuesta; el OCR le envía las páginas o fotos que aceptas leer. Las búsquedas en Wikipedia se envían a Wikipedia y, con los extractos, a Gemini. **No subas documentos con datos sensibles.** Los archivos se borran de Vercel Blob al terminar la indexación (mientras esperan o se leen, están en un almacén público con un nombre al azar); su texto queda en la base hasta que eliminas el documento. El detalle está en `/privacidad`.

## Claves y seguridad

- Las claves **nunca van en el repositorio**: viven en `.env.local` (ignorado por git) y en las variables de entorno de Vercel.
- La clave de Gemini de cada persona se guarda cifrada (AES-256-GCM) y nunca vuelve al navegador.
- Las tablas de Nova tienen RLS activo sin políticas: la clave pública de Supabase no puede leerlas; solo el servidor accede.
- La conexión a Postgres verifica el certificado con la CA de Supabase.
- A Sentry no se envía contenido del usuario.
