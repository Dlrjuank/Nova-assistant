# Nova Assistant · Contexto para Claude

Asistente RAG (Next.js 15 + Supabase/pgvector + Vercel Blob + Gemini), desplegado en Vercel.

## Documentos rectores
- MVP (P00 a P11, terminado y en producción): `doc/PLAN_NOVA.md` (prevalece sobre los prompts) y `doc/PROMPTS_NOVA.md`.
- **Ampliación** (rama `ampliacion`, nunca tocar `master`): plan `doc/PLAN_AMPLIACION.md`, etapas E00 a E21 en `doc/PROMPTS_AMPLIACION.md`.
- Avance y bitácora de cada etapa: `doc/ESTADO_EJECUCION.md`. Estado del repo: `doc/ESTADO_ACTUAL.md`. Reglas de código: `.github/copilot-instructions.md`.
- Historial completo de este archivo hasta el 2026-11-26 (decisiones y trucos antiguos): `doc/HISTORIAL_CLAUDE.md`. Buscar ahí antes de preguntar algo que ya se decidió.

## Estado actual (actualizar al cerrar cada etapa; el detalle va en `ESTADO_EJECUCION.md`)
- **En curso: E20d** (más tipos de documento y OCR; M26 aplicada). E20d-1 (Markdown y texto) y E20d-2 (Word y PowerPoint) programadas: **pendiente la prueba del usuario de las dos juntas**. Luego E20d-3 y E20d-4 juntas, y después E21 (unión con `master`).
- Hechos el 2026-11-26: filtros y pestañas que no suben la página (`e093ab2`, Inicio en `src/app/nova/(inicio)/`) y Sentry (`273cccb`).
- Terminadas y probadas por el usuario: E01 a E20c (E20c-1 clave de Gemini propia, E20c-2 Administración con niveles, E20c-3 Entrar con Google y contraseña temporal); E20b Diseño final. Detalle en `ESTADO_EJECUCION.md` y en el plan 5.14.
- `/privacidad` está en `ampliacion` y va a `master` con E21. El control de registro ya está en producción (`6ce9a4d`). Etiqueta `v1-original` en `d175142`.
- El aviso de cada minuto (pg_cron) sigue llamando a la vista previa hasta E21. El disparador de dueño por defecto de M5 se quita en E21.

## Forma de trabajar (pedidos del usuario)
- Skills: `nueva-etapa`, `prueba-corta`, `trabajo-en-paralelo` (de usuario); `migracion-segura` y `cierre-etapa` (de este proyecto). Agentes: `investigador`, `revisor`, `probador`, `documentador`, `vigia-produccion`.
- Tras cada etapa: resumir qué se hizo, qué debe probar el usuario (lista corta) y esperar su confirmación antes de la siguiente.
- Agilizar (2026-11-25): E20d-3 y E20d-4 se prueban juntas, luego E21. Los pasos externos (Google Cloud, Supabase, Vercel) se dan al empezar, para que el usuario los haga mientras se programa.
- No hacer commit salvo que el usuario lo pida. **Toda la app usa tuteo.** Sin librería de animación: solo CSS; en cada cambio se revisa lo de sin conexión.
- `doc/PRESENTACION_AMPLIACION.md` (del usuario) y `doc/CORREO RESEND VERCEL CONNECT (1).md` nunca van en un commit. Nunca mostrar ni subir el contenido de `.env.local` ni de `.env.respaldo.local`.

## Producción e infraestructura
- Producción: https://novaassistantjc.vercel.app (despliega con push a `master`). `https://nova-assistantsm-kappa.vercel.app` redirige a ella con 308 (Vercel → Domains); `APP_URL` y Supabase (Site URL y Redirect URLs) ya usan la nueva. `nova-assistant.vercel.app` NO es de este proyecto. Vista previa: https://nova-assistant-git-ampliacion-dlrjuank.vercel.app (con protección de Vercel).
- Si un despliegue falla con `BUILD_FAILED` "Resource provisioning timed out", es de Vercel: `npx vercel redeploy <url> --target production` (en Git Bash, `MSYS_NO_PATHCONV=1` para `vercel api`).
- Vercel en `iad1`, Supabase en `us-east-1`. Requiere Fluid Compute (activado).
- Sentry (2026-11-26): proyecto `juank-ing/nova-assistant`; el SDK del navegador se carga diferido y el middleware va sin Sentry, para no sumar peso a la carga (detalle en `ESTADO_EJECUCION.md`, "Ajuste: Sentry"). Nada de contenido del usuario sale a Sentry (`src/lib/sentry/opciones.ts`).
- MCP conectados: Supabase, Vercel, Sentry y Context7. **Sobre producción solo lectura** salvo pedido explícito del usuario; las migraciones se aplican con los scripts del proyecto, no con el MCP.

## Base de datos
- **Una sola base para producción y la vista previa.** Toda migración sigue la skill `migracion-segura` (respaldo, `db:migrar`, `db:verificar`, `probar:rag` del código de `master` desde un `git worktree`, simulacro de restauración).
- Migraciones con `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`; el runtime usa el pooler (6543, `NOVAASSISTANT_POSTGRES_URL`). SSL verificando la CA de Supabase (`supabase/prod-ca-2021.crt` en scripts, `src/lib/db/supabaseCa.ts` en runtime); nunca `rejectUnauthorized:false`. Si el pooler da `ECONNRESET` desde esta máquina, para pruebas locales se puede usar la conexión directa solo como variable del proceso.
- En Supabase no se puede poner `SET parametro` en una función: usar `set_config(..., true)` dentro.
- Índice vectorial HNSW (no ivfflat). `db:limpiar` solo lista (títulos `ILIKE 'prueba%'`); borra con `-- --confirmar` (si el clasificador lo bloquea, que lo ejecute el usuario).

## Gemini
- Embeddings `gemini-embedding-001` con `outputDimensionality: 768`; chat `gemini-3.1-flash-lite` con respaldo `gemini-3.5-flash-lite`. **La cuota es por proyecto y se comparte con producción: no repetir pruebas reales** ni correrlas en paralelo.
- Cada servicio con IA corre en `conIaDe(usuario)` (`src/lib/llm/contextoIa.ts`); sin contexto, `gemini.ts` no llama a Gemini. Los scripts `probar:*` usan `conClaveDelProyecto`. Las pruebas reutilizan embeddings de `.cache-pruebas/` (`SIN_CACHE_EMBEDDINGS=1` los ignora).

## Acceso y sesión
- Registro solo con "Entrar con Google"; estado y nivel en `cuentas` (M25), leídos en cada pedido por `exigirSesion` y el layout de Nova (pendiente o bloqueada: 403 en la API y `/cuenta` en las páginas). `SUPABASE_ADMIN_EMAILS` cuenta como administrador.
- Al rechazar un ingreso, `signOut({ scope: 'local' })` (el de Supabase por defecto es global). El middleware vive en `src/middleware.ts` y usa `getClaims()`.
- Recuperar contraseña por correo no funciona (Resend sin dominio): las salidas son Google y la contraseña temporal del administrador.

## Trampas conocidas del código
- Todo lo que guarda debe llamar a `router.refresh()` (`staleTimes.dynamic = 30`).
- Al cambiar `public/sw-reglas.js`, actualizar la huella en `sw.js` (lo vigila `tests/reglas/swVersion.test.ts`); los íconos llevan `// VERSION_ICONOS`.
- Los componentes de Nova solo usan tokens `--nova-*` (lo vigila `tests/reglas/contraste.test.ts`). Nunca bloquear el zoom con dos dedos. Campos con `max(16px, 1rem)` en pantallas táctiles (evita el zoom del iPhone).
- Las funciones compartidas entre servidor y cliente no van en archivos `'use client'`. `server-only` se simula en `src/test/setup.ts`.
- `pdf.js` vacía el búfer que recibe: leer cada PDF una vez o pasar una copia.
- Next 15.5 manda el `metadata` al final del cuerpo: las etiquetas del iPhone van con `EtiquetasIphone` en `src/app/layout.tsx`.

## Comandos y máquina
- PowerShell bloquea `npm.ps1`: usar `npm.cmd` o el tool Bash.
- `npm run dev` ejecuta `scripts/tokenVercel.mjs`, que reescribe `.env.local`: para pruebas automáticas usar `npx next dev`. `next build` rompe un `next dev` que esté corriendo.
- Al detener `next start` puede quedar vivo el `node` del puerto: comprobar con `netstat` y cerrar con `taskkill` (solo el que se inició).
- Código bajo `src/` (alias `@/*`); documentos en `doc/` (minúscula).

## Verificar en el navegador (Edge 157 con `puppeteer-core` en el scratchpad)
- Si `puppeteer.launch` falla, lanzar Edge con `--remote-debugging-port=0` y conectarse leyendo `DevToolsActivePort`. Usuario temporal `nova-prueba-ui@example.com` con `SUPABASE_ADMIN_EMAILS` en `next start -p 3100`, borrado al final.
- Tras abrir una página de Nova, esperar a que se vaya `.nova-carga` antes de hacer clic. `/login` se prueba en `nav.createBrowserContext()`.
- Para no subir a Blob: responder en el navegador el `OPTIONS` y el `PUT` a `vercel.com/api/blob` con CORS. Para no llamar a Gemini: interceptar `/api/nova/consultar` con `setBypassServiceWorker(true)`.

## Decisiones vigentes
- Los documentos se pueden eliminar (RN-22); los PDF se borran de Blob al terminar la indexación. Las fechas pasadas se permiten con aviso (RN-07).
- Historial del chat en `conversaciones` y `mensajes_chat` (M4): el modelo recibe los últimos 6 mensajes.
- El Asistente nunca se bloquea sin documentos (RB-32); la línea HOY usa `America/Bogota`.
- Estado "Perdida" = materia con las fallas en el límite; "Reprobada" aparte.
