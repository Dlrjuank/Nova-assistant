# Estado de ejecución · Nova Assistant

| Prompt | Estado | Build | Tests | Fecha de cierre |
|---|---|---|---|---|
| P00 Auditoría | completado | correcto | No ejecutados | 2026-10-31 |
| P01 Base de datos (pgvector) | completado | correcto | 47 pasan | 2026-11-05 |
| P02 Reglas de negocio | completado | correcto | 79 pasan (32 de reglas) | 2026-11-05 |
| P03 Servidor y cliente LLM | completado | correcto | 88 pasan | 2026-11-05 |
| P04 Datos: tareas, documentos, consulta | completado | correcto | 106 pasan | 2026-11-05 |
| P05 API | completado | correcto | 124 pasan | 2026-11-05 |
| P06 Interfaz base y tareas | completado | correcto | 141 pasan | 2026-11-05 |
| P07 Documentos (subida e indexación), más completar y eliminar tareas | completado | correcto | 164 pasan | 2026-11-05 |
| P08 Chat del asistente | completado | correcto | 175 pasan | 2026-11-05 |
| P08b Ajustes tras probar P08: fechas, historial y seguimiento | completado | correcto | 202 pasan | 2026-11-05 |
| P08c Eliminar documento | completado | correcto | 209 pasan | 2026-11-05 |
| P09 Aceptación del MVP | completado (aceptación en Vercel: todo pasa) | correcto | 210 pasan | 2026-11-06 |
| P10 Opcionales: completar tarea e índice | completado | correcto | 224 pasan | 2026-11-06 |
| P11 Opcional: búsqueda en Wikipedia | completado | correcto | 240 pasan | 2026-11-06 |
| E00 Ampliación: rama y vista previa | completado | no aplica (solo documentos) | 240 pasan | 2026-11-06 |
| E01 Ampliación: dueño por usuario (M5) | completado | correcto | 247 pasan | 2026-11-06 |
| E02 Ampliación: diseño base | completado | correcto | 259 pasan | 2026-11-06 |
| E02b Ampliación: Asistente sin documentos (RB-30) | completado | correcto | 268 pasan | 2026-11-06 |
| E02c Ampliación: fecha de hoy y preguntas por fechas (RB-31) | completado | correcto | 278 pasan | 2026-11-06 |
| E03 Ampliación: navegación | completado | correcto | 295 pasan | 2026-11-06 |
| E04 Ampliación: login con el estilo de Nova | completado | correcto | 304 pasan | 2026-11-07 |
| RB-32 Ajuste: el Asistente nunca se bloquea sin documentos | completado | correcto | 312 pasan | 2026-11-07 |
| Ajuste: el chat baja al último mensaje | completado | correcto | 324 pasan | 2026-11-07 |
| E05 Ampliación: categorías (M6) | completado | correcto | 351 pasan | 2026-11-07 |
| E05b Ampliación: categorías dentro de Tareas | completado | correcto | 366 pasan | 2026-11-07 |
| E06 Ampliación: Inicio | completado | correcto | 389 pasan | 2026-11-07 |
| Ajustes de E06 (columnas, prioridad, botón "+") | completado | correcto | 391 pasan | 2026-11-07 |
| E06b Ampliación: horario de las tareas (M14) | completado | correcto | 404 pasan | 2026-11-07 |
| Ajuste: tope de 4 tareas por columna y completadas al final | completado | correcto | 406 pasan | 2026-11-07 |

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

### P04 Datos: tareas, documentos y consulta

- **Archivos creados:** `src/lib/datos/{tipos,tareas,documentos,fragmentos,consulta,productividad,wikipedia}.ts`, `scripts/limpiar-prueba.mjs`, `scripts/probar-rag.ts`, `tests/servidor/{consulta,documentos}.test.ts`.
- **Archivos modificados:** `src/lib/dataService.ts` (agrega la fachada de Nova sin tocar la recuperación de contraseña), `src/lib/llm/prompts.ts` (`SIN_RESPUESTA`), `src/lib/reglas/tarea.ts` (tipo opcional), `package.json` (`db:limpiar`, `probar:rag`), `doc/PLAN_NOVA.md` (firma de `emitirTokenSubida`).
- **Salida de `npm run probar:rag`:**

```text
OK    Paso 9: consulta sin documentos -> SIN_DOCUMENTOS
OK    Paso 1: tarea creada, Pendiente -> Prueba renovar pasaporte, categoría General, límite 2099-01-15
OK    Paso 2: prioridad 7 -> PRIORIDAD_INVALIDA
OK    Paso 3: fecha 2026-02-30 -> FECHA_INVALIDA
OK    Paso 4: PDF indexado -> 3 fragmentos
OK    Paso 4b: fragmentos guardados en la base -> 3 filas de 768 dimensiones
OK    Paso 5: consulta "info" -> CONSULTA_MUY_CORTA
OK    Paso 6: dato presente en el PDF -> La garantía del purificador de agua AquaNova es de 24 meses desde la fecha de compra [prueba-nova-rag.pdf · fragmento 1]. | fuentes: prueba-nova-rag.pdf · fragmento 1
OK    Paso 7: tareas pendientes -> Prueba renovar pasaporte [...] [Tarea 398fd86f] | fuentes: Tarea 398fd86f
OK    Paso 8: dato ausente -> No encontré esto en tus documentos | 0 fuentes
Limpieza: 1 tarea(s) y 1 documento(s) borrados
Total de fallas: 0
```

- **Otros comandos:** `npm test` 102/102; `npm run build` correcto; `npm run db:limpiar` probado con datos sembrados (1 tarea, 1 documento y su fragmento); la base quedó con 0 filas en las cuatro tablas.
- **Decisiones que precisan el plan:**
  - `emitirTokenSubida` recibe el cuerpo y la petición, porque `handleUpload` los necesita. Sin `onUploadCompleted` no hay webhook, así que la ruta puede exigir sesión siempre.
  - `consultar` devuelve solo las fuentes citadas por el modelo (RN-14: fuentes usadas); si no reconoce ninguna, devuelve todas. Con la respuesta "No encontré..." no devuelve fuentes.
  - `descargarPdf` corta la descarga al superar 15 MB y `indexarContenido` quita el carácter NUL, que Postgres rechaza.
  - `indexarContenido` indexa bytes ya descargados y no se expone en `dataService`.
- **Pendientes:**
  - La fase 4 sigue abierta hasta P05.

#### Ajustes posteriores a P04 (2026-11-05)

- **Cuota de Gemini (corrige el diagnóstico de P03):** gran parte de los fallos no eran saturación, sino el límite del plan gratuito: `gemini-3.5-flash` permite 20 peticiones al día por proyecto y modelo (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). Parte de esa cuota la gastaron las pruebas de esta sesión.
- **Modelos:** principal `gemini-3.1-flash-lite` (8/8 disponibles y correctas, mediana 2,1 s), respaldo `gemini-3.5-flash-lite` (7/8). Muestra pequeña: 4 preguntas sencillas, 2 veces. El límite diario de estos dos modelos no se conoce. Ante 429 no se reintenta y se pasa directo al respaldo.
- **PDF en Blob:** `indexarDocumento` borra el PDF al terminar, se haya indexado o rechazado. Plan actualizado (2.2, 6.1, 16).
- **Blob real:** `probar:rag` ahora emite el token, sube, descarga, indexa y confirma el borrado contra Vercel Blob. Solo falta el navegador (`upload()`), en P07.
- **`db:limpiar`:** por defecto solo lista; borra con `npm run db:limpiar -- --confirmar`.
- **Capas:** `scripts/probar-rag.ts` ya no importa `conexion.ts`.
- **Resuelto en P05:** `/register` permite crear cuentas sin restricción y las tablas de Nova no tienen dueño; se limitó el acceso a una lista de correos (ver P05).

### P05 API

- **Archivos creados:** `src/app/api/nova/{tareas,documentos,documentos/subida,consultar}/route.ts`, `src/lib/auth/acceso.ts`, `tests/servidor/{sesion,rutas-nova}.test.ts`, `doc/checkpoints/FASE_4_COMPLETADA.md`.
- **Archivos modificados:** `src/lib/auth/sesion.ts`, `src/middleware.ts`, `src/lib/reglas/errores.ts` (código `ACCESO_DENEGADO`, 403), `src/lib/validacion/esquemas.ts` (`esquemaFiltroTareas`), `src/lib/datos/tareas.ts` (tipo del filtro), `doc/PLAN_NOVA.md` (secciones 4 y 12.2).
- **Decisión, control de acceso:** `/register` está abierto y las tablas de Nova no tienen dueño, así que cualquier cuenta nueva habría visto los PDF y las tareas y gastado la cuota de Gemini. `exigirSesion()` y el middleware ahora exigen que el correo esté en la lista de admins (`isAdminEmail`). `acceso.ts` vive aparte de `sesion.ts` porque el middleware corre en edge y no puede importar `next/headers`.
- **Decisión, ruta `/subida`:** responde con el formato propio de `handleUpload`, no con `{ ok, datos }`, porque `upload()` del navegador lo espera así. Los errores sí usan el formato del contrato. Sin `onUploadCompleted` no hay webhook, así que exigir sesión es seguro.
- **Verificación contra `next dev` con 2 usuarios temporales** (uno en la lista, otro no; ambos borrados):
  - Cuenta fuera de la lista: las 6 rutas dan 403 `ACCESO_DENEGADO`; `/nova` redirige a `/home`; `/home` 200; no se creó ninguna tarea.
  - Cuenta en la lista: `sesion` 200; prioridad 5 → 422 "La prioridad debe ser 1, 2 o 3"; fecha 2026-02-30 → 422 `FECHA_INVALIDA`; sin título → 400; tarea válida 201 con estado Pendiente y categoría General; sin prioridad queda en 2; filtro por estado y estado inválido (400); "Agenda" → 422 "La instrucción es demasiado corta"; sin documentos → 409 `SIN_DOCUMENTOS`.
  - Subida como el navegador: token para `.txt` rechazado (422), token para `.pdf` emitido, `put` correcto, `POST /documentos` 201 con 2 fragmentos, el listado lo muestra con su categoría, URL ajena 400.
  - Consultas reales: dato en el PDF respondido con cita; tareas pendientes con sus 2 citas; dato ausente → "No encontré esto en tus documentos" sin fuentes.
  - Limpieza: 0 tareas, 0 documentos, 0 fragmentos y 0 usuarios temporales.
- **Sin probar:** `/subida` desde el navegador (P07); las rutas en producción (sin commit ni push); el middleware con una cuenta admin real.
- **Pendientes:** `SUPABASE_ADMIN_EMAILS` no existe en Vercel: allí solo entra el correo incorporado en `admin.ts`.

### P06 Interfaz base y tareas

- **Archivos creados:** `src/components/ui/{Boton,Campo,Selector,Tarjeta,Insignia,Aviso,EstadoVacio}.tsx`, `src/components/nova/{NavegacionNova,InsigniaPrioridad,InsigniaEstadoTarea,FormularioTarea,TablaTareas}.tsx`, `src/app/nova/{layout,page}.tsx`, `src/app/nova/tareas/{page,nueva/page}.tsx`, `src/app/nova/documentos/page.tsx`, `tests/interfaz/{FormularioTarea,componentes}.test.tsx`.
- **Archivos modificados:** `src/app/globals.css` (tokens en `@theme`, sin borrar nada), `src/app/page.tsx`, `vitest.config.ts` (incluye `tests/**/*.test.tsx`).
- **Decisiones:**
  - **Fecha límite como texto `AAAA-MM-DD`, no como selector de fecha.** Un `<input type="date">` solo deja elegir fechas reales y los mensajes de la sección 5.1 nunca se verían. Se mantiene la validación en vivo con el mensaje exacto.
  - **Prioridad como selector 1/2/3** (como indica el plan). Por eso la interfaz no permite elegir 5: el rechazo de A-03 ("La prioridad debe ser 1, 2 o 3") solo se puede probar por la API (verificado en P05) o en las pruebas del componente.
  - **`app/page.tsx`** no era la plantilla de Next.js sino un `redirect('/login')`. Ahora sigue la tabla de la sección 4: sin sesión a `/login`, con acceso a `/nova` y sin acceso a `/home`.
  - **Marcadores de posición:** `/nova` (Asistente) y `/nova/documentos` son páginas con un aviso de que llegan en P08 y P07; sin ellas, el login y la barra de navegación llevarían a un 404.
  - **Insignias:** fondo tintado y texto oscurecido, porque el color puro de prioridad media (#B7791F) no alcanza contraste AA sobre blanco.
  - **Fechas:** `Intl` es-CO con `dateStyle: medium` y UTC da `10/03/2026`, tal como indica el plan.
  - **Sin `confirmar` de errores de red** más allá de un aviso con opción de reintentar.
- **Verificación en un navegador real** (Edge controlado con `puppeteer-core`, instalado fuera del proyecto; usuario temporal y tareas de prueba ya borrados; 33 comprobaciones, 0 fallas):
  - `/` sin sesión → `/login`; el login lleva a `/nova`; fondo #F6F6FA y barra #5B3DF5; aviso de privacidad y correo visibles.
  - Estado vacío con guía; sección actual marcada con `aria-current`.
  - Formulario: categoría General y prioridad 2 por defecto; la fecha `2026-02-30` y `03-10-2026` se rechazan en vivo con el mensaje exacto; sin título muestra error y no guarda; tarea válida guardada (Alta, Pendiente, General, fecha de creación de hoy); fecha pasada y sin tocar prioridad queda en 2.
  - Filtro por estado (Pendientes, Completadas, estado inválido ignorado).
  - 390 px: tarjetas en lugar de tabla, sin desplazamiento horizontal, menú desplegable; formulario sin desplazamiento horizontal.
  - Cerrar sesión lleva a `/login` y `/nova` vuelve a exigir sesión; sin errores de consola.
- **Problema de la prueba (no de la app):** un primer intento falló porque el triple clic no seleccionaba el campo de fecha y quedó la fecha inválida; el formulario hizo bien en no guardar. Se corrigió la prueba con Ctrl+A.
- **Sin probar:** en un teléfono real; con lector de pantalla; en producción (sin commit ni push); un contraste medido con herramienta (solo ajustado por criterio).
- **Pendientes:** la acción "Completar" (P10), Productividad y Web en la navegación (P10, P11); `/nova` y `/nova/documentos` son marcadores.

### P07 Documentos, más completar y eliminar tareas

- **Archivos creados:** `src/components/nova/{SubidorPdf,TablaDocumentos,AccionesTarea}.tsx`, `src/app/nova/documentos/nuevo/page.tsx`, `src/app/api/nova/tareas/[id]/route.ts`, `src/app/api/nova/tareas/[id]/completar/route.ts`, `tests/interfaz/{SubidorPdf,AccionesTarea}.test.tsx`, `tests/servidor/tareas-acciones.test.ts`.
- **Archivos modificados:** `src/app/nova/documentos/page.tsx` (deja de ser marcador), `src/components/nova/TablaTareas.tsx`, `src/lib/datos/tareas.ts`, `src/lib/dataService.ts`, `src/lib/validacion/esquemas.ts`, `src/lib/llm/gemini.ts`, `src/app/api/nova/documentos/route.ts`, `tests/servidor/gemini.test.ts`, `tests/interfaz/componentes.test.tsx`, `doc/PLAN_NOVA.md`, `doc/PROMPTS_NOVA.md`.
- **Cambio de alcance pedido por el usuario:** completar tarea (F5) se adelanta desde P10 y eliminar tarea se agrega; no estaba en el plan. El plan se actualizó (3.2, 3.3, 3.4, RN-19, CU-07, 12.3, 13 y 16). Eliminar aplica solo a tareas, es definitivo y pide confirmación; los documentos siguen sin poder borrarse.
- **Problema encontrado, cuota de embeddings:** el plan gratuito de Gemini limita a 30.000 tokens por minuto. Con lotes de 50, un lote de texto denso podía superarlo por sí solo y no pasar nunca, y un 429 hacía fallar toda la indexación. Ahora: lotes de 20; ante un 429 espera el `retryDelay` que indica Gemini si cabe en el tiempo de la ruta; una cuota diaria falla enseguida con un mensaje claro. `POST /api/nova/documentos` pasa a `maxDuration = 300`. Medido con Gemini real: 140 fragmentos (unas 63.000 palabras) en 133 s, unos 60 fragmentos por minuto. Con 270 s de espera máxima caben unos 280 fragmentos (unas 125.000 palabras); un documento mayor recibe el mensaje de límite. La cifra es orientativa: el texto real puede gastar más tokens por palabra.
- **Decisiones:**
  - `completarTarea` lleva la condición en el `UPDATE`, para que dos envíos simultáneos no sobrescriban los minutos.
  - `SubidorPdf` sube con una ruta sin caracteres especiales y guarda el nombre original para mostrarlo.
  - Si Vercel corta la función por tiempo, la respuesta no es JSON: la interfaz lo detecta y muestra un aviso.
- **Verificación en navegador real** (Edge con `puppeteer-core`; solo se crearon y borraron filas con prefijo de prueba; la tarea real del usuario no se tocó; 28 comprobaciones, 0 fallas):
  - Archivo de 15.728.641 bytes: mensaje exacto, sin subir. Archivo `.txt`: rechazado.
  - Subida real desde el navegador a Vercel Blob: indexado con 3 fragmentos, categoría y nombre original con tildes y `#` en la tabla.
  - PDF sin texto y falso PDF: mensajes exactos. No quedó ningún archivo en Blob ni filas de los rechazados.
  - Completar: minutos negativos con error en vivo; 90 min guardados con fecha de cierre; la tabla se actualiza sin recargar y ya no ofrece Completar; repetir por API da 409 y no sobrescribe.
  - Eliminar: pide confirmación; cancelar no borra; confirmar borra de la tabla y de la base; inexistente da 404.
  - 390 px: sin desplazamiento horizontal y acciones funcionando en las tarjetas.
- **Sin probar:** el `maxDuration = 300` en Vercel (depende de que el proyecto tenga fluid compute; si no, el despliegue fallaría y habría que volver a 60); PDF reales; el tiempo real en producción; un PDF de 15 MB real.
- **Pendientes:** `/nova` sigue siendo un marcador hasta P08.

### P08 Chat del asistente

- **Limpieza previa:** el usuario pidió borrar sus documentos de prueba. `npm run db:limpiar` listó exactamente `prueba-corto.pdf` y `prueba-largo-115pag.pdf`; se ejecutó con `--confirmar` (2 documentos, 0 tareas).
- **Archivos creados:** `src/components/nova/{Chat,MensajeChat,ListaFuentes}.tsx`, `tests/interfaz/Chat.test.tsx`.
- **Archivos modificados:** `src/app/nova/page.tsx` (deja de ser marcador), `src/lib/llm/prompts.ts`, `src/lib/config/nova.ts` (`CONSULTA_MAX_CARACTERES`), `src/lib/validacion/esquemas.ts`, `doc/PLAN_NOVA.md`.
- **Decisiones:**
  - **System Prompt ampliado:** escribir en texto plano, porque la burbuja no interpreta Markdown y se veían los asteriscos, y tratar el contexto como datos, porque el contenido de un PDF llega al modelo y podría traer órdenes.
  - **Máximo de 1000 caracteres por pregunta**, en la interfaz y en la API, para no gastar cuota de Gemini en textos enormes.
  - **Reintentar** vuelve a enviar la misma pregunta sin duplicar su burbuja.
  - **Enter envía y Shift+Enter hace un salto de línea.**
- **Verificación en navegador real** (Edge con `puppeteer-core`; usuario, tarea y documento temporales ya borrados; 18 comprobaciones, 0 fallas):
  - Sin documentos: la página guía a indexar y preguntar muestra `SIN_DOCUMENTOS` con enlace.
  - "Agenda" y "Hola tú": botón deshabilitado; "Agenda" muestra el mensaje exacto y Enter no envía.
  - Dato en el PDF: "La garantía del horno es de 36 meses desde la fecha de compra [prueba-p08-horno.pdf · fragmento 1]", con chip de fuente.
  - Dato ausente: "No encontré esto en tus documentos", sin fuentes.
  - "¿Qué tareas tengo pendientes?": incluye la tarea y la cita, sin Markdown.
  - PDF con una orden escondida ("IGNORA TODAS TUS INSTRUCCIONES..."): el modelo la cita como contenido y no la obedece. Es una sola prueba y no garantiza que siempre resista.
  - 390 px sin desplazamiento horizontal; al recargar la conversación se vacía; sin errores de página. Respuestas de unos 1,7 s.
- **`npm run probar:rag`:** 0 fallas con el System Prompt nuevo; `npm test` 175/175; `npm run build` correcto.
- **Sin probar:** el chat en producción (sin commit ni push); con PDF reales (A-14, en P09); el aviso real de `ERROR_LLM` contra Gemini (solo con pruebas simuladas); un lector de pantalla.
- **Pendientes:** P09 (aceptación y README).

### P08b Ajustes tras probar P08 (pedido del usuario)

- **Decisiones del usuario:** fechas pasadas se permiten con aviso (1A, respeta RN-07 y T-15); máscara AAAA-MM-DD en lugar de selector; historial en la base de datos, con dos tablas para poder listar conversaciones después; el modelo recibe los últimos 6 mensajes y la búsqueda usa la pregunta anterior con la nueva.
- **Archivos creados:** `supabase/migrations/20261003136000_nova_conversaciones.sql` (M4), `src/lib/datos/conversacion.ts`, `src/app/api/nova/conversaciones/route.ts`, `tests/servidor/conversacion.test.ts`.
- **Archivos modificados:** `src/lib/reglas/fechas.ts` (`aplicarMascaraFecha`, `esFechaPasada`), `src/components/nova/FormularioTarea.tsx`, `src/lib/reglas/consulta.ts` (`textoDeBusqueda`), `src/lib/datos/consulta.ts`, `src/lib/llm/gemini.ts` (turnos de historial), `src/lib/llm/prompts.ts`, `src/lib/auth/sesion.ts` (devuelve también el id), `src/app/api/nova/consultar/route.ts`, `src/app/nova/page.tsx`, `src/components/nova/Chat.tsx`, `src/lib/reglas/errores.ts` (`CONVERSACION_NO_ENCONTRADA`), `src/lib/config/nova.ts`, `src/lib/validacion/esquemas.ts`, `src/lib/datos/tipos.ts`, `src/lib/dataService.ts`, `scripts/verificar-bd.mjs`, `scripts/probar-rag.ts`, `doc/PLAN_NOVA.md` (RN-07, RN-20, RN-21, CU-08, sección 8.5, API, A-19, A-20), `doc/PROMPTS_NOVA.md` (nota en P08).
- **Decisiones técnicas:**
  - El guion de la máscara aparece al escribir el dígito siguiente, para que borrar no se trabe. `2026-02-30` se puede escribir y conserva el mensaje exacto.
  - `mensajes_chat` tiene una clave foránea compuesta `(conversacion_id, usuario_id)`: la base impide un mensaje con un usuario distinto al de su conversación. El id del usuario sale siempre de la sesión.
  - Solo se guarda una pregunta que obtuvo respuesta, junto con ella y en una transacción. Si el guardado falla, la respuesta se entrega igual (`guardada: false`) y el chat lo avisa.
  - "Conversación nueva" crea otra y conserva la anterior (si la más reciente está vacía, la reutiliza). No pide confirmación porque no borra nada.
  - RN-12 también usa la pregunta anterior: un seguimiento de una pregunta sobre tareas recibe las tareas.
- **`npm run db:migrar`:** M4 aplicada. **`npm run db:verificar`:** 0 fallas, con 3 comprobaciones nuevas (mensaje válido, mensaje con otro usuario 23503, autor inválido 23514). La comprobación f) de `buscar_fragmentos` contaba todas las filas y fallaba si había documentos reales; ahora cuenta solo las del documento de prueba.
- **`npm run probar:rag`:** 0 fallas. Paso nuevo 6b con Gemini real: "¿y el segundo?" respondió "El segundo paso es girar la carcasa hacia la izquierda [prueba-nova-rag.pdf · fragmento 1]".
- **Navegador real** (Edge con `puppeteer-core`, dos usuarios temporales ya borrados con sus conversaciones; 21 de 22 comprobaciones):
  - "¿y el segundo?" tras preguntar los pasos de limpieza responde "retirar la bandeja de vidrio", con cita.
  - Escribir `20200101` deja `2020-01-01`, aparece el aviso y la tarea se guarda; `20260230` muestra el mensaje exacto.
  - Al salir a Tareas y volver por el menú, y tras recargar, siguen las 4 burbujas; en la base, 1 conversación y 4 mensajes del usuario.
  - Preguntar y salir a Documentos mientras piensa: al volver, la respuesta está.
  - Otro usuario no ve la conversación y recibe 404 `CONVERSACION_NO_ENCONTRADA` al intentar escribir en ella.
  - "Conversación nueva" deja la pantalla vacía, también tras recargar, y la anterior queda en la base (2 conversaciones). 390 px sin desplazamiento horizontal y sin errores de página.
  - La comprobación que falló estaba mal planteada: en la conversación nueva, sin historial, "¿y el segundo?" también respondió "retirar la bandeja", porque el único PDF dice literalmente "segundo, retirar la bandeja". No prueba una fuga de historial; que la conversación nueva arranca vacía lo muestran la recarga con 0 mensajes y la prueba unitaria.
- **Archivo `doc/CORREO RESEND VERCEL CONNECT (1).md`:** revisado sin mostrar valores. No tiene claves ni tokens: solo identificadores de conector, el nombre de la variable `VERCEL_OIDC_TOKEN` y el remitente público de prueba de Resend. No se agregó al `.gitignore`. Nunca llegó a GitHub: solo está en dos commits de puntos de control locales del agente (`refs/agents/...`), que no están en ninguna rama. Se deja fuera de los commits.
- **Sin probar:** el historial y el seguimiento en producción hasta el despliegue; un lector de pantalla.
- **Despliegue:** push a `master` hecho (`c298f05`, `17b812e`), pero Vercel falló tres veces con `BUILD_FAILED` "Resource provisioning timed out": no consiguió máquina de build y el build nunca empezó (0 ms, sin registro). Vercel tuvo un incidente de builds ese día (18:25 a 18:50 UTC, marcado como resuelto); los intentos fueron entre 18:58 y 19:14 UTC. `next build` local pasa. Producción siguió con el despliegue anterior (P07).
- **Despliegue (más tarde):** unas 6 horas después, `vercel redeploy` del mismo commit terminó en Ready en 2 minutos y quedó en https://nova-assistantsm-kappa.vercel.app. Comprobado: `/api/health` 200, `/login` 200, `/nova` 307 y `/api/nova/conversaciones` 401 sin sesión.

### P08c Eliminar documento (pedido del usuario)

- **Cambio respecto al plan:** el plan funcional dejaba fuera de alcance "borrado de documentos indexados" (sección 3.3) y RN-19 decía que los documentos no se borran. Se agregó a pedido del usuario: RN-22, CU-09, `DOCUMENTO_NO_ENCONTRADO`, A-21.
- **Archivos creados:** `src/app/api/nova/documentos/[id]/route.ts`, `src/components/nova/EliminarDocumento.tsx`, `tests/servidor/documentos-eliminar.test.ts`, `tests/interfaz/EliminarDocumento.test.tsx`.
- **Archivos modificados:** `src/lib/datos/documentos.ts` (`eliminarDocumento`), `src/components/nova/TablaDocumentos.tsx` (columna Acciones y botón en las tarjetas), `src/lib/reglas/errores.ts`, `src/lib/validacion/esquemas.ts`, `src/lib/dataService.ts`, `doc/PLAN_NOVA.md`.
- **Decisiones:** borrado definitivo con confirmación, igual que eliminar tarea. Los fragmentos caen por la cascada que ya tenía M1; no hace falta tocar Blob porque el PDF se borra al indexar. Los mensajes del chat que citaban el documento conservan la cita como texto.
- **Navegador real** (Edge con `puppeteer-core`; usuario y documento temporales ya borrados; 8 comprobaciones, 0 fallas): el botón está en la tabla y en la tarjeta móvil, pide confirmación, Cancelar no borra, al confirmar la fila desaparece y en la base el documento y sus fragmentos quedan en 0. 390 px sin desplazamiento horizontal y sin errores de página.

### P09 Aceptación del MVP

- **TAREA 1:** `npm test` 209/209 al empezar; `npm run probar:rag` 0 fallas, con el paso 9 (`SIN_DOCUMENTOS`) ejecutado porque la base estaba vacía. Pero el paso 7 pasó con un defecto que la prueba no detectaba: el modelo citó `[Tarea T1]`, el índice interno que ponía `construirContexto`, y `armarFuentes`, al no reconocer la cita, devolvió las 4 fuentes entregadas (3 fragmentos y la tarea).
  - **Corrección (en el código):** `construirContexto` encabeza cada fuente solo con su etiqueta citable (`[a.pdf · fragmento 1]`, `[Tarea 1a2b3c4d]`), sin `[1]` ni `[T1]`, y el System Prompt pide copiar esa etiqueta. Prueba nueva en `tests/servidor/consulta.test.ts`; el paso 7 de `probar:rag` ahora exige que todas las fuentes sean tareas. Repetido: "- Prueba renovar pasaporte [Tarea 2adcd461]", fuente solo la tarea.
- **TAREA 2 (secciones 10.3 y 16):** sin hallazgos. Detalle en `doc/checkpoints/FASE_6_COMPLETADA.md`: mensajes de 5.1 textuales; reglas sin red ni base; Gemini solo en `lib/llm` (fuera, solo comentarios y los nombres de modelo de `lib/config/nova.ts`, que la sección 10.4 pone allí); las 9 rutas con `exigirSesion`; tamaño del PDF también en el servidor; vectores como parámetro casteado; textos en español; estado con texto además de color.
- **TAREA 3:** `doc/ACEPTACION.md` con A-01 a A-15 (columnas de resultado, evidencia y observación vacías), notas para A-03, A-04, A-05 y A-13, la planilla de A-14 (3 PDF, 10 preguntas, ≥ 7) y una sección aparte con A-19 a A-21. A-16 a A-18 quedan como opcionales (A-16 ya se puede ejecutar).
- **TAREA 4:** `README.md` nuevo (no existía): qué es RAG, funcionalidades, tecnologías, requisitos, variables por nombre, cómo correr en local, scripts, estructura, privacidad, claves fuera del repositorio y enlace al plan.
- **TAREA 5:** `.env.local` y `.env.respaldo.local` ignorados por `.env*.local`. Búsqueda en los archivos versionados de claves de Gemini, tokens de Blob, JWT, claves de Resend y cadenas de conexión con contraseña: ninguna. `.env.example` tenía solo valores de ejemplo; se le agregaron los nombres de las variables de Nova sin valor.
- **Plan:** la sección 11 describe el nuevo formato del contexto; A-21 quedó después de A-20; la fase 6 menciona A-19 a A-21.
- **Al cierre:** `npm test` 210/210, `npm run build` correcto, `eslint` sin errores; `tsc` mantiene los 2 errores previos de `src/lib/__tests__/json-db.test.ts`. Checkpoints `FASE_5_COMPLETADA.md` y `FASE_6_COMPLETADA.md`.
- **Pendiente del usuario:** ejecutar A-01 a A-15 y A-19 a A-21 en Vercel; A-14 con 3 PDF reales y 10 preguntas.
- **Aceptación en Vercel (ejecutada por el usuario, 2026-11-06):** A-01 a A-15 y A-19 a A-21 pasan. A-14: 10 de 10 con `politica-teletrabajo.pdf`, `guia-viaje-cartagena.pdf` y `manual-laboratorio-quimica.pdf`. A-11 se cubrió con "¿Quién es el presidente de la empresa?" ("No encontré esto en tus documentos"); faltaba en la lista de pasos que se le dio al usuario. Prueba extra: "¿Cuánto cuesta el desayuno en el hotel?" respondió que está incluido en la tarifa, citó la guía y no inventó precio. Registro en `doc/ACEPTACION.md`.

### P10 Opcionales: completar tarea e índice de productividad

- **F5 (completar tarea):** ya estaba hecho desde P07 (a pedido del usuario); no se tocó.
- **Archivos creados:** `src/app/api/nova/productividad/route.ts`, `src/components/nova/TarjetaProductividad.tsx`, `src/app/nova/productividad/page.tsx`, `tests/servidor/productividad.test.ts`, `tests/interfaz/TarjetaProductividad.test.tsx`.
- **Archivos modificados:** `src/lib/datos/productividad.ts` (deja de ser stub), `src/lib/datos/tipos.ts`, `src/lib/llm/prompts.ts` (`SYSTEM_PROMPT_PRODUCTIVIDAD`, `SIN_RECOMENDACION`), `src/lib/dataService.ts`, `src/components/nova/NavegacionNova.tsx` (enlace "Productividad"), `doc/PLAN_NOVA.md`, `doc/ACEPTACION.md`.
- **Decisiones:**
  - Una sola consulta SQL cuenta las tareas del día, las completadas y la suma de sus minutos (BIGINT para no desbordar). Con 0 tareas devuelve `{ sinTareas: true }` sin llamar a Gemini (RN-18).
  - El resultado incluye `totales`, `completadas` y `minutos`, y la tarjeta muestra la fórmula, para que el número se pueda comprobar a mano.
  - Si Gemini falla, el índice se entrega igual con "No se pudo generar la recomendación en este momento." (`recomendacionDisponible: false`): los números no dependen del modelo. Un error que no es de negocio sí se propaga.
  - La fecha usa la misma máscara AAAA-MM-DD que las tareas; el valor inicial (hoy en Bogotá) llega del servidor. El cálculo inicial se hace una sola vez, aunque React monte dos veces en desarrollo, para no pedir dos recomendaciones.
  - El nivel se muestra con texto ("Nivel: Excelente") y color (rojo, ámbar, verde).
- **T-24 a T-28:** pasan (creadas en P02).
- **Verificación:** Edge no arrancó (salía sin error, también fuera de puppeteer), por una actualización a la versión 157 pendiente con Edge abierto. No se tocó el navegador del usuario; la verificación se hizo por HTTP contra `next dev` con una sesión real (login por `/api/auth/login`), la base y Gemini reales: 12 comprobaciones, 0 fallas.
  - 5 tareas del 2099-12-29 (fecha libre), 4 completadas con 30 min: 86,0 Excelente (a mano 56 + 30). Recomendación: "Has logrado un nivel excelente, así que intenta completar esa tarea pendiente mañana para alcanzar el puntaje máximo. [...]".
  - Pasando a 3 completadas con 10 min cada una: 49,5 Bajo (a mano 42 + 7,5).
  - 2099-12-28: `{ sinTareas: true }`. `2026-02-30`: 422 `FECHA_INVALIDA`. Sin fecha: calcula hoy. Sin sesión: 401.
  - Volver a completar una tarea: 409 `TAREA_YA_COMPLETADA`, minutos sin cambio.
  - `/nova/productividad` responde 200 con sesión y la navegación incluye el enlace.
  - Usuario y tareas temporales borrados. Un intento previo con Edge creó el usuario temporal antes de fallar; se borró a mano.
- **Sin verificar:** la tarjeta en un navegador real (cubierta por las pruebas de interfaz con jsdom); A-16 y A-17 en Vercel.
- **Al cierre:** `npm test` 224/224, `npm run build` correcto, `eslint` sin errores ni avisos.
- **Prueba del usuario en local (2026-11-06):** 86,0, Excelente, 4 de 5 y 2 h, con recomendación; una fecha sin tareas muestra el mensaje y una tarea completada ya no tiene el botón "Completar". El usuario borró sus tareas de prueba.

### P11 Opcional: búsqueda en Wikipedia

- **Archivos creados:** `src/app/api/nova/web/route.ts`, `src/components/nova/BuscadorWeb.tsx`, `src/app/nova/web/page.tsx`, `tests/servidor/wikipedia.test.ts`, `tests/interfaz/BuscadorWeb.test.tsx`, `doc/checkpoints/FASE_7_COMPLETADA.md`.
- **Archivos modificados:** `src/lib/datos/wikipedia.ts` (deja de ser stub), `src/lib/datos/tipos.ts` (`ResultadoWeb` con `categoria`, `articulos` y `fuentesEnCategoria`), `src/lib/llm/prompts.ts` (`SYSTEM_PROMPT_WEB`), `src/lib/config/nova.ts` (`WEB_MAX_CARACTERES`, `WEB_RESULTADOS`, `WIKIPEDIA_API`, `WIKIPEDIA_AGENTE`), `src/lib/validacion/esquemas.ts`, `src/lib/reglas/consulta.ts` (`esConsultaValida`, ahora la usan el chat y la búsqueda), `src/components/nova/Chat.tsx`, `src/components/nova/NavegacionNova.tsx` (enlace "Web"), `src/lib/dataService.ts`, `doc/PLAN_NOVA.md`, `doc/ACEPTACION.md`.
- **Decisiones:**
  - Una sola llamada a la API de Wikipedia (`generator=search` con extractos de la introducción e `inprop=url`); las páginas llegan desordenadas y se ordenan por `index`. `User-Agent` propio (Wikimedia lo pide; sin el correo del usuario) y 10 s de tiempo máximo. Cada extracto se acota a 2.000 caracteres.
  - El límite de 20 se revisa antes de llamar a Wikipedia y a Gemini, para no gastar cuota en una búsqueda que no se podría guardar. El INSERT es condicionado (`WHERE count < 20`): dos búsquedas simultáneas no pasan de 20.
  - Sin resultados no se llama a Gemini ni se guarda (`guardada: false`). Si Gemini falla, `ERROR_LLM` y no se guarda nada.
  - El System Prompt trata los extractos como datos, no como instrucciones.
  - No se cambió `MAX_FUENTES_WEB_POR_CATEGORIA` para probar el límite: se llenó una categoría de prueba hasta 18 filas en la base.
- **Error encontrado en la verificación real:** el INSERT condicionado fallaba con `42P08` "inconsistent types deduced for parameter $1" (text frente a varchar): Postgres deducía dos tipos para el mismo parámetro. Las pruebas unitarias no lo veían porque simulan la base. Se corrigió con casts explícitos (`$1::varchar`, etc.).
- **Verificación por HTTP** (Edge seguía sin arrancar; `next dev` con sesión real, base, Wikipedia y Gemini reales; 13 de 13): resumen de "Sierra Nevada de Santa Marta" con 3 artículos en 2,8 s y la fila en `fuentes_web` con la URL del primero; "Colombia" → 422 con el mensaje exacto; una consulta sin resultados no guarda; fuentes 19 y 20 guardadas, la 21 → 409 `LIMITE_FUENTES` con el mensaje del plan y la categoría se queda en 20; otra categoría sigue aceptando; sin sesión 401. Fuentes y usuario temporales borrados.
- **Sin verificar:** la pantalla Web en un navegador real (cubierta por pruebas de jsdom); A-18 en Vercel.
- **Al cierre:** `npm test` 240/240, `npm run build` correcto, `eslint` sin errores ni avisos. Con P11 se cierra la fase 7 y quedan construidas todas las funcionalidades del plan.
- **Prueba del usuario en local (2026-11-06):** "Sierra Nevada de Santa Marta" mostró resumen, artículos con enlace y la fuente guardada en General; "Colombia" dejó el botón deshabilitado con el mensaje de instrucción corta; "xqzvw plmkj" dijo que no encontró artículos y no guardó. Con su confirmación se borró la única fuente que quedó (la de su prueba); `fuentes_web` quedó vacía.

### E00 Ampliación: rama y vista previa

- Rama `ampliacion` creada desde `master`; commit `docs: plan y prompts de la ampliación` (`doc/PLAN_AMPLIACION.md`, `doc/PROMPTS_AMPLIACION.md`, con la etapa E09 Editar tareas y la nota del disparador temporal pedidas por el usuario).
- Vista previa estable: https://nova-assistant-git-ampliacion-dlrjuank.vercel.app. Tiene la protección de Vercel (pide iniciar sesión en Vercel); el usuario entró desde el teléfono y vio el Asistente.
- Variables de Preview comprobadas por nombre: las mismas que usa producción.

### E01 Ampliación: dueño por usuario (M5)

- **Respaldo previo** (pedido del usuario): `scripts/respaldo.mjs` (`npm run db:respaldar`) exporta a CSV las 6 tablas de Nova en una sola instantánea, en `respaldos/` (ignorada por git: contiene el texto de los documentos). `scripts/restaurar-respaldo.mjs` (`npm run db:restaurar`) compara, restaura con `--confirmar` (solo agrega filas que falten, en una transacción) o hace un simulacro con `--probar`. Respaldo tomado: `respaldos/2026-11-06_191729` (0 tareas, 0 documentos, 0 fragmentos, 0 fuentes, 5 conversaciones, 20 mensajes); el simulacro restauró todo y se revirtió.
- **Migración M5** `supabase/migrations/20261106100000_nova_dueno.sql`: `nova_config` con el dueño por defecto, `usuario_id` nullable en `tareas_personales`, `documentos` y `fuentes_web`, relleno, disparador temporal `asignar_dueno_por_defecto` (se quita al unir con master, E21), índices y `buscar_fragmentos_usuario`.
- **Error al aplicarla:** la primera versión de `buscar_fragmentos_usuario` llevaba `SET hnsw.iterative_scan = strict_order` en la definición y Supabase respondió "permission denied to set parameter"; `db:migrar` revirtió la transacción. La prueba en seco no lo había detectado. Se cambió a plpgsql con `set_config('hnsw.iterative_scan', 'strict_order', true)`, que sí está permitido y solo dura la transacción.
- **Compatibilidad con master** (plan, 11.3): `git worktree` de `master` (d175142) en una carpeta temporal; su `db:verificar` y su `probar:rag` contra la base migrada: 0 fallas cada uno. Worktree borrado.
- **Código:** todos los servicios de tareas, documentos, fragmentos, consulta, productividad y Wikipedia reciben primero el id del usuario de la sesión y filtran por `usuario_id`; las rutas y páginas lo toman de `exigirSesion()`, nunca del cuerpo. Un registro de otro usuario responde como inexistente (`TAREA_NO_ENCONTRADA`, `DOCUMENTO_NO_ENCONTRADO`). RN-05 (20 fuentes) y RN-15 (sin documentos) pasan a ser por usuario.
- **Pruebas:** `tests/servidor/aislamiento.test.ts` (6) y las existentes adaptadas; `db:verificar` amplió la sección 6b (columnas, `nova_config`, disparadores, índices, filas sin dueño, INSERT como master, INSERT explícito, búsqueda por usuario); `probar:rag` agregó el paso 10 con un usuario temporal de Supabase (se borra al final).
- **Al cierre:** `npm test` 247/247, `npm run build` correcto, `eslint` sin errores (el único aviso es de `eslint.config.mjs`, sin cambios), `db:verificar` 0 fallas, `probar:rag` 0 fallas.
- **Prueba del usuario en producción (2026-11-06):** A-02, A-05, A-06, A-10, A-12, A-15, A-16, A-17, A-18, A-21 y B-01 pasan. `db:verificar` confirmó que todo lo creado quedó con su dueño. Datos de prueba borrados con su confirmación (5 tareas "prueba 1" a "prueba 5" y la fuente de Sierra Nevada, en una transacción). Queda la fuente "Gripe" (General, 2026-11-06) pendiente de su decisión.

### E02 Ampliación: diseño base

- **Tokens** en `src/app/globals.css`: variables `--nova-*` para claro, oscuro (`data-tema='oscuro'`) y automático (`prefers-color-scheme`, salvo `data-tema='claro'`), expuestas a Tailwind con `@theme inline` (`bg-fondo`, `text-acento`, `bg-peligro/12`...), más los 8 colores de categoría y `shadow-suave`. El acento suave claro pasó de `#F6E3D9` a `#FBEDE5`: con el primero, acento sobre acento suave daba 4,38:1.
- **Tema sin parpadeo:** `src/lib/tema.ts` con `SCRIPT_TEMA` en el `<head>` de `src/app/layout.tsx`; lee `nova-tema` del navegador (el selector llega en E11, Configuración).
- **Componentes:** `lucide-react` 0.468; Aviso con ícono y rótulo, Boton (`CLASE_FOCO` compartida, foco con el acento), Campo, Selector, Insignia (tonos neutro, acento, peligro, aviso, exito), Tarjeta y EstadoVacio redondeados con sombra suave; nuevos `EncabezadoPantalla` y `Pestanas` (píldoras, pestaña en la URL). Las 7 pantallas de Nova usan `EncabezadoPantalla`; los filtros de Tareas usan `Pestanas`. La navegación actual se reestiló con tokens (E03 la reemplaza).
- **Pruebas:** `tests/reglas/contraste.test.ts` (≥ 4,5:1 en claro, oscuro y automático para texto, acento, estados, insignias tintadas y categorías; automático igual a oscuro; ningún color de la paleta de Tailwind ni literal en `src/components/ui`, `src/components/nova` y `src/app/nova`) y `tests/interfaz/diseno.test.tsx` (script del tema, encabezado, pestañas, insignia).
- **Navegador real** (Edge 157 ya arranca, con `puppeteer-core` en el scratchpad; `next start` con sesión real de un usuario temporal, borrado al final): las 7 pantallas en claro y oscuro, a 1280 y 390 px: 28 de 28 sin desborde horizontal, sin errores de página y con su encabezado; tema guardado "oscuro" con el sistema en claro se aplica antes de pintar; foco visible (contorno sólido de 2 px del acento).
- **Fuera de Nova:** login, registro y el panel de administración conservan sus colores hasta E04.
- **Al cierre:** `npm test` 259/259, `npm run build` correcto, `eslint` sin errores (el aviso de `eslint.config.mjs` sigue). `probar:rag` no se repitió: E02 no toca datos ni servicios (se corrió en E01).

### E02b Ampliación: Asistente sin documentos (pedida por el usuario)

- **Regla RB-30** (aprobada por el usuario; reemplaza a RN-15 en la ampliación y cambia A-13): con documentos, la consulta sigue igual; sin documentos pero con tareas pendientes, responde con las tareas (sin vector, sin filtro por palabras); sin ninguno, `SIN_DOCUMENTOS`. Mensajes exactos sin cambios. Al modelo van como máximo las 50 tareas pendientes de fecha límite más próxima (`TAREAS_CONTEXTO_MAX`, ajuste pedido por el usuario).
- **Pantalla del Asistente:** `avisoAsistente(hayDocumentos, hayTareasPendientes)` decide entre el aviso de siempre y el informativo nuevo ("Aún no hay documentos indexados: por ahora el asistente responde solo sobre tus tareas pendientes.", con el enlace "Indexar un PDF").
- **Archivos:** `src/lib/datos/consulta.ts`, `src/lib/datos/tareas.ts` (`hayTareasPendientes`, límite en `tareasPendientesComoTexto`), `src/lib/config/nova.ts`, `src/lib/reglas/consulta.ts`, `src/app/nova/page.tsx`, `src/lib/dataService.ts`, `scripts/probar-rag.ts`, pruebas en `tests/servidor/consulta.test.ts`, `tests/servidor/aislamiento.test.ts` y `tests/reglas/consulta.test.ts`; documentos `PLAN_AMPLIACION.md` (RB-30, B-43), `PROMPTS_AMPLIACION.md` (sección E02b) y `ACEPTACION.md` (nota de A-13).
- **Interrupción:** el computador se apagó durante `probar:rag`. Esa ejecución dejó una tarea, un documento de prueba y un usuario temporal; se borraron (solo esas filas, creadas por el script) y `probar:rag` se repitió completo. Después, por pedido del usuario, se revisó el estado: rama `ampliacion` sin commits por subir, los 10 archivos modificados eran de E02b, sin cuentas de prueba ni filas de otras cuentas, `db:verificar` 0 fallas, `npm test` 268/268 y build correcto. El usuario decidió continuar.
- **`probar:rag`** (0 fallas): el paso 9 se omite si la cuenta tiene documentos o tareas pendientes; paso 11a, un usuario temporal sin documentos y con una tarea pendiente recibe la tarea citada; paso 11b, una pregunta de PDF responde el mensaje exacto.
- **Al cierre:** `npm test` 268/268, `npm run build` correcto, `eslint` sin errores (sigue el aviso de `eslint.config.mjs`). No se tocaron la tarea "Prueba" ni la fuente "Gripe" del usuario.
- **Prueba del usuario en la vista previa:** sin documentos, "que me falta por hacer" respondió con su tarea y la citó, y el aviso informativo apareció con el enlace. "que tengo para hacer esta semana" respondió "No encontré esto en tus documentos": el modelo no conocía la fecha de hoy. Se corrigió en E02c.

### E02c Ampliación: fecha de hoy y preguntas por fechas (pedida por el usuario)

- **Causa:** ni el System Prompt ni el contexto traían la fecha de hoy; con documentos, además, "semana", "mañana" y "hoy" no estaban entre las palabras que llevan las tareas al contexto.
- **RB-31:** `lineaHoy()` en `src/lib/reglas/fechas.ts` (con `semanaDe`, `sumarDias` y `fechaLarga`) arma la primera línea del contexto con hoy, mañana y la semana de lunes a domingo, calculadas con `America/Bogota` explícita (`hoyBogota`), no con la hora del servidor. `construirContexto` recibe la línea; cada tarea lleva también su fecha AAAA-MM-DD. El System Prompt explica la línea HOY y pide "No tienes tareas para {periodo}." con la tarea pendiente más próxima cuando no hay tareas en el periodo. Palabras nuevas en RN-12: semana, mañana, manana, hoy, vencid. El usuario eligió que el modelo escriba esa respuesta (no el servidor).
- **Pruebas:** 10 nuevas (semana y bordes, `sumarDias`, `fechaLarga`, domingo 22:30 en Bogotá con UTC ya en lunes, cambio exacto a la medianoche de Bogotá, línea HOY primero con y sin documentos, AAAA-MM-DD en las tareas, regla en el System Prompt, palabras clave y "primer paso" excluido).
- **`probar:rag` paso 12 con Gemini real** (0 fallas en total): "¿Qué tengo para hacer esta semana?" con una sola tarea en 2099 respondió "No tienes tareas para esta semana. La tarea pendiente más próxima es: Prueba pagar el recibo de la luz (2099-02-01)" con su cita; "¿Qué tengo para mañana?" respondió solo la tarea de mañana, citada; "¿Qué vence primero?" respondió esa misma tarea. Los pasos 1 a 11 (incluido B-43) siguen pasando.
- **Al cierre:** `npm test` 278/278, `npm run build` correcto, `eslint` sin errores. No se tocaron la fuente "Gripe" ni las tareas de prueba del usuario.
- **Prueba del usuario en la vista previa:** "esta semana" sin tareas en el periodo, "mañana", "esta semana" con tareas, "qué vence primero" y las preguntas sin fecha funcionan.

### E03 Ampliación: navegación

- **Rutas:** el chat pasó a `/nova/asistente` (`git mv` de la página; acepta `?pregunta=`). `/nova` es Inicio en versión mínima: solo "Pregúntale a Nova" (`PreguntaleANova`, RN-02 en vivo), que lleva al Asistente con la pregunta; `Chat` la envía al cargar una sola vez (guarda con `useRef`) y quita `?pregunta=` con `history.replaceState`, así recargar no la reenvía; si no fuera válida, queda en el campo. A-01 sigue (sin sesión, `/nova` lleva al login) y el login sigue llevando a `/nova`, que ahora es Inicio.
- **Navegación** (`src/components/nova/navegacion/`): `secciones.ts` (solo secciones que existen: Inicio, Asistente, Tareas, Documentos, Web, Productividad; `esActivo`); `BarraLateral` (≥ 1024 px, con correo y "Cerrar sesión"); `BarraInferior` (< 1024 px: Inicio, Documentos en el lugar de Calendario, Asistente al centro destacado, Tareas y "Más"; respeta `safe-area-inset-bottom`); hoja "Más" como diálogo modal (Web, Productividad, correo y "Cerrar sesión"; Escape, "Cerrar" y tocar fuera la cierran; foco atrapado con `useFocoAtrapado` y devuelto a "Más"; la página de fondo no se desplaza); `BotonAgregar` ("+" con "Nueva tarea" y "Subir documento", oculto en el Asistente, se cierra con Escape o tocando fuera); `useCerrarSesion` compartido. `NavegacionNova` las reúne; cuál se ve lo decide el CSS (`lg:`).
- **Hallazgo en el navegador:** en el teléfono, con Web o Productividad abiertas no había ningún elemento con `aria-current` visible (están dentro de "Más"). Se agregó `aria-current="true"` al botón "Más" en ese caso, con prueba.
- **`db:limpiar`:** el filtro pasa a `ILIKE 'prueba%'` (sin distinguir mayúsculas) porque no encontraba las tareas "prueba 2" y "prueba 3" del usuario. El borrado con `--confirmar` lo bloqueó el clasificador de permisos: queda para que el usuario lo confirme o lo ejecute.
- **Pruebas:** `tests/interfaz/navegacion.test.tsx` (21: secciones sin botones muertos, `esActivo`, barra lateral, barra inferior, hoja "Más" con Escape, "Cerrar", tocar fuera, foco atrapado y devuelto, "+", oculto en el Asistente, "Pregúntale a Nova" y la pregunta inicial del chat enviada una sola vez). Las pruebas del menú anterior se quitaron de `componentes.test.tsx`.
- **Navegador real** (Edge, `next start` con un usuario temporal sin datos, borrado al final; 0 fallas): A-01; las 8 pantallas en claro y oscuro, a 1280 y 390 px, sin desborde, sin errores, con la barra lateral solo en 1280, la inferior y el "+" solo en 390 (sin "+" en el Asistente) y un ítem activo; hoja "Más" (foco, Escape con foco devuelto, tocar fuera, navegar y cerrar); "+" a Nueva tarea y Subir documento; Inicio lleva al Asistente con la pregunta enviada (sin documentos ni tareas: `SIN_DOCUMENTOS`, sin llamar a Gemini) en 1280 y 390, y recargar no la reenvía.
- **Al cierre:** `npm test` 295/295, `npm run build` correcto, `eslint` sin errores (solo el aviso de `eslint.config.mjs`).
- **Prueba del usuario en la vista previa:** E02c y E03 funcionan.

### E04 Ampliación: login con el estilo de Nova

- **Qué cambió:** solo la presentación de `/login`, `/register`, `/recuperar-contrasena` y `/restablecer-contrasena`. Nuevo `src/components/login/TarjetaAcceso.tsx` (fondo crema u oscuro, tarjeta redondeada con sombra suave, marca "Nova" con ícono `Sparkles`) y clases compartidas para campos, etiquetas, enlaces y mensajes. `LoginForm`, `RegisterForm`, `RecoveryRequestForm` y `PasswordResetForm` conservan su lógica, sus rutas (`/api/auth/*`), sus mensajes y a dónde llevan (`/nova`, `/home`, `/login?restablecida=1`); los botones usan `claseBoton`. Se quitaron los rótulos decorativos "Tu asistente virtual" y "Cuenta de Supabase". Los campos tienen letra de 16 px para que el teléfono no haga zoom.
- **Fuera de E04:** `/home`, `/dashboard`, `ChangePasswordForm` y `LogoutButton` (panel de administración y portal de usuarios no admin) conservan el estilo anterior.
- **Pruebas:** `tests/interfaz/acceso.test.tsx` (9: tarjeta; login con validación, llamada, destino y error del servidor; enlaces; registro con contraseña corta y distinta y destino `/home`; recuperar; restablecer); la búsqueda de colores sueltos de `contraste.test.ts` cubre ahora los 9 archivos del acceso y se agregaron los pares texto/tinte de los avisos. Las pruebas existentes del login (`src/modules/auth`, `src/app/api/auth/*`) pasan sin cambios.
- **Navegador real** (Edge, `next start`, usuario temporal borrado al final; 0 fallas): las 5 vistas (login, registro, recuperar, enlace vencido, login con contraseña restablecida) en claro y oscuro, a 1280 y 390 px, con el fondo de Nova, letra de 16 px y sin desborde; contraseña incorrecta en 390 px muestra "Correo o contraseña incorrectos."; foco visible con Tab; recuperar con un correo inexistente muestra el mensaje genérico (no se envía correo); el login correcto lleva a Inicio.
- **Al cierre:** `npm test` 304/304, `npm run build` correcto, `eslint` sin errores.

#### Ajuste de E04: sin zoom al tocar un campo en el teléfono (2026-11-07, pedido del usuario)

- **Problema informado:** en el teléfono, al tocar un campo, la página hacía un poco de zoom.
- **Medición** (Edge emulando teléfono: 390 px, táctil): el viewport es `width=device-width, initial-scale=1` (sin bloqueo del zoom) y los campos del acceso ya calculaban 16 px, justo en el límite y dependiente de que `1rem` valga 16 px; los campos de Nova (chat, "Pregúntale a Nova", formulario de tareas, productividad, web) calculaban 14 px (`text-sm`): Safari en iPhone hace zoom con menos de 16 px.
- **Arreglo:** regla global en `globals.css`, fuera de `@layer` para ganarle a cualquier utilidad de Tailwind y a los estilos del navegador: con `max-width: 1023.98px` o `pointer: coarse`, todo `input` de texto, `select` y `textarea` usa `font-size: max(16px, 1rem)`; además `text-size-adjust: 100%`. El zoom con dos dedos no se bloquea (sin límite de escala ni `user-scalable`).
- **Pruebas:** dos nuevas en `contraste.test.ts` (la regla existe, está fuera de `@layer` y nada en `src` bloquea el zoom).
- **Navegador real** (0 fallas): a 390 px, los 8 campos de las 4 pantallas de acceso miden 16 px en reposo y con foco, con escala 1, también con la letra base del navegador reducida a 12 px; los campos de Nova (Inicio, Asistente, nueva tarea, productividad, web) miden 16 px; a 1280 px sin pantalla táctil conservan 14 px. No se pudo probar en Safari de iPhone ni en Samsung Internet reales desde esta máquina.
- **Hallazgo aparte:** durante la medición, el pooler de Supabase (`*.pooler.supabase.com:6543`, `NOVAASSISTANT_POSTGRES_URL`, el que usa la app) respondía `ECONNRESET` tras unos 19 s a cualquier consulta desde esta máquina, también fuera de la app; la conexión directa funcionaba. Para terminar la medición, solo el servidor local de prueba se arrancó con la conexión directa (variable del proceso, sin cambiar archivos). No se cambió ninguna configuración.
- **Al cierre:** `npm test` 306/306, `npm run build` correcto, `eslint` sin errores.

#### Ajuste RB-32: el Asistente nunca se bloquea sin documentos (2026-11-07, pedido del usuario)

- **Problema informado** (con captura, en producción y en el PC): sin documentos, cualquier pregunta, incluso "¿Tengo alguna tarea?", respondía "Aún no hay documentos indexados. Indexe un PDF antes de preguntar." y el mismo aviso salía arriba con otro trato ("Indexa").
- **Causa:** producción y el PC corren `master`, que tiene la regla original RN-15 (bloquea sin documentos). En `ampliacion`, RB-30 ya respondía con las tareas, pero sin documentos ni tareas seguía bloqueando; con documentos y sin tareas, "¿Tengo alguna tarea?" respondía "No encontré esto en tus documentos"; y "Indexa"/"Indexe" se repetían arriba y en la respuesta.
- **Arreglo (RB-32, solo en `ampliacion`):** `consultar` ya no lanza `SIN_DOCUMENTOS`. El contexto lleva `DOCUMENTOS: el usuario aún no tiene documentos indexados.` sin documentos y `TAREAS PENDIENTES: ninguna.` cuando se consultaron las tareas y no hay; el System Prompt pide dos respuestas exactas y el servidor las impone (sin fuentes): "No tienes tareas pendientes." y "Aún no tienes documentos indexados, así que no puedo responder sobre documentos. Indexa un PDF para preguntar sobre él." La pantalla muestra solo avisos informativos en tuteo (el de sin documentos ni tareas es nuevo y dice "Puedes preguntar igual"). El código `SIN_DOCUMENTOS` y su mensaje siguen existiendo para la API de `master`, pero el Asistente nuevo ya no los produce.
- **Pruebas:** 7 nuevas o ajustadas en `tests/servidor/consulta.test.ts` (los tres casos pedidos, la línea de contexto correcta en cada uno, las respuestas exactas impuestas aunque el modelo las redacte distinto, el System Prompt) y en `tests/reglas/consulta.test.ts` (aviso en tuteo, sin "Indexe" ni "antes de preguntar").
- **`probar:rag` con Gemini real** (0 fallas): paso 10d sin documentos ni tareas, pregunta de documento → la explicación exacta; 10e "¿Tengo alguna tarea?" → "No tienes tareas pendientes."; 11b sin documentos y con tareas, pregunta de PDF → la explicación; 13 nuevo, con documentos y sin tareas, "¿Tengo alguna tarea?" → "No tienes tareas pendientes.". Los demás pasos siguen pasando. Se corrió con la conexión directa (variable del proceso) porque el pooler seguía con `ECONNRESET` desde esta máquina.
- **Al cierre:** `npm test` 312/312, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario en la vista previa:** el Asistente funciona en los 4 casos. Producción se arregla al unir `ampliacion` con `master` (no tocar `master` por ahora).

#### Ajuste: el chat baja al último mensaje (2026-11-07, pedido del usuario)

- **Problema informado:** al enviar una pregunta, la vista no bajaba sola hasta el mensaje nuevo ni hasta la respuesta, en el PC y en el teléfono (en el teléfono solo bajaba al tocar el campo, por el navegador).
- **Causa:** `Chat` hacía `scrollIntoView({ block: 'nearest' })` sobre un `div` vacío justo encima del formulario: si ese punto ya contaba como visible, el navegador no se movía; además no tenía en cuenta la barra inferior fija ni el teclado.
- **Arreglo:** `src/components/nova/seguirConversacion.ts`: `calcularDesplazamiento` (puro: deja el final de la conversación —el formulario— sobre el borde inferior visible con 16 px de margen, sin esconder el comienzo del último mensaje si es más alto que la pantalla), `zonaVisible` (visualViewport menos la barra inferior, marcada con `data-barra-inferior`) y `useSeguirConversacion`: al enviar baja siempre; al llegar la respuesta o un error, solo si el usuario sigue al final (a 120 px o menos); si subió, muestra "Ir al final"; si cambia el `visualViewport` (teclado) y estaba al final, lo mantiene; animación suave salvo con `prefers-reduced-motion`, que salta sin animación. Al abrir con historial, se ve lo último.
- **Pruebas:** `tests/interfaz/chatDesplazamiento.test.tsx` (12: cálculo puro, zona con y sin barra, bajar al enviar, al llegar la respuesta, no mover si subió y "Ir al final", reducir movimiento, barra inferior, teclado, historial al abrir). Una prueba existente (`documentos-eliminar`) falló una vez por tiempo con la máquina cargada y pasó al repetirla, sola y con todas.
- **Navegador real** (Edge con `next start` y la conexión directa por el pooler; usuario temporal con una tarea y una conversación larga sembrada, todo borrado al final; Gemini real; 0 fallas en 21 comprobaciones): en 1280 y 390 px (táctil), claro y oscuro: al abrir se ve el último mensaje guardado; al enviar, la pregunta queda a la vista; al llegar la respuesta, también, sobre la barra inferior en el teléfono; si el usuario sube mientras llega la respuesta, la vista no se mueve y aparece "Ir al final", que lleva a la respuesta y desaparece; con "reducir movimiento" llega de un salto. El teclado real del teléfono no se puede abrir en el navegador de prueba: lo cubre la prueba con `visualViewport`.
- **Al cierre:** `npm test` 324/324, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario:** el desplazamiento funciona en el teléfono y en el PC, incluido el teclado abierto e "Ir al final". E04, RB-32 y el arreglo del chat confirmados.

### E05 Ampliación: categorías (M6)

- **Respaldo previo:** `respaldos/2026-11-07_145559` (0 tareas, 0 documentos, 1 fuente, 11 conversaciones, 68 mensajes).
- **Migración M6** `supabase/migrations/20261107100000_nova_categorias.sql`: tabla `categorias` (usuario_id, nombre recortado de 1 a 80, color de la paleta fija por CHECK, `UNIQUE (id, usuario_id)`), índice único `(usuario_id, lower(nombre))`, RLS sin políticas y permisos revocados; siembra General (gris) y una categoría por nombre ya usado en tareas (escrito como la primera vez; la primera prueba en seco eligió "trabajo" sobre "Trabajo" por orden alfabético y se cambió a `array_agg ... ORDER BY created_at`). Prueba en seco revertida, aplicada, `db:verificar` 0 fallas.
- **Compatibilidad con master** (worktree de `d175142`, con la conexión directa porque el pooler sigue con `ECONNRESET` desde esta máquina): `db:verificar` 0 fallas; `probar:rag` 0 fallas (el primer intento se cortó por el límite por minuto de Gemini y pasó al repetirlo).
- **Código:** `src/lib/reglas/categorias.ts` (paleta, nombres de color, validaciones RB-02 y RB-03, siguiente color libre, color de una tarea por nombre sin distinguir mayúsculas), `src/lib/datos/categorias.ts` (listar asegurando General, crear, renombrar actualizando las tareas en la misma transacción con `FOR UPDATE`, cambiar color, eliminar moviendo las tareas a General; RB-01 por usuario; `23505` → `CATEGORIA_DUPLICADA`), rutas `GET/POST /api/nova/categorias` y `PATCH/DELETE /api/nova/categorias/[id]`, errores nuevos (`CATEGORIA_NO_ENCONTRADA`, `CATEGORIA_DUPLICADA`, `COLOR_INVALIDO`, `NOMBRE_CATEGORIA_INVALIDO`, `CATEGORIA_GENERAL`). Interfaz: `/nova/configuracion` con el bloque Categorías (`CategoriasConfig`: lista con número de tareas, editar, eliminar con confirmación, nueva categoría con el siguiente color libre), `SelectorColor` (8 opciones nativas con nombre), `InsigniaCategoria` en la lista de Tareas. Configuración entra a la barra lateral y a la hoja "Más".
- **Decisiones:** General no se renombra (sí cambia de color) para que siga siendo la categoría por defecto; mensajes nuevos `La categoría General no se puede renombrar.` y `Escribe un nombre de 1 a 80 caracteres.` (agregados al plan).
- **Hallazgo de las pruebas:** al crear, el servicio aseguraba General en la base antes de validar el color; ahora valida todo primero.
- **Pruebas:** `tests/reglas/categorias.test.ts` (6), `tests/servidor/categorias.test.ts` (12: servicio con base simulada y rutas: 401/403, 201, 409 con mensaje exacto, 400, General), `tests/interfaz/categorias.test.tsx` (9); `navegacion.test.tsx` con Configuración; `db:verificar` sección 6c (tabla, RLS, índice, repetida, color y espacios).
- **Navegador real** (Edge, `next start` con la conexión directa, usuario temporal con 2 tareas "casa", todo borrado al final; 0 fallas en 17): General aparece sola; "casa" sin registrar se ve gris; crear "Casa" cuenta sus 2 tareas y "CASA" responde el mensaje exacto; renombrar a "Hogar" con azul cambia las tareas en la base y en Tareas; General sin "Eliminar" ni nombre editable; eliminar con confirmación pasa las tareas a General; Configuración y Tareas en claro y oscuro, 1280 y 390, sin desborde y con el ítem activo correcto.
- **Al cierre:** `npm test` 351/351, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario:** crear "Universidad" y el aviso de nombre repetido funcionan. Pidió mover las categorías a Tareas (E05b).

### E05b Ampliación: categorías dentro de Tareas (pedida por el usuario)

- **Interfaz:** `FilaCategorias` (fila con "Todas", General, las del usuario y "+ Nueva"; filtro `?categoria=` combinable con el estado vía `src/lib/rutasTareas.ts`; "⋯" en la elegida, presión larga de 500 ms que se cancela si el dedo se desliza, clic derecho; anuncios con `role="status"`), `Dialogo` (nuevo componente de `src/components/ui`: hoja inferior en el teléfono, centrado desde 640 px, foco atrapado, Escape, "Cerrar" y tocar fuera). La página de Tareas filtra por categoría sin distinguir mayúsculas y muestra el nombre guardado. Se borraron `/nova/configuracion` y `CategoriasConfig`; Configuración sale del menú hasta E11.
- **Servidor (RB-33):** `resolverCategoria(tx, usuario, texto)` en `src/lib/datos/categorias.ts`; `crearTarea` la usa dentro de una transacción; `listarTareas` acepta `categoria`.
- **Aviso del proveedor (B-46):** fuera del layout; completo arriba del Asistente (`AVISO_PROVEEDOR`) y una línea corta bajo "Pregúntale a Nova" (`AVISO_PROVEEDOR_CORTO`); Web conserva su subtítulo; nada en Productividad.
- **Errores encontrados al verificar en el navegador** (las pruebas de jsdom no los veían):
  1. La página de Tareas (servidor) llamaba a `hrefTareas`, exportada desde un archivo `'use client'`: Next lo prohíbe y la página fallaba. Se movió a `src/lib/rutasTareas.ts`.
  2. Al escribir el nombre en el diálogo solo quedaba la primera letra: `useFocoAtrapado` dependía de `cerrar`, una función nueva en cada render, así que con cada tecla el efecto se reiniciaba y devolvía el foco al botón de origen. Ahora guarda `cerrar` en una referencia (arregla también la hoja "Más"), y el foco entra al primer campo del diálogo. Prueba de regresión que falla con el código anterior.
  3. Tras la presión larga, el clic de soltar el dedo caía sobre el fondo recién abierto y cerraba el menú. El fondo ahora solo cierra si el toque empezó en él. Con prueba.
  4. "Eliminar" del menú no se veía en rojo (ganaba el color del botón secundario): `text-peligro!`.
  5. Redacción: con una tarea, "Su tarea pasará a General." (antes "Sus 1 tarea pasarán").
- **Pruebas:** `tests/interfaz/filaCategorias.test.tsx` (20: enlaces y filtro, "+ Nueva" con repetida, menú de General, renombrar con filtro, color, eliminar con confirmación, Escape y foco, foco al escribir, presión larga y deslizar, fondo tras presión larga, clic derecho, selector, insignia, tabla, aviso del proveedor); RB-33 en `tests/servidor/categorias.test.ts`; `aislamiento.test.ts` ajustada a la transacción; se borró `tests/interfaz/categorias.test.tsx` con su componente.
- **Navegador real** (Edge, `next start` con la conexión directa, usuario temporal borrado al final; 0 fallas en 16): Configuración fuera del menú y `/nova/configuracion` → 404; crear "Universidad" y repetida; RB-33 con tareas reales (" universidad " → "Universidad"; "Gimnasio" creada con ámbar); filtrar; renombrar a "U" con azul (la tarea cambia y el filtro sigue); eliminar con confirmación (la tarea pasa a General y el filtro vuelve a Todas); menú de General por clic derecho; presión larga táctil a 390 px abre el menú sin filtrar; aviso del proveedor solo en Asistente e Inicio; claro y oscuro a 1280 y 390, sin desborde, fila de 40 px que se desliza en el teléfono.
- **Al cierre:** `npm test` 366/366, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario (iPhone, Safari):** los 10 pasos de E05b salieron bien. E05 y E05b confirmados.

### E06 Ampliación: Inicio

- **Reglas puras** `src/lib/reglas/semana.ts`: días de la semana (lunes a domingo, sobre `semanaDe` en Bogotá), rango ("2 – 8 de nov.", con cambio de mes y de año), nombre del día, progreso semanal (7.1: truncado y sin dividir por cero), prioridades de hoy (pendientes de hoy, Alta primero y luego por título), agrupación por día y texto de vencidas.
- **Datos:** `src/lib/datos/semana.ts` (`semanaDeTareas`: tareas de la semana por fecha límite, pendientes de hoy y número de vencidas, solo del usuario); `listarTareas` acepta `desde`/`hasta`; `GET /api/nova/semana?inicio=` (fecha inválida → `FECHA_INVALIDA` 422).
- **Interfaz:** `/nova` con "Pregúntale a Nova", `MiSemana` (7 columnas desde 1024 px; en el teléfono, 7 días para elegir con un punto si hay tareas y la lista del día elegido; flechas de semana y "Esta semana"; la semana va en `?semana=`), `ProgresoSemanal` (anillo SVG decorativo con el porcentaje también en texto y los contadores), `PrioridadesHoy` ("Agregar" con `?fecha=` de hoy, vencidas con enlace a Tareas pendientes) y `CasillaTarea` (casilla nativa controlada: marcarla abre el diálogo de minutos; completada, marcada y deshabilitada).
- **Reutilización:** el formulario de minutos se extrajo de `AccionesTarea` a `FormularioMinutos`; Tareas lo usa en línea y la casilla de Inicio dentro de un `Dialogo`. `FormularioTarea` acepta `fechaInicial` y `/nova/tareas/nueva` lee `?fecha=` (válida; inválida se ignora).
- **Pruebas:** `tests/reglas/semana.test.ts` (8, incluido domingo 22:30 en Bogotá), `tests/servidor/semana.test.ts` (4: servicio con base simulada y ruta), `tests/interfaz/inicio.test.tsx` (11: casilla con cancelar y confirmar, completada, semana en computador y teléfono, flechas, progreso, prioridades, `?fecha=`). Las de `AccionesTarea` pasan sin cambios con el formulario extraído.
- **Navegador real** (Edge, `next start` con la conexión directa, usuario temporal con 5 tareas, todo borrado al final; 0 fallas en 13): columnas por fecha límite; progreso 33 % (1 de 3); prioridades en orden y "1 tarea vencida"; la casilla abre el diálogo con el foco en los minutos, cancelar no cambia nada y confirmar 30 min completa en la base, el anillo pasa a 66 % y la tarea sale de prioridades; semana siguiente y "Esta semana"; "Agregar" con la fecha de hoy; teléfono con selector de días; claro y oscuro a 1280 y 390 sin desborde.
- **Al cierre:** `npm test` 389/389, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario (iPhone, Safari, y PC):** Mi semana, la casilla con minutos, el anillo, Prioridades de hoy, "Agregar" y las flechas funcionan. No pudo probar "tarea vencida" porque creyó que el formulario no deja fechas pasadas: sí las deja (RN-07), con el aviso amarillo "Esta fecha ya pasó. Puedes guardar la tarea de todos modos."; verificado en el navegador.

#### Ajustes de E06 (2026-11-07, pedidos del usuario)

- **Categoría fuera de la columna (PC):** `InsigniaCategoria` ya no es más ancha que su contenedor (`max-w-full`, nombre con `truncate` y `title` con el nombre completo). En las columnas de la semana, `CasillaTarea` pone las insignias en su propia línea, con todo el ancho de la columna, para que "General" se lea completa.
- **Prioridad en el PC:** las columnas muestran categoría y prioridad, igual que el teléfono.
- **Columnas desde 1280 px:** al medir, a 1024 px (laptop pequeña con la barra lateral) cada columna quedaba en ~86 px y la prioridad se salía; entre 1024 y 1280 px se usa el selector de días.
- **Botón "+" en el teléfono:** el contenido termina con `calc(10rem + env(safe-area-inset-bottom))` de espacio: el "+" termina a 9rem más el área segura, así queda 1rem libre y nunca tapa lo último.
- **Pruebas:** 2 nuevas en `tests/interfaz/inicio.test.tsx` (prioridad en las columnas; insignia que no se sale, con `title`).
- **Navegador real** (Edge, usuario temporal con una categoría de 32 caracteres, borrado al final; 0 fallas en 7): a 1280 y 1440, 12 insignias y ninguna fuera de su columna, con las 4 prioridades visibles; a 1024, selector de días sin desborde; a 390, al final de la página la tarjeta "Prioridades de hoy" termina 16 px por encima del "+"; el formulario guarda una fecha de ayer con su aviso e Inicio muestra "1 tarea vencida".
- **Al cierre:** `npm test` 391/391, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario:** "General" cabe en la columna, la prioridad se ve en el PC, el "+" no tapa nada y "1 tarea vencida" funciona con una fecha pasada. E06 confirmado. Aprobó RB-34 (24 horas; en E11, opción de 12 horas) y E06b antes del Calendario. Idea anotada para E08 o el diseño final: marca sutil "Vencida" en Mi semana.

### E06b Ampliación: horario de las tareas (pedida por el usuario)

- **Respaldo previo:** `respaldos/2026-11-07_194203` (4 tareas, 0 documentos, 1 fuente, 12 conversaciones, 70 mensajes).
- **Migración M14** `supabase/migrations/20261108100000_nova_horario_tareas.sql`: `hora_inicio` y `hora_fin` (`TIME`, opcionales) con `tareas_horario_valido`. Prueba en seco (6 casos, revertida), aplicada; `db:verificar` 0 fallas (nueva sección 6d); compatibilidad con `master` (worktree, conexión directa): `db:verificar` y `probar:rag` 0 fallas.
- **Reglas** `src/lib/reglas/horario.ts`: `validarHorario` (acepta "8:5" y "08:05:00", rechaza fin sin inicio, fin antes o igual al inicio y horas imposibles), `formatearHorario` ("8:00 – 9:30", 24 horas sin cero a la izquierda) y `compararPorHorario`; errores `HORA_INVALIDA`, `HORA_FIN_SIN_INICIO`, `HORA_FIN_ANTES` (422).
- **Servidor:** `crearTarea` guarda el horario; `listarTareas` ordena por fecha y hora; `Tarea` trae `horaInicio`/`horaFin` (`to_char(..., 'HH24:MI')`); `tareasPorDia` ordena cada día por horario; el texto de cada tarea para el Asistente incluye `horario`.
- **Interfaz:** `FormularioTarea` con "Horario (opcional)": "Desde" y "Hasta" (`type="time"`, mismas reglas y mensajes); el horario se ve en `CasillaTarea` (dentro de la etiqueta, así lo leen los lectores de pantalla) y en `TablaTareas` (columna de fecha y tarjeta del teléfono).
- **Pruebas:** `tests/reglas/horario.test.ts` (5), `tests/interfaz/horario.test.tsx` (5), RB-34 en `tests/servidor/categorias.test.ts` (2) y en `aislamiento.test.ts` (1); datos de prueba de `Tarea` con las horas.
- **`probar:rag`** (Gemini real, 0 fallas): paso 14 nuevo, "¿Qué tengo mañana a las 3 de la tarde?" responde con la tarea de 15:00 a 16:00.
- **Navegador real** (Edge, usuario temporal borrado al final; 0 fallas en 16): en el teléfono, el formulario (letra de 16 px) avisa "La hora de fin necesita una hora de inicio." y guarda 08:00 – 09:30; Tareas muestra "· 8:00 – 9:30"; Mi semana a 1280 ordena hoy "8:00 – 9:30", "20:00", luego sin hora Alta y Baja; Prioridades de hoy sigue por prioridad con el horario; Inicio, Tareas y el formulario en claro y oscuro, 1280 y 390, sin desborde. El selector de hora del navegador se ve según la configuración del dispositivo (en la prueba, "08:00 a. m."): lo guardado y lo mostrado por la app es de 24 horas.
- **Al cierre:** `npm test` 404/404, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario (teléfono y PC):** el formulario con la rueda del iPhone, los dos mensajes, el orden por horario, Prioridades de hoy, el horario en Tareas y el Asistente funcionan. E06b confirmado.

#### Ajuste: tope de 4 tareas por columna (2026-11-07, pedido del usuario)

- Se hizo ahora (no en E08) porque solo toca Mi semana. `tareasPorDia` pone las completadas al final de cada día (en el computador y en el teléfono). En las columnas del computador se ven como máximo `MAX_TAREAS_COLUMNA` (4) y "+N más" abre el día completo en su misma columna, con "Ver menos" (`aria-expanded`, `aria-controls`). Se eligió abrir en la columna y no en un diálogo para no anidar diálogos: cada casilla ya abre el diálogo de minutos.
- **Pruebas:** 2 nuevas (orden con completadas al final; tope, "+N más" y "Ver menos", sin tope en el teléfono).
- **Navegador real** (Edge, usuario temporal con 6 tareas hoy, una completada a las 7:00; 0 fallas en 4): la columna muestra A 9:00, B 10:00, C y D con "+2 más"; al abrirla, 6 tareas con la completada al final; "Ver menos" vuelve a 4; el teléfono muestra las 6 con la completada al final.
- **Diseño final anotado:** etapa E20b "Diseño final: darle vida a Nova", con el texto del usuario tal cual en `PROMPTS_AMPLIACION.md`, entre E20 y E21.
- **Al cierre:** `npm test` 406/406, `npm run build` correcto, `eslint` sin errores.

### E07 Ampliación: Calendario

- **Reglas puras** (`src/lib/reglas/calendario.ts`):
  - `esMesValido`, `mesDe`, `sumarMeses` (cruza el año) y `nombreMes` ("noviembre de 2026").
  - `semanasDelMes`: lunes primero, semanas completas, de 4 a 6; incluye los años bisiestos.
  - `estaVencida`: tarea pendiente con fecha límite antes de hoy.
- **Datos** (`src/lib/datos/calendario.ts`):
  - `mesDeTareas(usuarioId, mes?)` lee solo las tareas del usuario en el rango de la cuadrícula, incluidos los días vecinos.
  - Agrupa por día con `tareasPorDia` (el mismo orden de Mi semana) y devuelve `eventos: {}` para E13.
  - `GET /api/nova/calendario?mes=`: un mes inválido da 400 `DATOS_INVALIDOS` y sin sesión da 401.
- **Interfaz:**
  - `/nova/calendario` con `CalendarioMes`: cuadrícula con roles `grid`, `row` y `gridcell`; flechas de mes y "Hoy".
  - Teléfono: puntos de color (máximo 3 y "+N").
  - Desde 1280 px: títulos cortos con su hora (máximo 2 y "+N más"; la vencida en rojo, la completada tachada).
  - Leyenda con las categorías del mes.
  - Lista del día con `CasillaTarea` (completar con el mismo diálogo de minutos), la insignia "Vencida" y "Agregar" → `/nova/tareas/nueva?fecha=<día>`.
  - Cada día tiene una etiqueta accesible, por ejemplo "martes 10 de nov., 2 tareas (1 pendiente)".
- **Menú:** Calendario en la barra lateral (después de Asistente) y en la barra inferior del teléfono (Inicio, Calendario, Asistente, Tareas); Productividad pasa a "Más".
- **Ajuste en el navegador:** con la lista al lado del mes, a 1280 px los títulos quedaban cortados ("8:00 Pr…"). La lista va debajo hasta 1536 px, y al elegir un día la página baja hasta ella si no se ve.
- **Pruebas:**
  - `tests/reglas/calendario.test.ts` (4).
  - `tests/servidor/calendario.test.ts` (3).
  - `tests/interfaz/calendario.test.tsx` (5).
  - `navegacion.test.tsx` actualizado.
  - `documentos-eliminar.test.ts` con un tiempo límite de 20 s: con la carga, la importación del módulo de PDF pasaba de 5 s.
- **Navegador real:** Edge, `next start` con la conexión directa, usuario temporal con 6 tareas, todo borrado al final; 0 fallas en 13.
  - Barra inferior con Calendario activo.
  - A 390 px: letra mínima de 12 px, celdas de 44 × 56 y sin desborde.
  - Lista de hoy en orden: 8:00 – 9:30, 20:00, sin hora (Alta) y la completada al final.
  - "Agregar" con la fecha de hoy.
  - La tarea de ayer lleva "Vencida".
  - Mes siguiente (`?mes=2026-12`) y "Hoy" vuelve a hoy.
  - A 1280 px: "8:00 Prueba clase", "20:00 Prueba cena" y "+2 más"; leyenda con 3 categorías.
  - Al elegir un día, su lista queda a la vista.
  - Claro y oscuro, a 1280 y 390 px, sin desborde ni errores; con "reducir movimiento", sin transiciones.
- **Al cierre:** `npm test` 418/418, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario (teléfono y PC):** funcionan el mes, los colores y la leyenda, el orden de la lista del día, "Agregar" con la fecha, "Vencida", completar con minutos, las flechas con "Hoy", claro y oscuro. Aprobó la lista debajo del mes en el PC.

#### Ajuste de E07: bajar hasta la lista del día (2026-11-07, pedido del usuario)

- **Problema:** en el PC, al tocar un día la página bajaba poco; se veía el encabezado del día y la primera tarea cortada.
- **Causa:** la lista se medía antes de dibujar la del día nuevo, así que se usaba el alto de la lista anterior (por ejemplo, la de un día vacío).
- **Corrección:** la página baja en un efecto, después de dibujar la lista nueva.
  - En el computador (≥ 1024 px) deja la lista arriba de la pantalla (`block: 'start'`, `scroll-mt-4`) o lo más arriba que permita el final de la página.
  - En el teléfono baja solo lo necesario (`nearest`), para no esconder el mes en cada toque.
  - Si la lista ya se ve entera, no se mueve. Con "reducir movimiento", sin animación.
- **Prueba nueva** en `tests/interfaz/calendario.test.tsx`: la medición se hace con la lista nueva (3 tareas), `start`, sin animación, y no se mueve si ya se ve entera.
- **Navegador real** (Edge, 1330 × 1093 como la captura del usuario, primero un día vacío y luego hoy con 4 tareas; 0 fallas en 16):
  - La lista, antes cortada en 889 px, sube a 643–1053 y se ve entera, con y sin "reducir movimiento"; no puede subir más porque ahí termina la página.
  - En una ventana donde ya se ve, la página no se mueve.
- **Al cierre:** `npm test` 419/419, `npm run build` correcto, `eslint` sin errores.

### E08 Ampliación: Tareas con pestañas y categorías

- **Limpieza previa** (con el OK del usuario): sus 4 tareas de prueba de E07 ("prueba" a "prueba 4") se borraron en una transacción. Antes se comprobó con `created_at` que todas eran de las 16:02 a las 16:04 del 2026-11-07, posteriores a la limpieza anterior (cuenta en 0 antes de las 15:29). Quedan 0 tareas y las categorías General y Universidad.
- **Decisión del usuario:** "N tareas vencidas" de Inicio lleva a la vista "Vencidas" (`?vista=vencidas`). Su píldora solo aparece mientras se está en ella.
- **Reglas** (`src/lib/reglas/vistasTareas.ts`):
  - `vistaDeParametros`: `?vista=`; los enlaces viejos `?estado=Pendiente` van a "vencidas" y `?estado=Completada` a "completadas".
  - `filtroDeVista`: Hoy = fecha límite hoy; Importantes = Alta y no completada; Completadas; Vencidas = no completada y fecha límite hasta ayer.
  - `textoVacio` para cada vista.
  - `agruparPorCategoria`: sin distinguir mayúsculas ni espacios; General primero y luego alfabético; contador completadas/total; completadas al final.
- **Servicio:** `listarTareas` acepta `soloPendientes` y `prioridad`. `hrefTareas(vista, categoria)` reemplaza al filtro de estado y `FilaCategorias` conserva la vista.
- **Interfaz:**
  - `/nova/tareas` con las 4 pestañas (más "Vencidas" solo en esa vista) y `GruposTareas` (encabezado con color, nombre y "1/3", y `TablaTareas` sin la columna Categoría).
  - En `TablaTareas`, la insignia "Vencida"; desde 1280 px, anchos fijos para que las columnas queden alineadas entre grupos, y el título largo pasa de línea.
  - `Pestanas` en una sola fila: en el teléfono se desliza de lado y al cargar deja la activa a la vista.
  - En Mi semana, la insignia "Vencida".
  - `SelectorCategoria`: combobox con la lista de categorías y sus colores, filtro al escribir, ‘Crear “X”’ y el aviso. `/nova/tareas/nueva` le pasa las categorías del usuario.
- **Pruebas:**
  - `tests/reglas/vistasTareas.test.ts` (5).
  - `tests/servidor/vistasTareas.test.ts` (4: SQL de cada vista, solo del usuario).
  - `tests/interfaz/tareasE08.test.tsx` (6: grupos y contador, "Vencida" en Tareas y en Mi semana, combobox con clic, filtro, sin duplicar y teclado).
  - Actualizadas `filaCategorias` (vista en la URL) e `inicio` (enlace a "Vencidas").
- **Navegador real:** Edge, usuario temporal borrado al final; 0 fallas en 32.
  - Pestañas y grupos a 390 y 1280 px: Todas, Hoy (Universidad 1/2), Importantes, Completadas.
  - Importantes + Universidad conserva las dos cosas en la URL.
  - "Vencida" en Tareas y en Mi semana.
  - Inicio → "1 tarea vencida" → "Vencidas" activa.
  - 4 pestañas en una fila a 390 px; con "Vencidas", la activa entera a la vista.
  - Columnas alineadas entre grupos, con un título largo sin desborde y las acciones en una línea.
  - Combobox en el teléfono: letra de 16 px y lista encima de todo. " universidad " no ofrece crear; ‘Crear “Viaje”’ crea una sola categoría con color al guardar, y "  viaje  " sin elegir usa la misma.
  - Claro y oscuro a 1280 y 390 px, sin desborde ni errores y sin transiciones con "reducir movimiento".
- **Al cierre:** `npm test` 434/434, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario (teléfono y PC):** campo de categoría, las cuatro pestañas con sus contadores, la combinación con la fila de categorías, la vista Vencidas, la marca "Vencida", completar y eliminar funcionan. E08 confirmado.

### Cierre del plan (2026-11-09)

- **Aprobado por el usuario:** E10b a E10d y E11b a E11d antes de E12, con `pg_cron` de Supabase. Commit `6901757`.
- **Cambios pedidos:** sin correo de respaldo con Resend (no hay dominio verificado; queda "para más adelante"); E11d queda con el resumen diario por notificación y el `.ics`.
- **Agregado:** cuestionarios (E10e, E10f, M17, RB-48 a RB-53, S-51 a S-59, B-60 a B-66); riesgo de pausa de Supabase con cómo evitarlo; costo de los cuestionarios; privacidad del plan gratuito de Gemini; límite por persona y Gemini de pago como ideas para más adelante.

### E09 Ampliación: editar tareas

- **Limpieza previa** (con el OK del usuario): "Prueba 1" a "Prueba 3" y la categoría Gimnasio (0 tareas), en una transacción. Se mostraron antes y se comprobó que todas eran del 7 de noviembre, de las 17:07 a las 17:08, posteriores a la limpieza anterior. Quedan 0 tareas y las categorías General y Universidad.
- **Servicio** (`src/lib/datos/tareas.ts`): `obtenerTarea` y `editarTarea`, con `validarTarea` y `validarHorario`, las mismas reglas que crear. La fila se bloquea (`FOR UPDATE`) antes de `resolverCategoria`, para que una tarea completada o ajena no deje una categoría nueva. No toca estado, minutos ni fechas de creación y cierre.
- **Ruta:** `PATCH /api/nova/tareas/[id]`, con el mismo `esquemaTarea` de crear.
- **Interfaz:**
  - `/nova/tareas/[id]/editar` con `FormularioTarea` en modo edición (lleno, "Guardar cambios"). Una tarea completada, ajena o inexistente muestra el mensaje, sin formulario.
  - `EnlaceEditarTarea`: lleva la pantalla de origen en `?volver=` y `rutaVolverSegura` solo acepta rutas internas de Nova.
  - "Editar" solo en las pendientes: texto en las tarjetas del teléfono; ícono de lápiz en la tabla del computador, en Inicio y en la lista del día del Calendario.
  - El Calendario vuelve al mismo día con `?dia=`.
  - Además de lo que pedía la etapa, también se edita el horario (RB-34), anotado en RB-29.
- **Pruebas:** `tests/servidor/editarTarea.test.ts` (7) y `tests/interfaz/editarTarea.test.tsx` (8). En `filaCategorias` se acotó un selector que también tomaba el ícono del lápiz.
- **Edge en esta sesión:** `puppeteer.launch` falla porque `msedge.exe` se desprende del proceso inicial. Se lanza aparte y se conecta por `DevToolsActivePort`.
- **Verificación con la base real** (usuarios temporales, borrados al final):
  - Por HTTP, 0 fallas en 20: guardar, categoría nueva sin duplicar, campos intocables, mensajes exactos, fecha pasada, completada sin categoría suelta, tarea de otro usuario (404, sin mostrar sus datos) y sin sesión (401).
  - En Edge, 0 fallas en 30: recorrido desde Tareas, Inicio y Calendario con su vuelta, formulario lleno, Cancelar, volver externo ignorado, acciones en una línea a 1280 px, categoría entera en Mi semana, y claro y oscuro a 1280 y 390 px sin desborde ni errores y sin transiciones con "reducir movimiento".
- **Corregido al revisar las capturas:** el lápiz encogía la categoría en las columnas de Mi semana; quedaba 2 px desalineado en la tabla; "Editar" tenía casi el color de "Eliminar".
- **Al cierre:** `npm test` 449/449, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario (teléfono y PC):** editar desde Tareas, Inicio y Calendario con su vuelta, cambiar fecha, categoría nueva sin duplicados, quitar el horario, el mensaje de "Hasta" sin "Desde", Cancelar, las completadas sin Editar, completar y eliminar funcionan.

#### Ajuste de E09: columnas de Mi semana en el PC (2026-11-09, pedido del usuario)

- **Problema:** "Universidad" salía como "Universi…", y el lápiz cambiaba de lugar: con "Media" bajaba a una línea sola y alargaba la tarjeta.
- **Causa:** a 1280 px quedaban unos 92 px útiles por columna; "Universidad" necesitaba unos 105, y "Media" más el lápiz de 32 px no cabían juntos.
- **Corrección** (solo en las columnas, desde 1280 px):
  - La insignia de categoría tiene su propia línea y una versión `compacta`, con menos relleno; la columna y la casilla dejan más ancho útil.
  - El lápiz, de 28 px, va siempre al final de la línea de la prioridad.
  - El teléfono no cambia.
- **Pruebas:** 2 nuevas en `tests/interfaz/editarTarea.test.tsx`.
- **Navegador real** (Edge, usuario temporal borrado al final; 0 fallas en 19):
  - A 1280, 1440 y 1920 px, "Universidad", "Programación" y "Laboratorio" se leen enteras; un nombre de 39 caracteres sí se corta.
  - Media, Alta y Baja tienen el mismo alto y el lápiz en el mismo sitio, dentro de la columna.
  - A 390 px, la insignia y el lápiz conservan su tamaño. Claro y oscuro sin desborde ni errores.
- **Al cierre:** `npm test` 451/451, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario (PC):** "Universidad" se lee completa y el lápiz queda siempre en la línea de la prioridad. E09 confirmado.

### E10 Ampliación: Fuentes

- **Limpieza previa** (con el OK del usuario): "prueba 11", "prueba 2", "prueba 33", "prueba 44" y la categoría "gimnasio", en una transacción. Se mostraron antes y se comprobó que todas eran del 9 de noviembre, de las 10:46 a las 10:48, posteriores a la limpieza anterior (cuenta en 0 antes de las 10:16). Quedan 0 tareas y las categorías General y Universidad.
- **Interfaz:**
  - `/nova/fuentes` con las pestañas "Subir PDF" (formulario y "Tus documentos" en la misma pantalla) y "Buscar en la web" (`?pestana=`; un valor desconocido abre PDF). Reutiliza `SubidorPdf`, `TablaDocumentos`, `EliminarDocumento` y `BuscadorWeb`.
  - `SubidorPdf` ya no tiene "Ver documentos": la lista se actualiza en la misma pantalla.
- **Rutas:** redirecciones permanentes (308) en `next.config.ts` de `/nova/documentos`, `/nova/documentos/nuevo` y `/nova/web`; las páginas anteriores se eliminaron. Sin sesión, Fuentes lleva a login.
- **Menú:** Fuentes reemplaza a Documentos y Web en la barra lateral y en "Más". El "+" → "Subir documento" y los enlaces "Indexar un PDF" del Asistente llevan a la pestaña PDF.
- **Pruebas:** `tests/interfaz/fuentes.test.tsx` (5); actualizadas `navegacion`, `Chat` y `filaCategorias`.
- **Navegador real** (Edge, usuario temporal borrado al final; 0 fallas en 18):
  - Redirecciones 308 y Fuentes sin sesión.
  - Hoja "Más", "+" y menú lateral.
  - Indexación real de un PDF (Blob y Gemini): aviso y lista actualizada sin salir de la pantalla.
  - Eliminar con confirmación.
  - Enlace del Asistente.
  - Claro y oscuro a 1280 y 390 px, sin desborde ni errores, y sin transiciones con "reducir movimiento".
  - El primer intento de indexar falló por un corte de red hacia Gemini desde esta máquina (`other side closed`); al repetir, pasó.
  - La búsqueda real en Wikipedia no se ejecutó: `BuscadorWeb` no cambió.
- **Al cierre:** `npm test` 456/456, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario (teléfono y PC):** las dos pestañas, indexar sin salir de la pantalla, la respuesta con cita, eliminar, "+" → "Subir documento", las direcciones anteriores y la búsqueda web funcionan. E10 confirmado.

#### Ajuste de E10: mensaje de la búsqueda web (2026-11-09, pedido del usuario)

- Con una sola palabra, el campo ahora dice `Escribe al menos 2 palabras y 8 caracteres. Por ejemplo: qué es la fotosíntesis.`, y muestra un ejemplo de frase completa como ayuda y en el campo.
- Solo cambia ese campo: el mensaje de RN-02 de la API y del Asistente no cambia, y la búsqueda funciona igual.

### E10b Ampliación: libros, páginas y capítulos

- **Respaldo previo:** `respaldos/2026-11-09_164211` (0 tareas, 0 documentos, 0 fragmentos, 0 fuentes, 14 conversaciones, 78 mensajes).
- **Migración M15** `supabase/migrations/20261109100000_nova_libros.sql`: columnas de páginas e indexación por partes en `documentos` y `fragmentos_pdf`, tabla `capitulos` con RLS y `buscar_fragmentos_usuario` recreada (devuelve `etiqueta_paginas` y excluye los documentos a medias). Aditiva. Agrega `indexando_hasta`, que no estaba en el plan, para que dos pantallas no indexen lo mismo.
- **`db:verificar`** 0 fallas, con la sección nueva 6e. **Compatibilidad con `master`** (worktree, conexión directa): `db:verificar` y `probar:rag` con 0 fallas.
- **Reglas** (`src/lib/reglas/libros.ts`): fragmentos por página con los mismos trozos de RN-10, etiquetas con número impreso, capítulos del índice interno (con la raíz única y la página final) y de encabezados (descarta páginas de índice y cabeceras repetidas), y límite de 800 páginas (RB-38).
- **Extracción** (`src/lib/pdf/extraer.ts`): texto por página, números impresos e índice interno; un enlace roto del índice no impide indexar.
- **Indexación por partes** (`src/lib/datos/documentos.ts`):
  - Cada lote de 20 fragmentos queda guardado antes de seguir; cada llamada se detiene a los 240 s.
  - Si la cuota se agota después de avanzar, conserva lo hecho. Si falla antes de guardar nada, no queda un documento a medias.
  - `POST .../continuar` retoma con un bloqueo de 6 minutos. Un documento a medias no entra en las búsquedas.
  - El PDF se borra de Blob al empezar, como antes: lo pendiente está en la base.
- **Citas:** `libro.pdf · p. 45` o `pp. 45–46`; la misma página sale una vez; los documentos anteriores siguen con "fragmento N".
- **`gemini.ts`:** también reintenta ante una conexión cortada (`fetch failed`), que apareció dos veces desde esta máquina. Aplica también al chat.
- **Interfaz:** `IndexacionPendiente` (avance, sigue solo al volver, de a un libro y con "Reintentar"), columna Páginas, "Ver capítulos" y `/nova/fuentes/[id]/capitulos`.
- **Pruebas:** `tests/reglas/libros.test.ts`, `tests/servidor/extraerPdf.test.ts` (unpdf real sobre PDF generados), `documentos.test.ts` reescrita para el flujo por partes, y casos nuevos en `consulta`, `gemini`, `fuentes` y `BuscadorWeb`.
- **`npm run probar:libro`** (nuevo; Gemini y base reales, 40 páginas y 64 fragmentos; 0 fallas): números impresos, índice, primer lote y pausa, a medias fuera de las búsquedas, "ocupado", reanudar hasta terminar sin repetir, páginas y citas, capítulos, encabezados. **`probar:rag`** 0 fallas.
- **Navegador real** (Edge, usuarios temporales borrados al final; 0 fallas en 21): reanuda solo al abrir Fuentes y al terminar muestra "Ver capítulos"; capítulos con secciones y título largo a 390 px; mensajes sin capítulos y documento anterior; documento ajeno 404 sin datos; aviso de la búsqueda web; acciones en una línea a 1280 px; claro y oscuro a 1280 y 390 px sin desborde ni errores.
- **Al cierre:** `npm test` 487/487, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario (teléfono y PC):** el mensaje de la búsqueda web, los 4 capítulos con sus páginas, la cita con página, eliminar (también durante la indexación) y claro y oscuro funcionan. Reportó que el porcentaje no se actualizaba en pantalla. No probó un libro real.

#### Corrección de E10b: el porcentaje no subía (2026-11-09, reportado por el usuario)

- **Causa:** cada llamada indexaba hasta 240 s seguidos y la pantalla solo recibía el avance al final; en la base sí iba subiendo.
- **Corrección:** cada llamada hace una sola parte (`INDEXACION_PRESUPUESTO_MS = 0`, 20 fragmentos), así que el porcentaje sube con cada parte en la tarjeta y en la fila de la lista.
- **Al terminar:** aviso "quedó indexado" y "Ver capítulos" sin recargar.
- **Si falla:** mensaje y "Reintentar"; una conexión cortada se retoma sola al volver a la pantalla.
- **Aviso nuevo:** `Deja esta pantalla abierta hasta que termine.` La indexación solo avanza con Fuentes abierta, porque el navegador pide cada parte. Al salir o bloquear el teléfono, solo termina la parte en curso; lo demás sigue al volver.
- **Pruebas:** `tests/interfaz/indexacionPendiente.test.tsx` (5).

### E10b2 Ampliación: fuentes web guardadas

- **Servicio:** `listarFuentesWeb` y `eliminarFuenteWeb`, solo del usuario. **Rutas:** `GET /api/nova/web/fuentes` y `DELETE /api/nova/web/fuentes/[id]` (`FUENTE_NO_ENCONTRADA`, 404). Sin migración y sin gastar cuota.
- **Interfaz:** `FuentesGuardadas` en "Buscar en la web", por categoría con su cupo, enlace, resumen, fecha y eliminar con confirmación. `EliminarConConfirmacion` se comparte con los documentos. La lista se actualiza al buscar y al eliminar, y el aviso del tope de 20 indica dónde eliminar.
- **Pruebas:** `tests/servidor/fuentesWeb.test.ts` (6) y casos nuevos en `tests/interfaz/fuentes.test.tsx`.
- **Navegador real** (Edge, usuario temporal borrado al final, con Gemini real y el libro de 40 páginas; 13 de 14 comprobaciones):
  - El porcentaje sube sin salir (31 → 62), con el aviso y también en la fila.
  - Fallo simulado: mensaje y "Reintentar". Al volver retoma (93 → 100) y termina sin recargar, con "Ver capítulos".
  - Fuentes por categoría, aviso del tope, eliminar libera el cupo (19/20), una búsqueda real aparece sin recargar. Claro y oscuro a 1280 y 390 px sin desborde ni errores.
  - La comprobación que no pasó estaba mal planteada: esperaba que nada cambiara tras salir, pero la parte en curso terminó en el servidor (62 → 93) y ahí se detuvo.
- **Al cierre:** `npm test` 500/500, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario (teléfono y PC):** el porcentaje sube solo, "quedó indexado" y "Ver capítulos" aparecen sin recargar, retoma al salir y al bloquear el teléfono, y las fuentes guardadas funcionan. E10b y E10b2 confirmados.

### E10c Ampliación: libros en el Asistente

- **Plan actualizado antes de empezar** (commit `4c5c4dc`): E10c2 ("Guardar" y fuentes web en el Asistente) y la indexación en segundo plano en E11c.
- **Limpieza:** con el OK del usuario se revisó su cuenta: 0 documentos, 0 fuentes y 0 tareas; no hubo nada que borrar.
- **Respaldo previo:** `respaldos/2026-11-09_180445` (0 tareas, 0 documentos, 0 fragmentos, 0 fuentes, 14 conversaciones, 82 mensajes).
- **Migración M19** `supabase/migrations/20261109110000_nova_contexto_mensajes.sql`: `mensajes_chat.contexto`, con los fragmentos que usó cada respuesta (no estaba en el plan; hace falta para RB-40 y RB-41). `db:verificar` 0 fallas; compatibilidad con `master` (worktree, conexión directa): `db:verificar` y `probar:rag` con 0 fallas.
- **Reglas** (`src/lib/reglas/preguntasLibro.ts`): reconocer página y capítulo (número, romano, unidad o título), continuación y los 5 modos.
- **Servicio** (`src/lib/datos/consultaLibro.ts`, `consulta.ts`, `conversacion.ts`):
  - Por página o capítulo se responde con ese texto, sin búsqueda vectorial, y se le indica al modelo de qué página o capítulo es.
  - Un capítulo largo va por partes de 60 fragmentos, con "sigue con el resto".
  - Con varios libros y ninguno elegido, pregunta cuál. Respuestas exactas sin llamar a Gemini para página inexistente, capítulo inexistente y libro sin capítulos.
  - `explicarRespuesta` usa los mismos fragmentos y las mismas citas, y queda en el historial.
  - "Buscar en" limita también la búsqueda normal a un documento.
- **Interfaz:** selector "Buscar en" y los 5 modos bajo cada respuesta con citas, también en el historial.
- **Encontrado con Gemini real:** "Resume el capítulo 3" respondía "No encontré" porque nada le decía al modelo que esos fragmentos eran el capítulo 3. Corregido.
- **Pruebas:** `tests/reglas/preguntasLibro.test.ts`, `tests/servidor/consultaLibro.test.ts` y casos nuevos en `Chat.test.tsx`; actualizadas `conversacion` y `rutas-nova`.
- **`probar:libro`** (Gemini y base reales; 0 fallas, ahora con página, página inexistente, capítulo y "Más simple"). **`probar:rag`** 0 fallas. Dos intentos anteriores de `probar:libro` se cortaron por la red o por el fallo ya corregido.
- **Navegador real** (Edge, usuario temporal borrado al final, con Gemini real; 0 fallas en 14): selector, pregunta cuál con dos libros, página con su cita, 5 opciones táctiles solo bajo respuestas con citas, página inexistente, capítulo con sus páginas, "Más simple" con el mismo origen, opciones al recargar, los ids no salen al navegador, claro y oscuro a 1280 y 390 px.
- **Al cierre:** `npm test` 527/527, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario (teléfono y PC):** preguntar por página, página inexistente, resumir un capítulo con sus páginas, las 5 opciones con las mismas citas y en el historial al recargar, la pregunta de en cuál documento y buscar en uno solo funcionan.

#### Ajustes de E10c: citas y "No encontré" (2026-11-09, pedidos del usuario)

- **Citas cortas** (`src/lib/reglas/citas.ts`): el servidor las compacta, sin depender del modelo. Dentro del texto quedan `[p. 20]` o `[pp. 20–21]` y las páginas seguidas de cada párrafo se unen en un rango, en el lugar de la última. El nombre va en "Fuentes"; con varios documentos en la respuesta, cada cita conserva el suyo. `armarFuentes` reconoce también la forma corta, que el modelo puede imitar del historial.
- **Capítulos:** un fragmento puede empezar o terminar en la página vecina; ahora al modelo le llegan las etiquetas recortadas al capítulo y la respuesta se recorta otra vez. `contexto.limitePaginas` mantiene el límite al usar "Explicar de otra manera".
- **Con un documento elegido:** `No encontré esto en «nombre». Prueba con "Todos los documentos" en "Buscar en".`
- **Pruebas:** `tests/reglas/citas.test.ts` y casos nuevos en `tests/servidor/consultaLibro.test.ts`. `probar:libro` comprueba además que las citas del capítulo sean cortas y estén en sus páginas.
- **Con Gemini real:** `probar:libro` y `probar:rag` con 0 fallas; las citas del capítulo 3 quedaron en un solo `[pp. 20–28]`.
- **Al cierre:** `npm test` 543/543, `npm run build` correcto, `eslint` sin errores.

#### Ajuste de E10c: separadores y listas (2026-11-09, reportado por el usuario)

- **Problema:** al unir citas quedaban comas sueltas ("sus páginas,,,,, [pp. 20–28]") y una lista repetía la misma cita en cada punto.
- **Corrección** (`src/lib/reglas/citas.ts`): las citas separadas solo por comas, "y" o espacios se tratan como un grupo y se limpian juntas. Se quitan separadores repetidos, paréntesis vacíos y espacios dobles, solo en líneas con citas y sin tocar la marca de lista. Si todos los puntos seguidos de una lista tienen la misma cita, queda una sola al final.
- **Encontrado con Gemini real:** varios rangos con un solo nombre (`[l.pdf · pp. 16–17, 18–19, 19]`), citas seguidas en desorden, y viñetas bajo un punto numerado (son listas distintas). Corregidos.
- **Verificación con Gemini real:** dos documentos y 7 respuestas (resumen de capítulo, resumen en lista, página, lista de normas, preguntas sobre los dos documentos y "Paso a paso"): sin separadores sueltos, con las listas unidas y cada documento distinguido.
- **Al cierre:** `npm test` 554/554, `npm run build` correcto, `eslint` sin errores.
- **Prueba del usuario (teléfono y PC):** sin comas sueltas, la cita de las listas una sola vez y cada cita con su documento, también con "Paso a paso". E10c confirmado.

#### Ajuste de E10c: la pregunta por página usa solo esa página (2026-11-10, pedido del usuario)

- **Problema:** un fragmento cruza páginas, así que "¿Qué dice la página 12?" citaba `[pp. 11–13]` y podía usar texto de las vecinas.
- **Corrección:** migración M20 (`documentos.inicio_paginas`, respaldo `respaldos/2026-11-10_030959`). Con ella, al modelo solo le llega el texto de la página pedida, sin repetir el solapamiento, y la cita no sale de ella; también en "Explicar de otra manera". Una página en blanco lo dice.
- **Documentos indexados antes** (`inicio_paginas` en NULL): la cita se limita a la página y la respuesta avisa que puede incluir texto de las vecinas, hasta volver a indexarlos.
- **Pruebas:** casos nuevos en `tests/reglas/libros.test.ts`, `preguntasLibro.test.ts` y `tests/servidor/consultaLibro.test.ts`. `db:verificar`: la comprobación m) competía con los documentos reales del usuario; se amplió su límite.
- **Verificación:** `db:verificar` 0 fallas, también con el código de `master`. `probar:libro` con Gemini real 0 fallas: la cita de la página 10 es solo `p. 10` y sin texto de las vecinas.
- **Sin verificar:** `probar:rag` (en esta rama y con el código de `master`) falló por la cuota diaria de embeddings de Gemini, agotada por las pruebas del día (`EmbedContentRequestsPerDayPerProjectPerModel-FreeTier`). Hay que repetirlo cuando se reinicie la cuota.
- **Al cierre:** `npm test` 562/562, `npm run build` correcto, `eslint` sin errores.

#### Decisiones de plan (2026-11-09, solo documentos)

- **Cuota en pruebas:** embeddings guardados fuera de git, reutilizados solo si coinciden texto, modelo y dimensión; prueba completa con Gemini real una vez por etapa. El usuario aceptó el plazo de 7 días de RB-63.
- **Web:** el usuario confirmó que Wikipedia es opcional y que la entrega no la exige; se mantiene por la opción (b). Wikipedia pasa a "Buscar en" con "Guardar fuente" (E10c2, M18 y M21) y se agrega E10c3 con la IA general y la marca "Respuesta general de la IA, sin fuentes. Compruébala si es importante.".
- **Sin conexión:** solo lectura dentro de E11b (RB-62). La copia se borra según RB-63. Cambia la regla anterior de no guardar datos privados.
- **Sincronización sin conexión y búsqueda con Google:** solo anotadas (2.2).
- **Requisito antes de E10c2:** `probar:rag` con 0 fallas en la rama y con el código de `master`.

### E10c2 Ampliación: Wikipedia y fuentes guardadas en "Buscar en"

- **Ahorro de embeddings en las pruebas** (`scripts/cache-embeddings.ts`): solo se reutiliza un vector si coinciden el texto, el modelo y la dimensión, y también el tipo (consulta o documento), porque Gemini da vectores distintos para cada uno. Se guarda en `.cache-pruebas/`, fuera de git, con el hash del texto. Solo lo usan `probar:rag` y `probar:libro`.
- **Respaldo previo:** `respaldos/2026-11-10_160926`. Antes, `db:respaldar` y `db:restaurar` ya incluían `nova_config`, `categorias` y `capitulos` (commit `da83ed4`).
- **Migraciones:** M18 (`fuentes_web.vector`, `buscar_fuentes_web_usuario`) y M21 (`mensajes_chat.origen`). No crean tablas: la lista de respaldo no cambia.
- **Wikipedia (RB-58):** se busca desde "Buscar en" del Asistente y no guarda nada. `POST /api/nova/web` se conserva, solo para buscar.
- **"Guardar fuente" (RB-55):** en la categoría elegida, solo enlaces de `es.wikipedia.org`, sin repetir y con el tope de 20 al guardar, con bloqueo por usuario y categoría. Si Gemini falla, se guarda sin vector y se vectoriza al consultar.
- **"Fuentes web" (RB-56):** responde solo con las guardadas y las cita con su enlace.
- **Cambio de texto en RB-56:** decía "Búscalas y guárdalas en Fuentes", pero la búsqueda pasó al Asistente. Ahora dice: `Aún no tienes fuentes web guardadas. Elige "Wikipedia" en "Buscar en" y guarda las que te sirvan.`
- **Sin mezclas (RB-61):** el historial del modelo solo toma mensajes del mismo origen. Un capítulo por partes solo sigue si su parte es lo último de la conversación.
- **Interfaz:** selector "Buscar en" siempre visible, aviso a quién se envía la consulta al elegir Wikipedia, enlaces en "Fuentes" y Fuentes con Subir PDF y Fuentes guardadas. Se quitó `BuscadorWeb`.
- **`db:verificar`** 0 fallas, con la sección 6g nueva.
- **Compatibilidad con `master`** (worktree de `d175142`, borrado al terminar): `db:verificar` y `probar:rag` con 0 fallas.
- **`probar:rag`** con Gemini real, una sola vez en la etapa: 0 fallas, con los pasos 15a a 15h de esta etapa. Embeddings: 4 reutilizados y 11 pedidos.
- **Navegador real** (Edge, base real, usuario temporal borrado, respuestas del Asistente simuladas para no gastar cuota; 51 de 51): selector, enlace y "Guardar fuente" al recargar, aviso de Wikipedia, confirmación al guardar, Fuentes guardadas, dirección antigua, claro y oscuro a 1280 y 390 px.
- **`scripts/verificar-bd.mjs`:** su lista `TABLAS` no incluye `nova_config`, `categorias` ni `capitulos`, pero sus secciones 6b, 6c y 6e comprueban que existan y su RLS. Solo les falta el conteo de filas.
- **Al cierre:** `npm test` 605/605, `npm run build` correcto, `eslint` sin errores.

#### E10c2: correcciones tras la prueba del usuario en la vista previa

- **"Fuentes web" fallaba:** los registros de Vercel muestran cortes de la función a los 60 s, sin error de Gemini. La pantalla convierte ese corte en `ERROR_LLM`. Medido con una fuente guardada: el modelo principal no contestó en 15 s, y antes `responder` hacía 3 intentos sin tope de tiempo antes de pasar al respaldo. El SDK no pone tope por defecto.
- **Corrección en `gemini.ts`:** principal con un solo intento y 15 s; respaldo con el tiempo restante de 40 s; embeddings desde el Asistente con 10 s por intento. La indexación no cambia.
- **`ERROR_LLM` en tuteo** (`Intenta de nuevo.`), también en `PLAN_NOVA.md`.
- **Pantalla e historial:** el botón Atrás restauraba una copia vieja de la página. `Chat` llama a `router.refresh()` tras cada respuesta y tras "Conversación nueva". Una pregunta en error no se guarda (RN-20): sale de la conversación y queda en el aviso, con "Reintentar".
- **"cuando es navidad":** quedó en el historial con `origen` NULL, o sea que se hizo con "Todos los documentos". "Buscar en" se reiniciaba al cambiar de pestaña; ahora se recuerda con `sessionStorage` durante la sesión de esa pestaña. Lo que llega de "Pregúntale a Nova" va a todos los documentos.
- **Búsqueda de Wikipedia (RB-58):** `terminosDeWikipedia` quita el comienzo de la pregunta ("cuándo se celebra la navidad" traía Patricia Navidad; ahora, Navidad). El modelo recibe la pregunta completa.
- **`probar:rag`:** el paso 15f usa `consultarYRegistrar` (camino de la ruta) y se agregan 15f2 (menos de 50 s) y 15f3 (origen en el historial). No se repitió la prueba completa: el mismo camino se ejecutó una vez con Gemini real y un usuario temporal, 20 s en "Fuentes web" y 16 s de respuesta en Wikipedia.
- **Edge** (base real, usuario temporal borrado, el error simulado): 16 de 16.
- **Al cierre:** `npm test` 620/620, `npm run build` correcto, `eslint` sin errores.

#### E10c2: mensaje de "Fuentes web" y memoria de saturación (aprobados por el usuario, 2026-11-10)

- **RB-56 y B-69:** sin respuesta con "Fuentes web", `No encontré esto en tus fuentes web guardadas. Prueba con "Wikipedia" en "Buscar en".` El servidor lo impone. RN-13 no cambia en los demás casos.
- **Memoria de saturación (`gemini.ts`):** tras un 503 o un modelo que no contesta (504 o corte propio), durante 5 minutos `responder` empieza por el respaldo. Una cuota agotada (429), un error interno (500) o una conexión cortada no la activan. Si el respaldo falla o se queda sin cuota, responde el principal y la memoria se borra; si ninguno responde, también. Vive en la memoria de cada instancia de Vercel.
- **504:** con `httpOptions.timeout`, el SDK le avisa el tope a Gemini, que a veces responde 504 poco antes de cortar. Ahora cuenta como "no contestó" y pasa al respaldo.
- **Respuestas largas:** con 60 fragmentos sintéticos (39.000 palabras, por encima del máximo de RB-40), el principal tardó 40 s y entregó 5.182 tokens: el tope de 15 s la corta y responde el respaldo con los 25 s restantes. Un corte con contexto de 30.000 caracteres o más no activa la memoria. El límite para esos casos queda como propuesta al usuario.
- **Prueba real con usuario temporal** (borrado): el dato ausente dio el mensaje nuevo con el principal saturado (18 s); la siguiente pregunta fue directo al respaldo (0,7 s de modelo).
- **`probar:rag`:** el paso 15g compara con el mensaje nuevo; no se repitió la prueba completa.
- **Al cierre:** `npm test` 634/634, `npm run build` correcto, `eslint` sin errores.

#### E10c2: límite para textos largos (aprobado por el usuario, 2026-11-10)

- **`gemini.ts`:** con un contexto de 30.000 caracteres o más (capítulo, "Explicar de otra manera"), el principal tiene 75 s y todo el proceso 110 s, y se ignora la memoria de saturación: siempre empieza el principal. Las preguntas normales siguen con 15 s y 40 s.
- **`/api/nova/consultar`:** `maxDuration` 120. Es la única ruta que recibe textos largos; las demás siguen en 60. Según la documentación de Vercel, con Fluid Compute el plan Hobby admite hasta 300 s.
- **Navegador:** el `fetch` del Asistente no tiene tope propio. En Edge, una petición de 130 s a un servidor local llegó completa (200). No se pudo probar Safari del iPhone desde Windows; Vercel mantiene viva la conexión HTTP/2 con PING mientras espera.
- **Aviso:** tras 10 s de "Pensando…": `Los textos largos, como un capítulo, pueden tardar hasta un par de minutos. Espera un poco más.`
- **Prueba real (una llamada):** 60 fragmentos sintéticos (30.219 palabras): el principal contestó en 11 s, sin pasar al respaldo, pero respondió que no encontraba el dato (35 caracteres), así que esta llamada no prueba una respuesta larga. La de 40 s se había medido antes, directamente con la API.
- **Al cierre:** `npm test` 638/638, `npm run build` correcto, `eslint` sin errores.

#### E10c2 terminada (2026-11-10)

- **Prueba del usuario en la vista previa (PC e iPhone), sin fallas:** Fuentes web con una fuente guardada y su enlace; mensaje de Fuentes web sin resultado; "No encontré esto en tus documentos" en los demás casos; varias preguntas seguidas; "Buscar en" se conserva al cambiar de pestaña y "cuando es navidad" con Wikipedia; el botón Atrás muestra lo mismo que F5; capítulo largo en PC y en iPhone.
- Queda cerrada E10c2. Sigue E10c3, que empieza solo cuando el usuario lo indique.

### E10c3 Ampliación: IA general en "Buscar en"

- **Sin migración:** M21 ya admite `origen = 'ia'`. No hay tablas nuevas, así que la lista de respaldo no cambia y no hizo falta `db:respaldar`.
- **RB-59:** "IA (conocimiento general)" en "Buscar en" (`documentoId: "ia"`). `responderConIa` (`src/lib/datos/consultaIa.ts`) usa solo `llm.responder` con `SYSTEM_PROMPT_IA` y sin contexto: sin embeddings, documentos, tareas ni fuentes. Sin contexto, `gemini.ts` envía solo la pregunta. Nunca es respaldo automático.
- **Marca:** `MensajeChat` muestra `Respuesta general de la IA, sin fuentes. Compruébala si es importante.` en toda respuesta con origen `ia`, también al recargar, sin "Fuentes" ni "Explicar de otra manera". Al elegir la IA, un aviso: `Responde la IA con su conocimiento general, sin tus documentos, tareas ni fuentes. Puede equivocarse.`
- **RB-60:** "Preguntarle a la IA" solo bajo "No encontré esto en tus documentos" o "No encontré esto en «documento»…" (`ofrecePreguntarIa` en `src/lib/reglas/iaGeneral.ts`), no bajo Fuentes web, Wikipedia ni "Explícalo". Envía la misma pregunta con origen `ia`, deja intacta la respuesta anterior y desaparece cuando la pregunta ya se le hizo a la IA. Si la IA falla, vuelve.
- **RB-61:** la IA recibe solo el historial con origen `ia`.
- **Pruebas:** S-65 (`tests/servidor/consultaIa.test.ts`, `conversacion.test.ts`), S-66 (marca en `Chat.test.tsx`), S-67 (`tests/reglas/iaGeneral.test.ts`). `probar:rag` suma el paso 16; no se repitió la prueba completa.
- **Gemini real, una consulta con usuario temporal (borrado):** respondió sin fuentes ni embeddings y guardó los dos mensajes con origen `ia`. Tardó 32 s: el principal no contestó (504) y respondió el respaldo.
- **Edge** (base real, usuario temporal borrado, respuesta de la IA simulada; 18 de 18): opción en "Buscar en", botón bajo el "No encontré", la misma pregunta con `ia`, la marca al recargar, sin fuentes ni explicar, aviso al elegir la IA, claro y oscuro a 1280 y 390 px.
- **Al cierre:** `npm test` 655/655, `npm run build` correcto, `eslint` sin errores.

#### E10c3: el botón también bajo Fuentes web (pedido por el usuario, 2026-11-12)

- **Prueba del usuario en la vista previa (PC y teléfono):** las 8 pruebas de E10c3 salieron bien.
- **Cambio:** "Preguntarle a la IA" aparece también bajo `No encontré esto en tus fuentes web guardadas. Prueba con "Wikipedia" en "Buscar en".`, solo con origen `web`. Sigue sin salir bajo Wikipedia, la IA, "Explícalo" ni las respuestas con citas. RB-60 y S-67 se actualizaron en el plan.

#### E10c3 terminada (2026-11-12)

- **Prueba del usuario en la vista previa, sin fallas:** las 8 pruebas de E10c3 en PC y teléfono, y las 5 del botón bajo Fuentes web (el botón y la misma pregunta a la IA, sin botón bajo respuestas con enlace ni bajo Wikipedia, y el de documentos como antes).
- Queda cerrada E10c3. Sigue E10d.

### E10d Ampliación: plan de lectura por capítulos

- **Sin migración:** `capitulos.tarea_id` ya existía desde M15, con `ON DELETE SET NULL`. No hay tablas nuevas y no hizo falta `db:respaldar`.
- **Regla pura (`src/lib/reglas/planLectura.ts`, RB-42):** entre dos fechas, cada capítulo recibe un tramo igual de días y vence el último día de su tramo; el último vence el día final, y si hay más capítulos que días se comparten. Por semana (1 a 20), cada semana desde la fecha de inicio reparte sus capítulos en sus 7 días. Título `Leer cap. N: Título (pp. a–b)`: N sale del título si trae "Capítulo N" (y no se repite), si no, de su posición entre los de nivel 1; máximo 200 caracteres.
- **Servicio (`src/lib/datos/planLectura.ts`):** la vista previa no escribe nada. Confirmar recalcula con las filas de `capitulos` bloqueadas (`FOR UPDATE`), crea una tarea por capítulo (prioridad 2, categoría con RB-33; por defecto la del documento) y marca `tarea_id`, todo en una transacción. Solo capítulos de nivel 1; los que ya están en Tareas se omiten; si no queda ninguno, `CAPITULO_EN_TAREAS` (409).
- **Rutas:** `POST /api/nova/documentos/[id]/plan-lectura` (vista previa) y `.../plan-lectura/confirmar` (201). Mensajes exactos: `La fecha final debe ser igual o posterior a la de inicio.` (422) y `Este capítulo ya está en Tareas.`
- **Pantalla "Ver capítulos" (`PlanLectura`):** casillas en los capítulos de nivel 1, "Elegir todos", "Entre dos fechas" o "Capítulos por semana", fechas con la máscara AAAA-MM-DD, categoría y "Ver plan". La vista previa se quita al cambiar cualquier dato. Al crear: `Se crearon N tareas de lectura en «categoría».` con "Ver en Tareas".
- **Pruebas:** S-40 y S-41 (`tests/reglas/planLectura.test.ts`), servicio y rutas (`tests/servidor/planLectura.test.ts`), pantalla (`tests/interfaz/PlanLectura.test.tsx`).
- **Edge con la base real** (usuario, documento y capítulos temporales, borrados al final; sin Gemini; 16 de 16): B-54 con 4 capítulos del 16 al 29 de noviembre (19, 22, 26 y 29), la vista previa no crea nada, prioridad 2 y categoría del documento, capítulos marcados, repetirlo da 409 sin duplicar, las tareas en Tareas, Calendario y Mi semana, borrar una tarea libera su capítulo, teléfono en oscuro sin desborde.
- **Al cierre:** `npm test` 688/688, `npm run build` correcto, `eslint` sin errores.

#### E10d terminada (2026-11-12)

- **Prueba del usuario en la vista previa (PC y teléfono), sin fallas:** las 10 pruebas de E10d. La 7 (por semana) se hizo después de la 9, porque el libro ya tenía todos sus capítulos en Tareas: el bloqueo funcionó y, al borrar una tarea, su capítulo se pudo elegir otra vez.
- Queda cerrada E10d. Sigue E10e.

### E10e Ampliación: cuestionarios

- **Respaldo previo:** `respaldos/2026-11-12_160752`. `respaldo.mjs` ahora omite, con aviso, las tablas de la lista que aún no existen (antes de la migración que las crea). La lista suma `cuestionarios`, `preguntas_cuestionario`, `intentos_cuestionario` y `respuestas_intento`, con los padres primero.
- **M17** (`20261112100000_nova_cuestionarios.sql`): las 4 tablas con RLS, FK compuestas al dueño, `ON DELETE CASCADE` desde el documento, `correcta` de 0 a 3, 4 opciones, 5/10/20 preguntas, rango válido y PK `(intento_id, pregunta_id)` (RB-51). `db:verificar` 0 fallas, con la sección 6h (ah a as).
- **Compatibilidad con `master`** (worktree de `d175142`, borrado al terminar): `db:verificar` 0 fallas; `probar:rag` 0 fallas en el segundo intento (el primero se cortó por la red con Gemini, `fetch failed`, sin dejar datos: `db:limpiar` no lista nada).
- **Reglas puras (`src/lib/reglas/cuestionarios.ts`):** hasta 3 fragmentos por pregunta repartidos de manera uniforme (en un libro completo, por turnos entre capítulos); mínimo de RB-49; validación de 9.6 (etiqueta entregada, cita de 20 a 200 caracteres literal en ese fragmento sin distinguir mayúsculas, espacios ni guiones de fin de línea, y con la primera y la última palabra que pueden quedar cortadas; 4 opciones distintas; `correcta` de 0 a 3; enunciado no repetido); barajar; página exacta de la cita; puntaje de 7.11. Pruebas S-51 a S-57.
- **B-60, hallazgo con Gemini real:** con un rango de páginas, el modelo citaba texto de las páginas vecinas que traen los fragmentos. Ahora, con `inicio_paginas` (M20), cada fragmento se recorta a las palabras del alcance (rango o capítulo) y la página de la cita se calcula exacta. Un documento indexado antes de M20 recibe el fragmento entero y la etiqueta se recorta al alcance: la cita puede venir de una página vecina hasta reindexarlo.
- **Gemini (`gemini.ts`):** `generarJson` con `responseMimeType` y esquema, el mismo respaldo y los mismos topes que `responder` (lógica común en `conRespaldo`), y `tiempoMaximoMs`. Sin cupo en los dos modelos, `CUOTA_AGOTADA` (RB-52). A lo sumo 2 llamadas por cuestionario; la segunda, solo por las que faltan y si quedan más de 50 s.
- **Rutas:** `POST /api/nova/cuestionarios` (`maxDuration` 120, no 60 como decía el plan, por el mismo motivo que el Asistente), `GET /api/nova/cuestionarios/[id]`, `POST .../intentos` y `POST /api/nova/intentos/[id]/respuestas`. Al crear se guarda también el primer intento. Mensajes nuevos que el plan no fijaba: `Espera a que este documento termine de indexarse.` y `El cuestionario no existe.`
- **Pantallas:** "Crear cuestionario" en Fuentes y en "Ver capítulos"; `/nova/cuestionarios/nuevo` (alcance, 5/10/20, dificultad, aviso de que puede tardar); `/nova/cuestionarios/[id]` con una pregunta por pantalla, opciones de todo el ancho de 56 px y letra de 16, ícono y texto al responder, explicación, cita y página, resultado con puntaje y falladas, "Repetir solo las que fallé" y "Hacer de nuevo". La confirmación de RN-22 dice que se borran los cuestionarios.
- **`probar:cuestionario`** (Gemini real, 2 ejecuciones): la primera falló porque los dos modelos estaban saturados (504 y 503), sin guardar nada; la segunda dio 5 de 5 en 7 s con una llamada y encontró el problema de B-60. Tras la corrección no se repitió, para no gastar cuota: la cubren las pruebas automáticas.
- **Edge** (base real, usuario y libro temporales, crear simulado; 18 de 18): enlaces, formulario y rango inválido, aviso de RB-49, acierto y fallo con texto, respuesta fija y guardada al momento, B-63, teléfono en oscuro con "reducir movimiento", resultado 3,0 de 5, repaso 5,0 y "Hacer de nuevo".
- **Al cierre:** `npm test` 766/766, `npm run build` correcto, `eslint` sin errores. Dos pruebas de tiempos (`indexacionPendiente` y las de Gemini con reloj simulado) fallaron una vez con la máquina cargada y pasan solas; las de Gemini ahora restauran el reloj siempre.

#### E10e terminada (2026-11-12)

- **Prueba del usuario en la vista previa (PC y teléfono), sin fallas:** las 9 pruebas de E10e. En la 4 volvió al cuestionario con su dirección, porque en Fuentes no había cómo abrir uno ya creado.
- **Pedido del usuario para E10f:** además de `/nova/cuestionarios`, un enlace a los cuestionarios desde Fuentes y desde "Ver capítulos".
- Queda cerrada E10e. Sigue E10f.

### E10f Ampliación: historial de cuestionarios y repaso

- **Sin migración:** M17 ya tenía `repaso_de` en los intentos y `capitulo_id` en las preguntas. Sin llamadas a Gemini en esta etapa.
- **Reglas (`src/lib/reglas/historialCuestionarios.ts`):** `compararIntentos` (S-58: cada intento terminado frente al terminado anterior del mismo cuestionario; los repasos y los sin terminar no se comparan ni sirven de referencia) y `capitulosParaRepasar` (S-59: capítulos con 2 o más falladas). `tituloTareaCapitulo` acepta el verbo "Repasar"; `textoAlcance` en `cuestionarios.ts` ("Página 5" si el rango es de una sola página).
- **Servicio (`src/lib/datos/historialCuestionarios.ts`):** `listarCuestionarios` (por documento; dentro, el documento completo, los capítulos en su orden y luego los rangos de páginas; intentos del más reciente al más antiguo; fechas en Bogotá), `sugerenciasDeRepaso` (en `obtenerCuestionario` y en el resultado de la última respuesta, con `yaExiste`) y `crearTareaRepaso` (RB-53: solo con 2 o más falladas del capítulo en un intento terminado; bloqueo `pg_advisory_xact_lock` por usuario y título; si hay una tarea sin completar con ese título, `TAREA_REPASO_EXISTENTE` 409 `Ya tienes esa tarea de repaso.`; prioridad media; categoría con RB-33, por defecto la del documento).
- **Ajuste a E10e:** en un cuestionario de un capítulo, todas sus preguntas cuentan para ese capítulo (o el de nivel 1 que lo contiene), aunque un fragmento empiece en la página anterior.
- **Rutas:** `GET /api/nova/cuestionarios?documentoId=` y `POST /api/nova/intentos/[id]/tarea-repaso` (201).
- **Pantallas:** `/nova/cuestionarios` (`?documento=` para uno solo, con "Ver los de todos los documentos"), cada cuestionario con alcance, dificultad, preguntas, fecha, "Abrir" o "Continuar" e intentos con fecha, "Repaso", puntaje y "Mejoraste", "Igual que la vez anterior" o "Bajaste" con ícono y texto. En el resultado, "Para repasar" con "Crear tarea de repaso", que abre un diálogo con fecha límite (mañana por defecto) y categoría. El cuestionario vuelve a "Cuestionarios" en vez de a "Capítulos".
- **Enlaces pedidos por el usuario:** "Mis cuestionarios" en Fuentes (sobre "Tus documentos") y "Ver cuestionarios" en "Ver capítulos".
- **Pruebas:** S-58 y S-59 (`tests/reglas/historialCuestionarios.test.ts`), servicio y rutas (`tests/servidor/historialCuestionarios.test.ts` y dos casos nuevos en `cuestionarios.test.ts`), pantallas (`tests/interfaz/HistorialCuestionarios.test.tsx`).
- **Edge con la base real** (usuario, libro y cuestionario temporales, borrados al final; 18 de 18): enlaces de Fuentes y "Ver capítulos", estado vacío, B-66 (sugerencia, diálogo, tarea con prioridad media, fecha y categoría; la segunda vez "Ya tienes esa tarea de repaso."), dos peticiones a la vez crean una sola tarea (201 y 409), B-65 (Bajaste, Mejoraste sin contar el repaso, "Repaso"), teléfono en oscuro sin desborde y el diálogo como hoja inferior.
- **Al cierre:** `npm test` 793/793, `npm run build` correcto, `eslint` sin errores.

#### E10f terminada (2026-11-12)

- **Prueba del usuario en la vista previa (PC y teléfono), sin fallas:** las 8 pruebas de E10f, incluidos los enlaces pedidos desde Fuentes y "Ver capítulos".
- Queda cerrada E10f. Sigue E11, solo cuando el usuario lo indique (pausa pedida por el usuario).

### E11 Ampliación: Configuración completa

- **Respaldo previo:** `respaldos/2026-11-13_152112`. `preferencias_usuario` entra en la lista de respaldo, después de `categorias`.
- **M7** (`20261113100000_nova_preferencias.sql`): `preferencias_usuario` con tema, formato de hora, nota para aprobar (NUMERIC 3,2), redondeo y cortes por defecto (de 1 a 6, cada uno mayor que 0 y suman 10000, con la función inmutable `nova_cortes_validos`), RLS sin políticas. **Desvío del plan:** la columna `formato_hora` ('24' o '12'), que la tabla 6.3 no traía aunque E11 la pide. `db:verificar` 0 fallas, con la sección 6i (at a az).
- **Compatibilidad con `master`** (worktree temporal, borrado al terminar): `db:verificar` 0 fallas y `probar:rag` 0 fallas.
- **Reglas (`src/lib/reglas/preferencias.ts`):** números con coma en centésimas, RB-11, RB-26, cortes por defecto que deben sumar 100 % (mensaje de RB-07 como error), textos de RB-25. `formatearHora` y `formatearHorario` aceptan el formato de 12 horas (`1:30 p. m.`).
- **Servicio (`src/lib/datos/configuracion.ts`):** `obtenerPreferencias` (sin fila, los valores por defecto), `obtenerConfiguracion`, `actualizarConfiguracion` (valida todo antes de escribir; el nombre va a `public.users.full_name`; lo demás con `INSERT … ON CONFLICT`) y `borrarHistorial` (las conversaciones del usuario; los mensajes se van en cascada).
- **Rutas:** `GET/PATCH /api/nova/configuracion` (esquema estricto) y `DELETE /api/nova/conversaciones`. Mensajes nuevos: `NOMBRE_PERFIL_INVALIDO`, `NOTA_APROBAR_INVALIDA`, `PORCENTAJE_INVALIDO` y `CORTES_NO_SUMAN` (422).
- **Tema y formato de hora en toda la app:** el layout de Nova lee las preferencias y `ProveedorPreferencias` aplica el tema de la base (y lo recuerda en el navegador para el script del `<head>`) y entrega el formato de hora; `HorarioTarea` lo usa en Tareas, y `CasillaTarea` y `CalendarioMes` con `useFormatoHora`. El Asistente sigue recibiendo los horarios en 24 horas.
- **Pantalla `/nova/configuracion`:** Perfil (nombre, correo de solo lectura, cambiar contraseña con `/api/auth/password` y sus mensajes), Apariencia (tema al momento; formato de hora), Académico (escala 0,0 a 5,0, nota para aprobar, redondeo, cortes con su suma, agregar y quitar), Asistente (aviso de lo que se envía a Gemini y de la privacidad del plan gratuito; "Borrar historial" con la confirmación de RB-25) y Sesión (cerrar sesión). Configuración vuelve al menú: barra lateral y hoja "Más".
- **Pruebas:** reglas (`tests/reglas/preferencias.test.ts`), servicio y rutas (`tests/servidor/configuracion.test.ts`), pantallas (`tests/interfaz/configuracion.test.tsx`), navegación y lista de respaldo actualizadas.
- **Edge con la base real** (usuario temporal con una tarea con horario y una conversación, borrado al final; 27 de 27): bloques y menú, B-03 (oscuro al momento, guardado, sin parpadeo al volver y tomado de la base en un navegador sin nada guardado), 12 horas en Inicio, Tareas y Calendario, RB-11 y la suma de los cortes, académico guardado, B-22 (nombre en `public.users`, contraseña actual equivocada, la nueva sirve para entrar), B-23 (confirmación, conversaciones y mensajes borrados, chat vacío), teléfono en oscuro sin desborde y "Más", cerrar sesión.
- **Al cierre:** `npm test` 826/826, `npm run build` correcto, `eslint` sin errores. Sin llamadas a Gemini salvo `probar:rag` de `master`.

#### E11 terminada (2026-11-13)

- **Prueba del usuario en la vista previa (PC y teléfono), sin fallas:** las 8 pruebas de E11.
- Queda cerrada E11. Sigue E11b.

### Plan: etapa E10g agregada (2026-11-13)

- A pedido del usuario (sugerencia de un amigo): tipos de pregunta en los cuestionarios, para hacer después de E11d. Plan: X31, 5.12, 6.18 (M22), 7.12, 7.13, 9.7, RB-64 a RB-69, S-70 a S-75, B-77 a B-81, un riesgo nuevo en la sección 13 y la ruta de autoevaluación; prompt de E10g antes de E12. Sin código todavía.

### E11b Ampliación: app instalable y consulta sin conexión

- **Sin migración.** Sin llamadas a Gemini.
- **Instalable:** manifiesto en `/manifest.webmanifest` (`src/lib/manifiesto.ts` y su ruta; enlazado a mano con `crossorigin="use-credentials"` para que la vista previa protegida por Vercel lo pueda leer; "Nova", `standalone`, `start_url` /nova, colores de los tokens), íconos provisionales en `public/icons/` (192, 512, maskable 512 y apple-touch-icon 180, generados con Edge desde un SVG; los finales en E20b), metadatos de Apple y `themeColor` claro/oscuro en el layout raíz. El middleware deja pasar sin sesión el service worker, sus reglas, el manifiesto y los íconos; `next.config.ts` los sirve sin caché.
- **Service worker (`public/sw.js`, reglas puras en `public/sw-reglas.js`):** registrado desde el layout de Nova (solo en producción) con alcance `/nova`. Páginas: primero la red; con conexión guarda copia de Inicio, Tareas (con sus filtros), el Calendario del mes actual (en Bogotá) y los capítulos; sin conexión, la copia, `Esta pantalla aún no está disponible sin conexión.` o `Necesitas conexión para esto.` en una página mínima con el tema guardado. Archivos estáticos de Next: primero lo guardado (máximo 400). Nunca la API, el Asistente, los pedidos RSC ni el texto de los documentos.
- **RB-63:** el middleware marca cada página de Nova con `x-nova-usuario`; la copia se borra al cerrar sesión (`POST /api/auth/logout` correcto), con 401/403 de la API de Nova, si una página de Nova redirige (sesión rechazada), si entra otro usuario y tras 7 días sin una respuesta válida.
- **Pantalla (`ConexionNova`):** `Sin conexión · datos de las HH:MM` (hora de la copia, o de carga si se pierde la conexión con la página abierta, con el formato de Configuración). Sin conexión, un bloqueo global (clic, Enter/Espacio, envío y foco) desactiva todo control y todo enlace a una pantalla sin copia, con `Necesitas conexión para esto.`; lo que solo muestra queda activo con `data-sin-conexion="permitido"` (días de Mi semana y Calendario, "Hoy", "Más" y "Cerrar"). Al volver la conexión, una página que salió de la copia se recarga.
- **Configuración → "Instalar Nova":** guía para iPhone y Android, botón "Instalar" cuando Chrome lo ofrece (el aviso se guarda en `src/lib/instalacion.ts`), "Nova ya está instalada en este dispositivo." si se abre como app, la sesión propia del iPhone y el aviso del teléfono compartido.
- **Pruebas:** S-68 y S-69 (`tests/reglas/sinConexion.test.ts`, que también comprueba que el navegador y el service worker deciden lo mismo), el service worker completo con caché y red simuladas (`tests/servidor/serviceWorker.test.ts`) y pantallas (`tests/interfaz/conexion.test.tsx`).
- **Edge con la base real** (usuario, tarea, documento y capítulo temporales, borrados al final; 26 de 26). Sin conexión de verdad: el script apaga el servidor de prueba.
  - Instalable: manifiesto, íconos públicos, service worker sin caché, metadatos de Apple, alcance /nova y `Page.getInstallabilityErrors` sin errores (en lugar de Lighthouse, que no está instalado).
  - B-74 en Inicio, Tareas, Calendario y capítulos, y una pantalla nunca abierta.
  - B-75: completar desactivado y atenuado; elegir un día sigue; Asistente, Configuración, cuestionarios y Nueva tarea piden conexión; al volver, todo funciona.
  - B-76: al cerrar sesión y con la sesión rechazada, la copia se borra.
- **Al cierre:** `npm test` 873/873, `npm run build` correcto, `eslint` sin errores.
- **Pendiente del usuario:** B-55 en un iPhone y un Android reales (agregar a inicio, pantalla completa, iniciar sesión dentro de la app).

#### E11b: corrección de la copia al navegar con el menú (2026-11-13)

- **Falla del usuario (prueba 2, PC con F12 › Red › Sin conexión):** casi todas las pantallas decían `Esta pantalla aún no está disponible sin conexión.` aunque se habían abierto antes. Causa: el service worker solo guardaba la copia en una carga completa (`mode: "navigate"`); al moverse con el menú o con un enlace, Next cambia de pantalla con un pedido interno (RSC) que no es HTML y no se guardaba. Solo quedaban las pantallas recargadas con F5. La prueba de Edge no lo vio porque abría cada pantalla con `goto`, que es una carga completa.
- **Corrección:** `ConexionNova` avisa al service worker (`nova-guardar-ruta`) en cada cambio de ruta a una pantalla guardable, también en la primera carga si el service worker todavía no controla la página; nunca sin conexión ni desde una copia. El service worker pide esa página completa (HTML, con la sesión y sin seguir redirecciones) y la guarda con las mismas reglas (`paginaGuardable`, RB-63 incluido). El Asistente, otro mes del Calendario, la API y otros sitios no se piden.
- **Pruebas nuevas:** el mensaje del service worker (guardar, reglas, sesión rechazada y sin conexión) en `serviceWorker.test.ts`; el aviso en cada cambio de ruta en `conexion.test.tsx`; y en Edge, `ui_e11b_menu.mjs`, que navega solo con el menú y los enlaces desde la primera visita (comprobado sin ninguna recarga) y luego, con el servidor apagado, abre cada pantalla: 11 de 11. La prueba anterior sigue en 26 de 26.
- **Al cierre:** `npm test` 879/879, `npm run build` correcto, `eslint` sin errores.

#### E11b: detalles de la app instalada en el iPhone (2026-11-13)

- **Prueba del usuario con `b84d8d4`:** todas las pruebas de E11b bien en PC e iPhone con la app instalada. Pidió tres detalles antes de cerrar.
- **Barra inferior sobre la rayita de inicio:** sin `viewport-fit=cover`, el iPhone deja el área segura en 0. Ahora el viewport la lleva, y el margen inferior de la barra, el "+", los diálogos, la hoja "Más", el aviso de E11b, el botón del chat y el final del contenido usan `--nova-seguro-abajo`: el área segura solo con `display-mode: standalone`, y 0 en Safari y en el PC, como antes. A los lados, el área segura del iPhone en horizontal.
- **Franja de arriba azul oscuro:** era el fondo de la página del estilo anterior (`--background: #080b14`), que se ve detrás de la barra de estado. Las pantallas de Nova y de acceso (`data-nova-fondo`) pintan `html` y `body` con `--nova-fondo`; `/home` y `/dashboard` no cambian. Además, `theme-color` sigue el tema elegido en Nova y no solo el del sistema (`aplicarColorBarra` y el script del `<head>`, que guarda el `media` original para volver a "Automático").
- **Inicio de sesión sin conexión:** el formulario mostraba el mensaje de configuración ante cualquier error. Ahora una falla de red (`TypeError` de `fetch`, o el navegador sin conexión) dice `Necesitas conexión para esto.` (`esFallaDeRed`); el mensaje técnico queda para una respuesta que no se puede leer. Igual en Crear cuenta.
- **Pruebas:** `tests/reglas/areaSegura.test.ts` y tres casos en `tests/interfaz/acceso.test.tsx`. En Edge (`ui_e11b_ios.mjs`, 14 de 14): viewport, fondo de Nova en acceso y en Nova, tema oscuro con el sistema en claro, `theme-color`, vuelta a automático, `/home` sin cambios, sin margen extra en Safari y el PC, con el área segura simulada (34 px) la barra crece, el "+" queda encima y el contenido no se tapa; sin errores de hidratación. Las dos pruebas anteriores de E11b siguen en 26 de 26 y 11 de 11 (a la primera le faltaba esperar el aviso en Calendario y capítulos: era de la prueba).
- **Al cierre:** `npm test` 890/890, `npm run build` correcto, `eslint` sin errores.

#### E11b: rapidez al cambiar de pestaña (2026-11-13)

- **Prueba del usuario con `9ea0497`:** los 4 puntos bien en el iPhone (app instalada y Safari) y en el PC. Pidió revisar la lentitud al cambiar de pestaña antes de cerrar.
- **Medición** (local, `next start` de cada versión, Edge, 20 cambios entre Inicio, Tareas, Calendario y Fuentes con 30 tareas; intermediario que anota cada pedido al servidor): mediana de 563 ms antes de E11b (`e1230a5`), 559 ms en `b84d8d4` y 545 ms en `9ea0497`; igual cambiando cada 0,3 s y con la CPU 4 veces más lenta. E11b no lo empeoró: ya era así. Casi todo es el servidor (≈ 545 ms del pedido RSC) y la pantalla no mostraba nada mientras tanto.
- **Lo que sí agregó `b84d8d4`:** con la página controlada por el service worker, 15 páginas completas extra por cada 20 cambios (el servidor arma la pantalla dos veces). Además, tras iniciar sesión con el formulario la pestaña nace en `/login`, fuera del alcance: el service worker no la controla y `navigator.serviceWorker.ready` no se resuelve, así que ahí no se guardaba ninguna copia hasta una carga completa.
- **De qué está hecho el tiempo del servidor:** desde aquí, Supabase Auth 167 ms y la base 70 ms por viaje; el middleware, el layout y la página consultaban la sesión cada uno (las del layout y la página en paralelo). Vercel corre en `iad1` (Washington) y Supabase en `us-east-1` (Virginia): están juntos; allí esos viajes son de pocos ms y pesa la ida y vuelta del usuario a Washington (≈ 190 ms desde aquí). Al cargar Inicio o Tareas, Next pedía por adelantado cada enlace "Editar" (unos 20 pedidos al servidor).
- **Cambios:** `src/app/nova/loading.tsx` (esqueleto con tokens, `motion-safe:animate-pulse`, `role="status"` "Cargando…", `data-nova-cargando`); `AvisarRuta` pide la copia cuando la pantalla lleva `ESPERA_GUARDAR_MS` (2 s) quieta y el navegador está libre (`requestIdleCallback`; en Safari, solo la espera), la cancela si se cambia antes y usa `getRegistration('/nova')` en vez de `ready`; el service worker marca cada copia con `x-nova-guardada` y no la vuelve a pedir si tiene menos de 5 minutos (`copiaReciente`; las cargas completas guardan siempre); `obtenerSesion` con `cache` de React (una consulta a Supabase Auth por pedido entre layout y página); `prefetch={false}` en Editar tarea, los botones de cada documento en Fuentes y abrir cada cuestionario.
- **Después:** la señal aparece en 11 a 27 ms (antes ≈ 555 ms); la pantalla completa, igual que antes en local (≈ 555 ms, es el servidor); 0 a 2 páginas extra del service worker por cada 20 cambios (antes 15); consultas a Supabase Auth desde las pantallas: 8 en 8 cambios (antes 14).
- **Pruebas:** `tests/interfaz/cargando.test.tsx`; `conexion.test.tsx` con reloj simulado (espera, cancelar al cambiar, sin conexión durante la espera, `ready` que no se resuelve); `serviceWorker.test.ts` con copia reciente, por pantalla, carga completa y copia sin hora. En Edge, `ui_e11b_rapidez.mjs` 13 de 13 (copias tras iniciar sesión con el formulario, esqueleto en 14 ms, sin animación con "reducir movimiento", pasar rápido no pide nada, no repite una copia reciente, sí renueva una vieja, sin pedidos anticipados de Editar); `ui_e11b.mjs` 26 de 26, `ui_e11b_menu.mjs` 11 de 11 (ahora se queda 2,5 s en cada pantalla, como una persona) y `ui_e11b_ios.mjs` 14 de 14.
- **Al cierre:** `npm test` 897/897, `npm run build` correcto, `eslint` sin errores.

#### E11b terminada (2026-11-13)

- **Prueba del usuario con `c674129` en el iPhone (app instalada) y en el PC, sin fallas:** el esqueleto sale al instante y se siente más ágil; la copia sin conexión se guarda al quedarse 2 segundos, también justo después de iniciar sesión; Editar, Ver capítulos, Crear cuestionario y Abrir funcionan igual.
- **Pendiente anotado para E20b o el cierre:** bajar el tiempo de carga de cada pantalla (hoy ≈ 550 ms en local).
- Queda cerrada E11b. Sigue E11c.

#### E11b: pantalla de arranque de la app instalada (2026-11-13, después del cierre)

- **Pedido del usuario:** al abrir la app en el iPhone se queda unos 2 segundos en negro y luego aparece Nova.
- **Causa:** iOS no usa el `background_color` del manifiesto. Mientras llega la primera respuesta del servidor muestra una imagen `apple-touch-startup-image` del tamaño exacto de la pantalla, y no había ninguna: por eso negro. La espera es la primera respuesta de la función de Vercel: en frío, 2,2 s hasta el primer byte (medido en producción con una ruta sin sesión); en caliente, 0,32 a 0,35 s.
- **Cambios:** `src/lib/arranque.ts` con los 13 tamaños de iPhone (iOS 16 o más, en vertical) y 26 imágenes en `public/icons/arranque/` (fondo de Nova claro u oscuro con el ícono provisional al centro, 478 KB en total; se descargan solo al agregar a inicio), enlazadas con `appleWebApp.startupImage` según el tema del sistema; el manifiesto usa `COLOR_FONDO.claro` como `background_color` y `theme_color` (Android).
- **Límite:** la pantalla de arranque sigue el tema del sistema, no el elegido en Nova (antes de abrir no se puede saber); al aparecer Nova ya toma el elegido. iOS guarda las imágenes al agregar a inicio: hay que quitar la app y volver a agregarla.
- **Propuesta pendiente de aprobación:** mostrar al abrir la copia guardada de Inicio con un aviso y actualizarla al llegar la respuesta del servidor.
- **Pruebas:** `tests/reglas/arranque.test.ts` (cada imagen existe, mide exacto y tiene el fondo de Nova; consultas sin repetir; manifiesto). En `next start`: 26 etiquetas en el HTML, imágenes públicas. `npm test` 900/900, `npm run build` correcto, `eslint` sin errores.

### E11c Ampliación: recordatorios con notificaciones push

- **M16** (`20261113110000_nova_recordatorios.sql`, respaldo previo en `respaldos/2026-11-13_183141`): en `tareas_personales`, `recordatorio`, `recordatorio_en` y `recordatorio_estado` con CHECK (valores, "15 min" y "1 hora" solo con horario, los tres juntos o ninguno) e índice parcial de los pendientes; `suscripciones_push` (endpoint único y https) y `envios` (un resumen por día, para E11d), con RLS; en `preferencias_usuario`, `hora_recordatorio` (8:00), `resumen_diario` y `hora_resumen` (E11d); `pg_net`, `pg_cron` y `nova_llamar_tick()`, que lee de Supabase Vault la dirección, el secreto y la omisión de Vercel (sin ellos no llama a nada), y el aviso `nova-recordatorios` cada minuto. Tablas nuevas en la lista de respaldo; `db:verificar` sección 6j (ba a bk). Compatibilidad con master: `probar:rag` y `db:verificar` del código de master con 0 fallas.
- **Claves:** VAPID (`web-push` 3.6.7) y `RECORDATORIOS_SECRETO` en `.env.local` y en Vercel (Production y Preview, verificado por nombre); omisión de la protección de Vercel para automatización creada en el proyecto (`VERCEL_AUTOMATION_BYPASS_SECRET` en `.env.local`); `NOVA_TICK_URL` apunta a la vista previa hasta E21. `npm run db:configurar-tick` guarda los tres en Vault (`-- --quitar` los borra). Ningún valor se imprime ni va al repositorio.
- **Regla (7.10, RB-43, RB-44):** `src/lib/reglas/recordatorios.ts` (opciones según haya horario, momento en Bogotá con cruces de medianoche, mes y año, omitido si ya pasó, ventana de 30 min, texto exacto). S-42 a S-49 en `tests/reglas/recordatorios.test.ts`.
- **Tareas:** crear y editar calculan el recordatorio con la hora fija de Configuración dentro de la transacción; editar no repite uno ya enviado si el momento no cambió; completar lo cancela; al cambiar la hora fija se recalculan los de las tareas sin horario (no los enviados). Campo "Recordatorio" en el formulario (vuelve a "Sin recordatorio" al quitar la hora; aviso `Ese momento ya pasó: no se enviará el recordatorio.`); campanita junto a la fecha en Tareas.
- **Notificaciones:** `src/lib/datos/notificaciones.ts` (suscripción por dispositivo, envío con TTL de 30 min, 404/410 borra la suscripción, otros errores quedan en `ultimo_error`, registro en `envios`); `GET/POST/DELETE /api/nova/notificaciones` y `POST /api/nova/notificaciones/prueba`; del lado del navegador, `src/lib/notificaciones.ts` y `PanelNotificaciones` (el permiso solo al tocar "Activar notificaciones"; guía del iPhone sin instalar; bloqueadas; "Enviar una de prueba"; desactivar en este dispositivo). Configuración → Notificaciones con la hora fija.
- **Aviso de cada minuto:** `POST /api/nova/recordatorios/tick` (fuera del middleware, exige `x-nova-tick` comparado en tiempo constante; `maxDuration` 60). Toma los pendientes con `FOR UPDATE SKIP LOCKED`, los marca en la misma transacción y envía después; los atrasados más de 30 min y los de usuarios sin dispositivos quedan `omitido` (RB-45); los completados desde master (que no conoce el recordatorio) dejan de avisar.
- **Service worker:** `push` muestra la notificación ("Nova", el texto, el ícono) y pone el numerito con `setAppBadge` (las que no se abrieron); al tocarla abre `/nova/tareas?tarea=<id>` o, con Nova abierta, la trae al frente y navega sin recargar (`nova-abrir`); solo lleva a rutas de Nova (`urlNotificacion`). `?tarea=` no crea otra copia sin conexión. `ResaltarTarea` lleva la vista a la tarea y la resalta 6 s.
- **RB-57:** el aviso avanza una parte del libro a medias más antiguo (`avanzarLibroEnSegundoPlano`, con el mismo bloqueo `indexando_hasta`); con la cuota agotada no espera (`sinEsperarCuota`) y lo deja para el minuto siguiente. La tarjeta dice `Puedes cerrar esta pantalla: seguirá sola.` S-62 y S-63 en `tests/servidor/recordatorios.test.ts`.
- **Pruebas:** reglas, servicio, rutas, service worker (`tests/servidor/swNotificaciones.test.ts`) e interfaz (`tests/interfaz/recordatorios.test.tsx`). `npm run probar:recordatorios` contra la base real, 18 de 18 (crear, editar, hora fija, sin dispositivo, dos avisos a la vez envían una sola vez, atrasada, completada desde master, completar cancela); sin llamadas a Gemini. En Edge (`ui_e11c.mjs`, 19 de 19): opciones con y sin horario, el permiso no se pide solo, guardar y editar, campanita, Configuración a 1280 px, **suscripción push real de Edge** (servicio de Windows) y "Enviar una de prueba" y el recordatorio vencido aceptados por el servicio con las claves VAPID, aviso de cada minuto 401 sin secreto y sin repetir, tarea resaltada, sin desborde a 390 px. Las pruebas de E11b siguen en 26, 11, 14 y 13 (la del menú se quedó esperando al arrancar la primera vez; al repetirla, 11 de 11).
- **Ajuste de una prueba existente:** `indexacionPendiente.test.tsx` esperaba 1 s y, con la suite completa, a veces no alcanzaba; ahora 3 s.
- **Pendiente:** activar el aviso en Supabase (`db:configurar-tick`) cuando la vista previa tenga este código; la prueba real del usuario en el iPhone y en Android (pantalla de bloqueo, banner, centro de notificaciones, numerito, sonido) y B-70 con un libro largo.

#### E11c: prueba del usuario y revisión del PC (2026-11-13)

- **Prueba del usuario** (iPhone con la app reinstalada y PC): bien la pantalla de arranque en claro y oscuro, activar y la de prueba en el iPhone, el mensaje de Safari sin instalar, "15 min antes" con la tarea resaltada, el recordatorio sin horario a la hora fija, las opciones sin horario, el aviso de fecha pasada y que una completada no avise. El usuario ejecutó `npm run db:configurar-tick` (tres "guardado" y el aviso activo). No probó el libro largo (B-70).
- **Falla en el PC:** la de prueba llegaba al iPhone y no al PC. En la base: dos suscripciones del usuario sin errores (iPhone por `web.push.apple.com` y Windows por `wns2-bn3p.notify.windows.com`, la de Edge); cada prueba desde las 14:39 y los recordatorios de las 14:40, `enviadas 2, fallidas 0`; el servicio de Windows los aceptó. `pg_cron`: 180 llamadas en 3 horas, todas 200. La entrega a Windows funciona; lo que falta es que el PC muestre la notificación.
- **Causa en Nova que lo empeora:** todas las de prueba usaban la etiqueta `prueba`, y en Windows una notificación que reemplaza a otra de la misma etiqueta queda en el centro de notificaciones sin aviso emergente. Ahora cada prueba lleva una etiqueta nueva, el service worker usa `renotify` al reemplazar (por ejemplo, la misma tarea) y el mensaje dice a cuántos dispositivos se envió. Lo demás depende de Windows y de Edge (notificaciones de Edge en Windows, No molestar, permiso del sitio en Edge, Edge en segundo plano).
- **Plan (pedido del usuario):** la opción de abrir con la copia de Inicio queda anotada para E20b, junto con bajar el tiempo de carga (no se hace por ahora). El paso del aviso de cada minuto a producción en E21 queda detallado en el plan 6.12 y en la TAREA 6 de E21. Nueva etapa E11e, después de E11d, solo plan: crear tareas sin conexión (X32, 5.13, 6.19 M23 `id_cliente`, 7.14, RB-70 a RB-75, S-76 a S-80, B-82 a B-86, un riesgo nuevo y el prompt de E11e).

#### E11c terminada (2026-11-13)

- **Prueba del usuario con `11ff305` en el PC:** tras revisar Windows y Edge, la de prueba llega al PC y al iPhone ("a tus 2 dispositivos") y en el PC se ve el aviso emergente. El usuario revisó y aprobó los cambios al plan (E11e y el paso del aviso a producción en E21).
- **Sin probar por el usuario:** B-70 (libro largo que termina de indexarse solo).
- Queda cerrada E11c. Sigue E11d.

### E11d Ampliación: resumen diario y "Agregar a mi calendario"

- **Sin migración:** M16 ya tenía `resumen_diario`, `hora_resumen` y el índice único de un resumen por usuario y día en `envios`.
- **Resumen diario (RB-46):** `procesarResumenes` en `src/lib/datos/notificaciones.ts`, llamado por el aviso de cada minuto junto a los recordatorios y el libro (un fallo en uno no impide los otros). Busca a quienes lo tienen activo, con la hora ya alcanzada en Bogotá y sin el de hoy; reserva el día en `envios` (`ON CONFLICT DO NOTHING`) antes de enviar, así que dos avisos a la vez mandan uno solo. Se decide una vez al día: sin tareas de hoy ni vencidas (`sin tareas`), sin dispositivos (`sin dispositivo`) o con más de 30 min de atraso (`omitido: atrasado`) queda anotado y no se manda. Texto en `textoResumen` (`Hoy: 3 tareas · 1 vencida`, `Hoy: 2 tareas`, `Hoy: 1 tarea vencida`); al tocarlo abre Inicio. Configuración → Notificaciones → "Resumen diario" (`ResumenDiario`: casilla, hora, "Guardar resumen"; la hora se bloquea con la casilla apagada). `resumenDiario` y `horaResumen` en las preferencias y en `PATCH /api/nova/configuracion` (`HORA_RESUMEN_INVALIDA`).
- **"Agregar a mi calendario" (RB-47, S-50):** `src/lib/reglas/ics.ts` arma el `.ics` (RFC 5545: CRLF, líneas plegadas a 75 bytes sin partir letras, texto escapado, `VTIMEZONE` de Bogotá fija en −05:00; con horario, inicio y fin en Bogotá; sin horario, evento de todo el día; `VALARM` según el recordatorio, relativo al inicio; sin horario, la hora fija desde la medianoche; UID de la tarea; enlace a la tarea). `GET /api/nova/tareas/[id]/ics` (sesión, tarea ajena o inexistente 404, `attachment` con nombre legible, `no-store`). `AgregarACalendario` en `AccionesTarea`: con texto en las tarjetas del teléfono, ícono en la tabla; al tocarlo aparece `Es una copia: si cambias la tarea en Nova, vuelve a agregarla.`. En la tabla "Eliminar" también pasa a ícono (rojo, con su nombre accesible de siempre) para que las acciones sigan en una línea en 17rem. Sin notificaciones activas, el formulario sugiere usar "Agregar a mi calendario".
- **Pruebas:** `tests/reglas/ics.test.ts` (RB-46 y S-50), `procesarResumenes` en `tests/servidor/recordatorios.test.ts`, ruta del `.ics` y aviso con resúmenes en `rutasRecordatorios.test.ts`, preferencias en `configuracion.test.ts`, interfaz en `recordatorios.test.tsx`. `npm run probar:recordatorios` contra la base real, 22 de 22 (4 nuevas: apagado no hace nada, dos avisos a la vez dan un solo resumen, el minuto siguiente no lo repite, atrasado queda anotado). En Edge (`ui_e11d.mjs`): `.ics` con y sin horario, 404 y 401, descarga real del archivo sin cambiar de pantalla, aviso de copia, 390 y 1280 px sin desborde y acciones en una línea desde 1280 px, resumen guardado y leído de la base, sugerencia en el formulario; 26 de 27: a 1024 px las acciones ocupan dos líneas, como ya pasaba antes de E11d con "Eliminar" (ahí la tabla no fija anchos).
- **Al cierre:** `npm test` 991/991, `npm run build` correcto, `eslint` sin errores. Sin llamadas a Gemini.
- **Pendiente:** la prueba del usuario (B-58 y B-59 en el iPhone; Android si lo tiene).

#### E11d: prueba del usuario y corrección del resumen (2026-11-13)

- **Prueba del usuario:** "Agregar a mi calendario" (pruebas 6 a 11) bien en el iPhone y el PC. Resumen diario: guardar bien, pero no llegó ninguna notificación.
- **En la base:** la preferencia quedó activa a las 18:47 (guardada a las 18:46). En `envios` ya había un resumen de hoy anotado a las 18:42 como `omitido: atrasado`. El aviso de cada minuto llamó a la vista previa cada minuto con 200 (180 de 180 en `cron`), y desde las 18:42 respondía con `resumenes`; a las 18:47 respondió `enviados 0` porque el día ya estaba usado. Las pruebas desde las 18:39 (sin el código de E11d) no tenían `resumenes`. Tareas del usuario contadas en ese momento: 1 de hoy, 0 vencidas, 2 dispositivos.
- **Causa:** a las 18:42 el resumen estaba activo con una hora de más de 30 minutos antes (probablemente las 7:00 de fábrica, en un primer guardado), así que se anotó como atrasado y reservó el día. Al cambiar la hora a las 18:47 la regla "uno por día" lo bloqueó. Error de diseño: una decisión sin envío no debía impedir una hora nueva el mismo día.
- **Corrección:** al activar el resumen o cambiar su hora, se borra el anotado de hoy si no llegó a ningún dispositivo (`omitido: atrasado`, `sin tareas`, `sin dispositivo`, errores o `enviadas 0`), dentro de la misma transacción; uno que ya llegó (`enviadas 1` o más) se conserva. Al guardar con una hora que pasó hace más de 30 minutos, la pantalla dice `Guardado. Hoy ya pasó esa hora: el resumen empieza mañana a las {hora}.` (`resumenPuedeLlegarHoy`).
- **Pruebas:** reglas, configuración e interfaz (con el reloj fijo). `npm run probar:recordatorios` 25 de 25 (tres nuevas: el anotado sin envío se borra al cambiar la hora, con la hora nueva sí llega ese día, uno ya enviado no se borra). `npm test` 993/993, `npm run build` correcto, `eslint` sin errores.

#### E11d terminada (2026-11-13)

- **Prueba del usuario con `47a371d` en el iPhone y el PC, sin fallas:** el resumen llegó a los dos dispositivos a la hora elegida (en `envios`, 19:06, `enviadas 2, fallidas 0`) y abrió Inicio; no llegó un segundo resumen el mismo día; con una hora pasada la pantalla dijo que empieza mañana. "Agregar a mi calendario" ya había salido bien (pruebas 6 a 11).
- **Sin probar por el usuario:** el día sin tareas (no llega nada).
- El usuario dejó el resumen desactivado (verificado en la base).
- Queda cerrada E11d. Sigue E11e.

### E11e Ampliación: crear tareas sin conexión

- **M23** (`20261114100000_nova_id_cliente.sql`, respaldo previo en `respaldos/2026-11-14_001056`): `tareas_personales.id_cliente` UUID opcional con índice único parcial `(usuario_id, id_cliente)`. Sin tablas nuevas (la lista de respaldo no cambia). `db:verificar` sección 6k (bl a bn); la 6j ahora usa un día fijo del pasado para su resumen de prueba (chocaba con el resumen real del usuario de hoy). Compatibilidad con master: `db:verificar` y `probar:rag` del código de master con 0 fallas.
- **Servidor (7.14, S-76):** `POST /api/nova/tareas` acepta `idCliente`; `crearTareaConResultado` busca primero la tarea del usuario con ese identificador (no vuelve a resolver la categoría ni el recordatorio) y si no está inserta con `ON CONFLICT ... DO NOTHING`; si otro envío la guardó a la vez, devuelve esa. 201 al crear, 200 si ya existía. `npm run probar:sin-conexion` contra la base real, 10 de 10 (reintento, cinco envíos a la vez dan una tarea, una categoría y un recordatorio, el reintento no repite una categoría borrada, otro usuario no choca, sin `idCliente` igual que antes, recordatorio pasado omitido, rechazo).
- **Dispositivo (RB-70, RB-72, RB-75):** reglas y mensajes en `src/lib/reglas/tareasPendientes.ts`; IndexedDB `nova-pendientes` y el envío en `src/lib/tareasPendientes.ts` (en orden de creación, una pestaña a la vez con Web Locks, 200/201 se borra, 400/422 queda "No se pudo enviar", 401/403 se detiene, red o 5xx reintenta; avisa a las otras pestañas con BroadcastChannel). `ProveedorPendientes` en el layout de Nova: envía al abrir con conexión, al volver la conexión y cada 30 s mientras queden; borra las de otro usuario; muestra los avisos; al cerrar sesión con pendientes pide confirmación (`useCerrarSesion`).
- **Formulario:** toda tarea nueva lleva su `idCliente`; sin conexión (o si el pedido falla por la red) se guarda en el dispositivo con las mismas validaciones y el tope de 50, y vuelve con `Guardada en este dispositivo. Se enviará cuando vuelva la conexión.`; `?corregir=` lo llena desde la pendiente rechazada y la reenvía con el mismo `idCliente` (RB-74); avisa RB-73. Editar sigue necesitando conexión.
- **Pantallas (RB-71):** `TareaPendienteFila` (insignia `Pendiente de enviar` o `No se pudo enviar`, sin casilla, "Descartar" con confirmación, "Corregir" si fue rechazada; funciona sin conexión) en Tareas (bloque `{n} tareas pendientes de enviar` arriba), Mi semana, Prioridades de hoy (ahora componente del navegador) y el Calendario (punto en el día y fila en la lista del día).
- **Sin conexión:** el service worker guarda `/nova/tareas/nueva` con cada copia de Inicio, Tareas o Calendario (una sola copia sin `?fecha=` ni `?corregir=`, que el formulario lee de la dirección) y los scripts y estilos que pide cada copia. Sin conexión, los enlaces permitidos y el regreso tras guardar se abren con una carga completa (`cargarPagina`): la navegación de Next sin red a veces no cambiaba de pantalla. Se encontró en Edge que el navegador avisa "online" al salir de la página y la recarga de E11b se comía la navegación; ahora no recarga si la página ya se está yendo. El formulario no se recarga solo al volver la conexión.
- **Pruebas:** `tests/reglas/tareasPendientes.test.ts` (S-77 a S-80 con un almacén en memoria y Web Locks simulado), `tests/interfaz/tareasPendientes.test.tsx` (formulario sin conexión, falla de red, tope, editar, fila, Corregir, envío al abrir y al volver, aviso entre pantallas, cerrar sesión), service worker (formulario guardado, sin repetir en 5 min, scripts guardados), reglas sin conexión, ruta con `idCliente`. En Edge (`ui_e11e.mjs`, 33 de 33, dos veces seguidas): copia del formulario y su script sin abrirlo, crear sin conexión desde la dirección y desde "Agregar" de Inicio, categoría nueva, insignias en Tareas, Inicio y Calendario a 390 px, descartar, envío al volver con el aviso y la base con cada tarea una vez, dos pestañas, recordatorio pasado, rechazo con "Corregir" y "Descartar", cerrar sesión con aviso, "Cancelar" y "Cerrar sesión y borrarlas". Pruebas de E11b: 25 de 26 (la que cambió a propósito: `/nova/tareas/nueva` ya no "necesita conexión"), menú 11 de 11, iPhone 14 de 14, rapidez 13 de 13.
- **Al cierre:** `npm test` 1023/1023, `npm run build` correcto, `eslint` sin errores. Sin llamadas a Gemini salvo `probar:rag` de la compatibilidad con master.
- **Pendiente:** la prueba del usuario (B-82 a B-86) en el iPhone con la app instalada y en el PC.

#### E11e: corrección de los accesos sin conexión y tuteo (2026-11-14)

- **Falla del usuario (iPhone, app instalada, modo avión):** el "+" de la barra inferior decía `Necesitas conexión para esto.` y no abría el formulario; los accesos para agregar tareas se veían atenuados, aunque "Registrar tarea" sí abría el formulario.
- **Causas:**
  - El "+" es un botón que solo abre su menú, y no estaba marcado como permitido sin conexión: el bloqueo global trata todo botón no marcado como una acción que necesita internet.
  - El estilo que atenúa sin conexión (`globals.css`) atenuaba todo enlace que empieza con `/nova/tareas/` (pensado para "Editar"), y eso incluía `/nova/tareas/nueva` y `/nova/tareas/nueva?fecha=…`: se veían atenuados aunque funcionaban.
  - Ese estilo solo miraba el control mismo, mientras que el bloqueo deja pasar todo lo que está dentro de una zona permitida: los campos y botones del formulario y "Descartar" se veían atenuados aunque funcionaban.
  - Las pruebas de E11e abrían el formulario por su dirección o con el enlace de Inicio, y no miraban si algo se veía atenuado: por eso no lo vieron.
- **Corrección:** el "+" lleva `data-sin-conexion="permitido"` ("Subir documento" de su menú sigue bloqueado y atenuado); el estilo no atenúa nada dentro de una zona permitida ni los enlaces a `/nova/tareas/nueva`, con o sin parámetros; nueva prueba `tests/interfaz/sinConexionEstilo.test.ts`, que compara lo atenuado con `bloqueadoSinConexion` enlace por enlace y control por control (con el estilo anterior falla en los enlaces al formulario y en las zonas permitidas). Las reglas del service worker para el formulario ya cubrían `?fecha=` y `?corregir=` (una sola copia). Mi semana no tiene botón propio para agregar.
- **Detalles pedidos:** en Tareas, con solo tareas pendientes de enviar, ya no aparece "Aún no tienes tareas" (`SoloSinPendientes`). Toda la app en tuteo: `Revisa los datos ingresados.`, `Debes iniciar sesión.`, `Tu cuenta no tiene acceso a Nova Assistant.`, `Indexa un PDF…`, `Recarga la página.`, `Alcanzaste el máximo de 20 fuentes…; archiva o elimina una.`, `Escribe un número entero…`, `Ocurrió un error inesperado. Intenta de nuevo.` y cada "Intente de nuevo" (once pantallas); anotado en el plan (sección 8) y en `ACEPTACION.md` (A-18). El inicio de sesión y el registro ya estaban en tú.
- **Además:** errores de tipos en las pruebas de E11e del commit anterior (las pruebas pasaban, `tsc` no); corregidos.
- **Pruebas:** `npm test` 1042/1042, `tsc` y `eslint` sin errores, `npm run build` correcto. En Edge, `ui_e11e_accesos.mjs` 17 de 17 (sin conexión: el "+" y su menú a 390 px, "Agregar" de Inicio y del Calendario con su fecha, "Registrar tarea", y a 1280 px; cada uno sin atenuar y abre el formulario con todo sin atenuar; Completar, Editar y Eliminar siguen atenuados y Completar bloqueado; "Descartar" normal). `ui_e11e.mjs` 34 de 34 (con la comprobación nueva del estado vacío). E11b sin conexión 25 de 26, igual que antes (la que cambió a propósito; actualizada en el guion).

#### E11e terminada (2026-11-14)

- **Prueba del usuario con `0afc5ad` en el iPhone (app instalada) y el PC, sin fallas:** crear sin conexión desde el "+" y los demás accesos, sin nada atenuado; envío al volver la conexión, sin repetir; recordatorio pasado; tuteo.
- **B-86 en el PC:** con `*://*/api/nova/tareas` bloqueado en Request conditions de Edge, la tarea quedó "Pendiente de enviar"; "Cerrar sesión" avisó, "Cancelar" no cerró, "Cerrar sesión y borrarlas" llevó a iniciar sesión y, al volver a entrar sin el bloqueo, la tarea ya no estaba. El primer intento se guardó normal: con el service worker activo el bloqueo no actuó hasta marcar y desmarcar "Bypass for network" en Application → Service workers. Anotado en las instrucciones de B-86 (plan, sección 12).
- **Sin probar a mano:** la 3 (en Tareas, con solo pendientes no sale "Aún no tienes tareas"); queda cubierta por la prueba de interfaz y la de Edge.
- **400 en la consola de Edge en la raíz de la vista previa (revisado):** según los registros de Vercel es un `OPTIONS /` (también desde el iPhone), que Next responde con 400 porque una página no atiende ese método. Nova no lo envía (su código solo usa GET, POST, PATCH y DELETE, y las peticiones a la misma dirección no llevan consulta previa); llega junto a la revisión del service worker y a un `HEAD /nova` que responde Vercel mismo (204, sin pasar por la app), así que viene de Vercel en la vista previa (protección o barra de herramientas). No afecta a la app; no se corrige. Aparte, `/favicon.ico` responde 404 (la app solo tiene íconos de Apple y del manifiesto); se deja para E20b.
- Queda cerrada E11e. Sigue E10g.

### E10g Ampliación: tipos de pregunta en los cuestionarios

- **M22** (`20261114110000_nova_tipos_pregunta.sql`, respaldo previo en `respaldos/2026-11-14_150105`): `tipo` en `cuestionarios` y `preguntas_cuestionario` (por defecto `unica`); `correctas`, `verdadero` y `respuesta_texto` en las preguntas, con un CHECK por tipo que reemplaza los de 4 opciones y correcta de 0 a 3; `elegidas`, `texto`, `autoevaluacion` y `puntos` en las respuestas; `opciones`, `correcta`, `elegida` y `acierto` admiten NULL. Las respuestas anteriores recibieron sus puntos (100 o 0) en la misma migración. Sin tablas nuevas. La primera versión dejaba pasar puntos con `acierto` en NULL (un CHECK con NULL no falla); se corrigió en el mismo archivo y se volvió a aplicar (todo se puede repetir). `db:verificar` sección 6l (bo a ck), sin fallas. Compatibilidad con master: `db:verificar` y `probar:rag` del código de master con 0 fallas (`probar:rag` con la conexión directa: el pooler cortó una vez).
- **Reglas** (`src/lib/reglas/tiposPregunta.ts`): reparto de mixto (RB-64), lo que falta de cada tipo para la segunda llamada, intercalar, puntos de la múltiple y puntaje del intento (7.12; en selección única da lo mismo que 7.11), comparación de completar (7.13), frase con `_____` armada por el servidor desde la cita (RB-67), textos de las pantallas. `validarPreguntas` (en `reglas/cuestionarios.ts`) valida cada tipo con cupos por tipo (9.7.2); sin cupos, como antes, todas de selección única. `barajarMultiple`.
- **Generación** (`src/lib/llm/cuestionario.ts`): un pedido con la cantidad de cada tipo y un esquema con `tipo` y los campos de cada uno; la segunda llamada pide solo lo que falta de cada tipo; como máximo 2.
- **Responder** (`src/lib/datos/cuestionarios.ts`): `POST /api/nova/intentos/[id]/respuestas` acepta `elegida`, `elegidas`, `verdadero` o `texto` según el tipo; si no corresponde, `Revisa los datos ingresados.` sin guardar (RB-69). Nuevo `POST /api/nova/intentos/[id]/autoevaluacion` (`bien`, `medias`, `mal`, una sola vez). El intento termina cuando todas tienen puntos (las abiertas, calificadas). "Repetir solo las que fallé" y la sugerencia de repaso cuentan las de menos de 1 punto. La vista no trae la solución antes de responder (RB-50); de la múltiple trae cuántas son correctas.
- **Pantallas:** "Tipo de preguntas" en el formulario (Mixto marcado); una pantalla por tipo: casillas de 56 px con `Hay {k} respuestas correctas.`, dos botones grandes de verdadero o falso, campo de texto en completar (el espacio en blanco se lee "espacio en blanco") y de varias líneas en la abierta, con la respuesta modelo, la cita y los tres botones; "Siguiente pregunta" solo cuando la pregunta está completa; resultado `{a} de {n} bien · {p} a medias` y la solución de cada fallada según su tipo; el tipo en el encabezado y en el historial.
- **Pruebas:** `tests/reglas/tiposPregunta.test.ts` (S-70 a S-73), servidor (crear mixto, segunda llamada, S-74, S-75, rutas), interfaz (cada tipo, volver a una abierta sin calificar, resultado, formulario, historial). `npm run probar:cuestionario` con Gemini real, una ejecución, 20 de 20 y 1 llamada: el mixto de 5 salió con una de cada tipo, intercaladas, y la frase de completar armada desde la cita. En Edge (`ui_e10g.mjs`, sin Gemini) 34 de 34: cada tipo a 390 px, volver a la abierta sin calificar, resultado y lo guardado en la base, repetir las falladas, un cuestionario anterior, historial, formulario, 1280 px en oscuro.
- **Al cierre:** `npm test` 1122/1122, `tsc` y `eslint` sin errores, `npm run build` correcto.
- **Pendiente:** la prueba del usuario (B-77 a B-81, y que los cuestionarios anteriores siguen igual, B-60 a B-66).

#### E10g terminada (2026-11-14)

- **Prueba del usuario con `c4e451d` en la vista previa, en el iPhone y el PC, sin fallas (las 7):** el mixto trae una de cada tipo con cita y página; la múltiple da puntaje parcial y pide marcar al menos una; verdadero o falso explica lo correcto; completar acepta mayúsculas, sin tildes y con espacios de más; la abierta conserva dónde iba y "A medias" vale 0,5; el resultado y "Repetir solo las que fallé" incluyen las parciales; los cuestionarios anteriores funcionan igual; cada uno muestra su tipo; en el teléfono todo se toca bien, sin zoom ni desplazamiento lateral.
- El usuario está de acuerdo con dejar el 400 de `OPTIONS /` sin corregir y el favicon para E20b.
- `doc/PRESENTACION_AMPLIACION.md` es del usuario: no va en los commits.
- Queda cerrada E10g. Sigue E12.

### E12 Ampliación: Semestre, materias, componentes y notas

- **M8** (`20261114120000_nova_semestre.sql`, respaldo previo en `respaldos/2026-11-14_160003`): `materias`, `cortes`, `componentes` y `notas` con RLS, FK compuestas por usuario y `ON DELETE CASCADE`; nombre de materia único por usuario sin distinguir mayúsculas (RB-05), créditos 1 a 10 (RB-06), porcentajes 1 a 10000, nota 0 a 500 o NULL (RB-09); `documentos.materia_id` opcional con FK compuesta y `SET NULL (materia_id)`. Las cuatro tablas, en la lista de respaldo antes de `documentos`. `db:verificar` sección 6m (cl a cy), sin fallas. Compatibilidad con master: `db:verificar` y `probar:rag` del código de master con 0 fallas. El parámetro `materia` de `buscar_fragmentos_usuario` queda para E13 (anotado en el plan 6.4).
- **Reglas** (`src/lib/reglas/notas.ts`): fracciones exactas con `bigint`; `mostrar` y `aprueba` (7.2), peso de cada nota P × p / N (7.3), nota actual, asegurado, peso pendiente, definitiva y estado (Aprobada, Reprobada, Aprueba, En riesgo, No alcanza; 7.4), máximo alcanzable (7.5, para "No alcanza"), avisos RB-07 y RB-08, RB-13, validaciones RB-05 a RB-10, plantilla al dividir y RB-35. Pruebas S-01 a S-12b con el ejemplo de 7.4 (3,7 actual, 2,5 asegurado, 4,1 máximo) y un peso de un tercio exacto.
- **Servicio y API** (`src/lib/datos/semestre.ts`): listar el árbol de materias, crear (con su corte único de 100 % y su categoría, RB-33), editar, eliminar; dividir en cortes con la plantilla de Configuración y quitar (RB-35); cortes en bloque; componentes y notas. Todo filtra por usuario; lo ajeno responde como inexistente.
- **Pantallas:** Semestre en la barra lateral y en "Más" (`GraduationCap`). `/nova/semestre` con la pestaña "Materias y notas": tarjetas con créditos, docente, cortes, componentes, notas calificadas y "Revisa los porcentajes" si algo no suma 100 %; "Nueva materia" en un diálogo. `/nova/semestre/[id]`: editar y eliminar (con confirmación) la materia; sin cortes, sus componentes, la "Fecha final de la materia" y "Dividir en cortes"; con cortes, el editor de cortes (nombre, porcentaje, fecha; agregar, quitar con aviso si tiene componentes, "Quitar cortes") y una tarjeta por corte con sus componentes. Cada componente con sus notas (nombre y fecha opcionales; "Sin nota (aún no la tengo)"), agregar, editar y eliminar con confirmación; los avisos RB-07 y RB-08 a la vista. La nota actual y la calculadora llegan en E13.
- **Pruebas:** `tests/reglas/notas.test.ts` (22), `tests/servidor/semestre.test.ts` (15), `tests/interfaz/semestre.test.tsx` (6), navegación con Semestre. En Edge (`ui_e12.mjs`, base real, dos usuarios temporales) 29 de 29: Semestre en "Más" y en la barra lateral, crear (RB-06, la categoría), componentes al 90 % con el aviso y sin él al corregir, componente repetido, nota 5,5 (RB-09), 3,75 con fecha y "sin nota" guardadas en la base, nombre repetido (RB-05), dividir (30/30/40 con los componentes en el Corte 1), cortes al 90 % con el aviso, RB-35, volver a sin cortes, la materia de otra persona (404 y "La materia no existe."), eliminar (se conserva la categoría), 390 px y 1280 px en oscuro sin desborde. Sin llamadas a Gemini salvo `probar:rag` de la compatibilidad con master.
- **Al cierre:** `npm test` 1165/1165, `tsc` y `eslint` sin errores, `npm run build` correcto.
- **Pendiente:** la prueba del usuario (B-24 a B-27).

#### E12 terminada (2026-11-14)

- **Prueba del usuario con `0baadd0` en la vista previa, en el iPhone y el PC, sin fallas (las 10):** crear materia con su categoría; créditos fuera de rango; nombre repetido; componentes con el aviso de la suma; notas (fuera de rango, con nombre y fecha, sin nota, editar y eliminar); dividir en cortes; cortes que no suman 100 %; volver a sin cortes conservando componentes y notas; eliminar la materia conservando la categoría; en el teléfono todo se toca bien, sin zoom ni desplazamiento lateral.
- Queda cerrada E12. Sigue E13.

### E13 Ampliación: Semestre, calculadora de notas

- **Sin migración.** `documentos.materia_id` ya venía de M8.
- **Reglas** (`src/lib/reglas/notas.ts`): "¿Cuánto necesito?" (7.5) con el umbral de la décima mostrada (menos 0,05 al redondear), x hacia arriba a la centésima y mostrada con un decimal hacia arriba; ya asegurado, imposible con el máximo alcanzable y la definitiva con W = 0; textos RB-12; meta RB-18; promedio del semestre por créditos (7.6); el peso pendiente en porcentaje. Pruebas S-13 a S-21 (`tests/reglas/notasCalculadora.test.ts`, 12).
- **Semestre:** arriba, el promedio del semestre (actual y asegurado, ponderados por créditos); cada tarjeta con su nota actual (o definitiva) y su estado (Aprueba, En riesgo, No alcanza, Aprobada, Reprobada; con ícono y texto) o `Aún no hay notas registradas.`. En la materia, la tarjeta "Calculadora": nota actual, asegurado, lo que falta por calificar, la nota de cada corte, el estado y "¿Cuánto necesito?" con "Nota meta" (por defecto la nota para aprobar de Configuración, no se guarda). Con porcentajes que no suman 100 %, solo la nota actual y la indicación. El redondeo y la nota para aprobar salen de Configuración.
- **Calendario (B-15):** los cortes con fecha (en una materia sin cortes, "Fecha final"), y las notas con fecha, en su día con el ícono de Semestre (`GraduationCap`), el conteo en el nombre del día y, en la lista del día, "Fechas de Semestre" con enlace a la materia. `eventosSemestre` en `src/lib/datos/semestre.ts`; `mesDeTareas` ya no devuelve eventos vacíos.
- **Fuentes (B-21):** "Materia (opcional)" al subir un PDF (solo si hay materias); al elegirla, la categoría es la materia y se guarda `materia_id` (una materia ajena responde como inexistente antes de leer el PDF). La lista de documentos muestra la materia con su ícono.
- **Pruebas:** reglas, `tests/interfaz/calculadora.test.tsx` (5), calendario con fechas de Semestre, SubidorPdf con materia, servidor (indexar con materia, eventos del Calendario). `npm run probar:semestre` (nuevo, base real, sin Gemini) 13 de 13: el ejemplo de 7.4 y 7.5 hecho a mano (3,7; 2,5; 1,4; 4,5; 4,1; 1,3 al redondear), 2,96 al truncar y al redondear, promedio por créditos, cortes, Calendario y documento con materia. En Edge (`ui_e13.mjs`) 23 de 23: promedio y tarjetas, calculadora con meta (también RB-18 y que no se guarda), redondear, porcentajes al 90 %, Calendario con su enlace, Fuentes con la materia, 390 px y 1280 px en oscuro sin desborde.
- **Al cierre:** `npm test` 1186/1186, `tsc` y `eslint` sin errores, `npm run build` correcto.
- **Pendiente:** la prueba del usuario (B-15, B-21, B-28 a B-31).

#### E13 terminada (2026-11-16)

- **Prueba del usuario con `413fa13` en la vista previa, en el iPhone y el PC, sin fallas (las 9):** el ejemplo del plan da 3,7 Aprueba, asegurado 2,5 y falta 32 %; "¿Cuánto necesito?" da 1,4 y 4,5, dice que el máximo es 4,1, rechaza una meta fuera de rango y no se guarda; el redondeo pasa de 2,9 Reprobada a 3,0 Aprobada; el promedio da 3,5 actual y 2,6 asegurado; con porcentajes que no suman 100 % solo la nota actual; cada corte con su nota o "Sin notas"; las fechas de Semestre en el Calendario enlazan a la materia; al subir un PDF con materia, la categoría es la materia y la lista la muestra; en el teléfono todo se toca bien, sin zoom ni desplazamiento lateral.
- Queda cerrada E13. Sigue E14.

### E14 Ampliación: fallas

- **M9** (`20261116100000_nova_fallas.sql`, respaldo previo en `respaldos/2026-11-16_152140`): `materias.fallas_limite` (opcional) y `fallas_registradas` (0 por defecto), enteros ≥ 0 (RB-15). Sin tablas nuevas (`materias` ya estaba en la lista de respaldo). `db:verificar` sección 6n (cz a dc), sin fallas. Compatibilidad con master: `db:verificar` y `probar:rag` del código de master con 0 fallas.
- **Reglas** (`src/lib/reglas/notas.ts`): `estadoFallas` (7.7), textos RB-14, `estadoConFallas` (perdida por fallas → "En riesgo" aunque las notas aprueben), `validarFallas` y `validarLimiteFallas` (RB-15). Pruebas S-22 a S-24 (`tests/reglas/fallas.test.ts`).
- **Servicio y API:** `guardarFallas` y `cambiarFallas` en `src/lib/datos/semestre.ts`; `PATCH` y `POST /api/nova/materias/[id]/fallas`.
- **Pantallas:** en la materia, la tarjeta "Fallas" con el conteo, los botones −1 y +1 (−1 desactivado en 0), el límite y las registradas editables y la alerta RB-14 (o la pérdida) a la vista; la Calculadora y la tarjeta de Semestre usan el estado con fallas; la tarjeta muestra "Fallas: r de l" y la alerta.
- **Pruebas:** reglas, servidor (guardar, +1 y −1, ruta), interfaz (alerta, +1, RB-15, pérdida con "En riesgo"). `npm run probar:semestre` ahora 16 de 16 (pasos 14 a 16, fallas en la base real). En Edge (`ui_e14.mjs`) 13 de 13: sin límite, RB-15, alerta a 2 y a 1, pérdida en el límite con "En riesgo" aunque la nota aprueba, la tarjeta de Semestre, −1, límite vacío, 390 px y 1280 px en oscuro sin desborde. Sin llamadas a Gemini salvo `probar:rag` de la compatibilidad con master.
- **Al cierre:** `npm test` 1196/1196, `tsc` y `eslint` sin errores, `npm run build` correcto.
- **Pendiente:** la prueba del usuario (B-32).

#### E14 terminada (2026-11-16)

- **Prueba del usuario con `e55602b` en la vista previa, en el iPhone y el PC, sin fallas (las 9):** sin límite no hay alerta; el límite −1 se rechaza (RB-15); avisa cuando quedan 2 y 1 fallas; en el límite dice "Perdiste la materia por fallas (5 de 5)." y la materia queda "En riesgo" aunque la nota apruebe; la tarjeta de Semestre muestra las fallas y la alerta; el −1 funciona; al quitar el límite vuelve al estado por notas; en el teléfono todo se toca bien, sin zoom ni desplazamiento lateral.
- **Plan (pedido del usuario):** la propuesta de E20b parte de `doc/DISENO_PRESENTACION.md` (detalles de su página de presentación). Lo de su sección 3 que cambia el comportamiento también va en E20b, salvo que el usuario pida algo antes. Anotado en `PROMPTS_AMPLIACION.md` (E20b) y en el plan (X17b).
- Queda cerrada E14. Sigue E15.

### E15 Ampliación: metas semanales en Productividad

- **M10** (`20261116110000_nova_metas_semanales.sql`, respaldo previo en `respaldos/2026-11-16_155040`): tabla `metas_semanales` con RLS, tipo `tareas` o `minutos`, categoría opcional (NULL = todas), objetivo > 0 (RB-16) e índice único por tipo y categoría sin mayúsculas (RB-17). Agregada a `scripts/tablas-respaldo.mjs`. `db:verificar` sección 6o (dd a dj), sin fallas. Compatibilidad con master: `db:verificar` y `probar:rag` del código de master con 0 fallas.
- **Reglas** (`src/lib/reglas/metasSemanales.ts`): `semanaActual` (Bogotá), `progresoMeta` (7.8: completadas con fecha de cierre en la semana; porcentaje truncado y tope de 100 %; "Cumplida"), `textoProgreso` ("7 de 10 tareas", "3 h 20 min de 5 h"), `tituloMeta`, `validarObjetivoTareas` y `validarObjetivoMinutos` (RB-16). Pruebas S-25 a S-28 (`tests/reglas/metasSemanales.test.ts`), con el borde del domingo a las 23:59 de Bogotá.
- **Servicio y API:** `src/lib/datos/metasSemanales.ts` (listar con el progreso calculado, crear con la categoría guardada del usuario, eliminar); `GET/POST /api/nova/metas` y `DELETE /api/nova/metas/[id]`. Categorías: renombrar renombra sus metas y eliminar elimina sus metas, en la misma transacción; la confirmación de eliminar una categoría dice cuántas metas se eliminan.
- **Pantalla:** en Productividad, debajo del índice del día (sin cambios), la tarjeta "Metas semanales": la semana, la explicación de que usan el día en que se completó la tarea y no la fecha límite, cada meta con su progreso, su porcentaje, su barra y "Cumplida", "Nueva meta" (tareas o tiempo en horas y minutos, todas las categorías o una) y "Eliminar" con confirmación.
- **Pruebas:** reglas, servidor (listar, crear, RB-16, RB-17, eliminar, rutas 401/403/400/409/422), interfaz (5) y categorías (renombrar y eliminar con metas). `npm run probar:metas` (nuevo, base real, sin Gemini) 6 de 6. En Edge (`ui_e15.mjs`) 13 de 13: sin metas, A-17 (día sin tareas) igual, RB-16, 5 tareas → 3 de 5, 3 h en Universidad → 3 h 20 min de 3 h y "Cumplida" (la de la semana pasada no cuenta), RB-17, eliminar con confirmación, 390 px y 1280 px en oscuro sin desborde. Corregido en la prueba: al volver a abrir "Nueva meta", el formulario empieza de nuevo en "Tareas completadas" y "Todas las categorías". Sin llamadas a Gemini salvo `probar:rag` de la compatibilidad con master.
- **Al cierre:** `npm test` 1214/1214, `eslint` sin errores, `npm run build` correcto. `tsc` solo da los 2 errores que ya había en `src/lib/__tests__/json-db.test.ts` (de septiembre, también en `e55602b`; no son de esta etapa).
- **Pendiente:** la prueba del usuario (B-33; A-17 sigue pasando).

#### E15 terminada (2026-11-16)

- **Prueba del usuario con `d629df2` en la vista previa, en el iPhone y el PC, sin fallas (las 10):** sin metas; objetivo 0 rechazado (RB-16); meta de tareas y de tiempo con el progreso de la semana; "Cumplida"; meta repetida (RB-17); eliminar con confirmación; renombrar y eliminar una categoría con meta; el índice del día sigue igual (A-17); en el teléfono todo se toca bien.
- El usuario está de acuerdo con que renombrar una categoría renombre sus metas y eliminarla las elimine.
- Queda cerrada E15. Sigue E16.
- **Plan (pedido del usuario, solución de su profesor):** nueva etapa E20c "Clave de Gemini propia y acceso de otras personas", después de E20b y antes de E21: X33, 5.14, M24 `claves_gemini` (6.20), M25 `accesos` (6.21, si se aprueba), 7.15 (cifrado AES-256-GCM con `NOVA_LLAVE_CLAVES`), RB-76 a RB-81, S-81 a S-84, B-87 a B-95, `probar:clave`, tres riesgos nuevos y la TAREA 7 de E21. Pasos de Google AI Studio y límites de Supabase, Vercel y Blob revisados en sus páginas oficiales el 2026-11-16. Quedan 5 decisiones del usuario, anotadas en el prompt de E20c.

### E16 Ampliación: metas de nota

- **M11** (`20261116120000_nova_metas_nota.sql`, respaldo previo en `respaldos/2026-11-16_163011`): tabla `metas_nota` con RLS, una meta por materia (corte NULL) y una por corte (`UNIQUE NULLS NOT DISTINCT`), de 0,1 a 5,0 (RB-18), FK compuestas al dueño y una FK `(corte_id, materia_id)` para que el corte sea de esa materia (con un `UNIQUE (id, materia_id)` nuevo en `cortes`). Agregada a `scripts/tablas-respaldo.mjs`. `db:verificar` sección 6p (dk a dr), sin fallas. Compatibilidad con master: `db:verificar` y `probar:rag` del código de master con 0 fallas.
- **Regla** (`src/lib/reglas/notas.ts`): `alcanzable` (7.9) sobre `cuantoNecesito`: alcanzable con la nota que hace falta, ya asegurada, no alcanzable con el máximo, cumplida o no con todo calificado, y sin poder decirlo si los porcentajes no suman 100 %. Para un corte, con su propio cálculo (`calcularCorte`).
- **Servicio y API:** `listarMetasNota`, `guardarMetaNota` (con la materia bloqueada; un corte de otra materia o en una materia sin cortes responde `CORTE_NO_ENCONTRADO`) y `quitarMetaNota` en `src/lib/datos/semestre.ts`; `quitarCortes` borra las metas de corte. `PUT/DELETE /api/nova/metas-nota`.
- **Pantallas:** pestañas de Semestre en `src/components/nova/semestre/pestanas.ts`; "Objetivos y plan" (`/nova/semestre/objetivos`) con una tarjeta por materia: la meta de la materia y, si tiene cortes, la de cada corte con su porcentaje y su fecha, si es alcanzable, "Definir meta" o "Cambiar" (con la respuesta mientras escribes) y "Eliminar" con confirmación. Sin cortes, la fecha final y la indicación para dividir. La calculadora de la materia empieza con la meta guardada de la materia.
- **Pruebas:** reglas (5), servidor (guardar, RB-18, cortes, aislamiento, quitar, quitar cortes, ruta), interfaz (4). `npm run probar:semestre` ahora 19 de 19 (pasos 17 a 19). En Edge (`ui_e16.mjs`) 13 de 13: la pestaña, RB-18, 4,5 no alcanzable y 4,0 alcanzable con 5,0 en el corte, guardar, la meta de la materia en la calculadora, cambiar, eliminar con confirmación, 390 px y 1280 px en oscuro sin desborde. Sin llamadas a Gemini salvo `probar:rag` de la compatibilidad con master.
- **Al cierre:** `npm test` 1232/1232, `eslint` sin errores, `npm run build` correcto; `tsc` solo con los 2 errores viejos de `json-db.test.ts`.
- **Pendiente:** la prueba del usuario (B-34).

#### E16 terminada (2026-11-16)

- **Prueba del usuario con `b2587ab` en la vista previa, en el iPhone y el PC, sin fallas (las 9):** la pestaña "Objetivos y plan"; la meta 5,5 rechazada (RB-18); la meta de corte con la respuesta antes de guardar (B-34), que coincide con la Calculadora; la meta de la materia en la Calculadora, sin guardarse al cambiarla ahí; cambiar y eliminar con confirmación; la materia sin cortes; quitar cortes conserva la meta de la materia; en el teléfono todo se toca bien.
- **Plan de E20c con las decisiones del usuario:** registro abierto con "Entrar con Google" (sin invitaciones) y una pestaña "Administración" solo para los administradores (cuentas sin claves, bloquear, eliminar con todos los datos, uso total con avisos al 80 % y 95 %, topes editables); M25 pasa a `cuentas` y `administracion`; 7.16 con el tope de **30 MB por persona** (500 − 20 del sistema − 80 de la cuenta del usuario − 100 de margen = 300 MB para 10 personas; base medida: 16,4 MB en total, 3 MB de datos del usuario); tope de cuentas 15; RB-81 a RB-86, S-85 a S-88, B-94 y B-96 a B-101. La cuenta del usuario sin clave propia sigue con la del proyecto; Claude guarda `NOVA_LLAVE_CLAVES` con `vercel env add`; 10 personas; si el espacio no alcanza, Supabase Pro (25 USD al mes, 8 GB). Revisada la pausa por inactividad de Supabase (riesgo bajo con el aviso de cada minuto; sigue la protección de E21). Encontrado: `cron.job_run_details` crece unos 7 MB al mes sin límite (4.249 filas en 3 días); E20c agrega su limpieza diaria.
- **Corrección del plan:** el commit `ff2b10e` había borrado por error los encabezados `## 6`, `## 7` y `## 8` de `PLAN_AMPLIACION.md` al insertar las secciones de E20c; quedaron restituidos.
- Queda cerrada E16. Sigue E17.

### E17 Ampliación: temas del corte

- **M12** (`20261116130000_nova_temas.sql`, respaldo previo en `respaldos/2026-11-16_172527`): tabla `temas` con RLS, FK compuesta a `cortes` (se borran con el corte o la materia), índice único por corte sin mayúsculas y un CHECK de coherencia (manual = confirmado y sin fuente; del asistente = con fuente). Agregada a `scripts/tablas-respaldo.mjs`. `db:verificar` sección 6q (ds a dy), sin fallas. Compatibilidad con master: `db:verificar` y `probar:rag` del código de master con 0 fallas.
- **Reglas** (`src/lib/reglas/temas.ts`): nombre de 1 a 200 caracteres, RB-19 (`corteConFechaFutura`), el periodo pedido (corte o materia), `validarTemasPropuestos` (fuente entregada, sin repetir ignorando mayúsculas y tildes, también con los que ya tiene el corte, como mucho 15). Prompt y esquema en `src/lib/llm/temas.ts`; el modelo recibe los temas que el corte ya tiene.
- **Servicio y API** (`src/lib/datos/temas.ts`): listar, crear (confirmado), editar o confirmar, eliminar o descartar, los PDF indexados de cada materia y `proponerTemas` (9.1: RB-19 y RB-21 antes de gastar cuota, 1 embedding, búsqueda de 6 fragmentos en el PDF elegido, 1 llamada JSON). Rutas en `/api/nova/cortes/[id]/temas`, `.../temas/proponer` y `/api/nova/temas/[id]`.
- **Pantalla:** en "Objetivos y plan", debajo de las metas de cada materia, "Temas" con un bloque por corte (o "Temas de la materia" sin cortes): cuántos confirmados, cada tema (los propuestos con "Propuesto", su fuente, "Confirmar" y "Descartar" con confirmación), "Editar", "Eliminar", "Nuevo tema" y "Proponer temas desde un PDF" con el PDF de la materia; sin PDF, RB-21 con el enlace a Fuentes.
- **Corregido en la prueba real:** el modelo proponía otra vez un tema escrito a mano con otras palabras; ahora recibe los temas que ya están, y la comparación ignora las tildes.
- **Pruebas:** reglas (7), servidor (9, con Gemini simulado), interfaz (5). `npm run probar:temas` (nuevo, Gemini real: 1 llamada por ejecución, dos ejecuciones) 9 de 9. En Edge (`ui_e17.mjs`, sin Gemini) 13 de 13: propuestos con su fuente que no cuentan, RB-21, confirmar, descartar con confirmación, agregar, repetido, editar, el selector del PDF, RB-19 desde la pantalla, 390 px y 1280 px en oscuro sin desborde.
- **Al cierre:** `npm test` 1252/1252 (una vez, `IndexacionPendiente` pasó su límite de 3 s por la carga de la máquina; sola y en la siguiente vuelta completa, sin fallas), `eslint` sin errores, `npm run build` correcto; `tsc` solo con los 2 errores viejos de `json-db.test.ts`.
- **Pendiente:** la prueba del usuario (B-35).

#### E17: ajuste pedido por el usuario (2026-11-17)

- **Prueba del usuario con `d695835` en la vista previa, en el iPhone y el PC (Cálculo con 3 cortes y Ética sin cortes), sin fallas (las 10).** Pidió un ajuste antes de cerrar: en "Objetivos y plan" las materias salían una encima de otra y la pantalla se hacía muy larga.
- **Una materia a la vez:** arriba, una fila de pestañas con el nombre de cada materia (`Pestanas` con la etiqueta "Materia"): en el teléfono se desliza de lado y la elegida queda a la vista; desde 1024 px las que no caben bajan a otra línea (`envolverEnComputador`), sin barra de desplazamiento. Debajo, solo las metas y los temas de la elegida. La materia va en `?materia=`, así Atrás vuelve a la anterior. Sin `?materia=`, la última abierta en este navegador (cookie `nova-materia`, de un año y solo para `/nova`; también la recuerda abrir una materia desde Semestre) o, si no hay, la más reciente (`materiaMasReciente`). Una materia ajena o borrada en la dirección no da error: se usa la siguiente opción (`elegirMateria` en `src/lib/reglas/materiaElegida.ts`, con su prueba). Con una sola materia, no hay fila.
- **Pruebas:** 1255/1255; `eslint` sin errores; build correcto. En Edge (`ui_e17b.mjs`) 12 de 12: la más reciente al entrar, cambiar con clic y con teclado (foco y Enter), Atrás, la recordada al volver, la recordada desde la página de la materia, una materia que no existe, 390 px sin desborde, y a 1280 px en oscuro 7 materias en dos líneas sin barra.

#### E17 terminada (2026-11-17)

- **Prueba del usuario del ajuste `8168d06` en la vista previa, en el iPhone y el PC, sin fallas:** una sola materia al entrar con la fila arriba, cambiar de materia, Atrás vuelve a la anterior, recuerda la última materia, la fila se desliza en el teléfono sin mover la página, en el PC pasa a dos líneas y funciona con el teclado, y se distingue bien en claro y oscuro. B-35 aceptada.
- Queda cerrada E17. Sigue E18.

#### Revisión del modo sin conexión (2026-11-17)

- **Lo que vio el usuario:** la app instalada en el iPhone, sin wifi, dijo que no se podía usar; más tarde, sin wifi, abrió bien con `Sin conexión · datos de las …`.
- **Causas revisadas:** (1) el iPhone a veces recarga la app en la última pantalla abierta (Semestre), que no tiene copia: sale `Necesitas conexión para esto.`; (2) una versión nueva no rompe la copia por sí sola; (3) **corregida** (`cefdde4`): el tope de 400 archivos guardados borraba primero los de React y Next, que no cambian entre versiones, y la copia de Inicio se quedaba sin ellos. Ahora el recorte no borra un archivo que pida una copia guardada y deja 50 de holgura. Prueba nueva en `tests/servidor/serviceWorker.test.ts` (falla sin la corrección).
- **Propuesta en el plan (5.10), sin código:** Semestre, la página de cada materia y "Objetivos y plan" sin conexión, de solo lectura; etapa sugerida E19b. Pendiente de la aprobación del usuario.

### E18 Ampliación: plan de estudio con el asistente

- **M13** (`20261117100000_nova_plan_estudio.sql`, respaldo previo en `respaldos/2026-11-18_004857`): `planes_estudio` (uno por corte), `versiones_plan` (numeradas, nunca se modifican) y `pasos_en_tareas` (para E19), con RLS. Agregadas a `scripts/tablas-respaldo.mjs`. `db:verificar` sección 6r (dz a eh), sin fallas; la primera vuelta mostró que el CHECK de `contenido` dejaba pasar un objeto sin `semanas` (NULL en un CHECK pasa): corregido en el archivo y en la base (la tabla estaba vacía). Compatibilidad con master: `db:verificar` y `probar:rag` del código de master con 0 fallas.
- **Reglas** (`src/lib/reglas/planEstudio.ts`): `validarPlanGenerado` (9.3, RB-22: esquema, temas confirmados, fuentes entregadas, fechas de hoy a la fecha del corte, de 1 a 60 pasos; ids del servidor; semanas de lunes a domingo), `validarPlanManual` (9.4), huella y `cambiosHuella` (RB-23), textos.
- **Servicio y API** (`src/lib/datos/planEstudio.ts`): `generarPlan` (RB-19 y RB-20 antes de gastar cuota; un pedido de embeddings; 2 fragmentos por tema entre los PDF de la materia; meta y nota actual; un reintento), `guardarVersionManual`, `restaurarVersion`, `obtenerPlan` y `planesDeMateria`. Rutas `GET /api/nova/cortes/[id]/plan` (`?version=`), `POST .../plan/generar` (`maxDuration` 120), `.../plan/versiones` y `.../plan/restaurar`.
- **Pantalla:** "Plan de estudio" en "Objetivos y plan", debajo de los temas, un bloque por corte (o "Plan de la materia"): por semanas y días, cada paso con su tema, sus minutos y sus citas; "Generar plan" / "Generar de nuevo", "Editar" (título, fecha, minutos, tema, quitar y agregar pasos), "Versiones (n)" con "Ver" y "Restaurar esta versión", y el aviso RB-23 con "Actualizar plan".
- **Corregido en la prueba real:** el modelo puso "T1, T2, T3" como tema de un repaso general y el plan se descartó dos veces (RB-22 funcionó); el prompt ahora pide un solo tema por paso y un paso de repaso por tema.
- **Pruebas:** reglas (14, con S-29 a S-32), servidor (13, con Gemini simulado), interfaz (5). `npm run probar:plan` (nuevo, Gemini real) 12 de 12 en la segunda vuelta: 10 pasos entre hoy y el corte, solo temas confirmados, citas del syllabus, los tres temas cubiertos, aviso tras una nota nueva, editar y restaurar. Llamadas al modelo: 3 en total (2 descartadas en la primera vuelta y 1). En Edge (`ui_e18.mjs`, sin Gemini: la versión del asistente se inserta en la base) 12 de 12: el plan por semanas y días con sus citas, editar con la validación antes de enviar, versión manual, aviso RB-23, ver y restaurar una versión, RB-19 y RB-20 desde la pantalla, 390 px y 1280 px en oscuro sin desborde.
- **Al cierre:** `npm test` 1288/1288, `eslint` sin errores (las 3 advertencias de siempre), `npm run build` correcto; `tsc` solo con los 2 errores viejos de `json-db.test.ts`.
- **Pendiente:** la prueba del usuario (B-36 a B-38).

#### E18 terminada (2026-11-18)

- **Prueba del usuario con `24448c2` en la vista previa, en el iPhone y el PC, sin fallas (las 7):** sin temas confirmados y sin fecha futura no genera; el plan por semanas y días con minutos, fuente, solo temas confirmados y fechas hasta el corte (B-36); el aviso de cambios y "Actualizar plan" con una versión nueva (B-37); editar rechaza 500 minutos y guarda una versión "editada a mano"; ver y restaurar versiones (B-38); "Plan de la materia" sin cortes; teléfono y modo oscuro.
- **Decisiones del usuario anotadas en el plan:** E19b "Semestre sin conexión" aprobada, después de E19 (X34, RB-87, S-89, B-102). E20b parte del prototipo `doc/PROTOTIPO_DISENO.html`, versión "Con el video" (decisión y ejemplos del video en `doc/DISENO_PRESENTACION.md`). E20c: "Administración" con el diseño del prototipo (tabla `acciones_admin` en M25, RB-88, RB-89, S-90, S-91, B-103 a B-105). La aceptación pasa a B-01 a B-105. El prototipo y `DISENO_PRESENTACION.md` entran al repositorio (sin datos reales: correos y clave de ejemplo).
- Queda cerrada E18. Sigue E19.

### E19 Ampliación: pasar pasos del plan a Tareas

- **Sin migración:** `pasos_en_tareas` ya venía en M13.
- **Servicio:** `pasarPasoATarea` en `src/lib/datos/planEstudio.ts`: con el plan bloqueado (`FOR UPDATE`), revisa RB-24, busca el paso en la versión vigente y, en la misma transacción, crea la tarea (título del paso, fecha límite = fecha del paso, categoría = nombre de la materia, prioridad 2) y la marca. Para eso, `src/lib/datos/tareas.ts` separa la validación y el insert de `crearTareaConResultado` y exporta `crearTareaEn(tx, …)`, con las mismas reglas del formulario (RB-33, RB-34, RB-43). Errores nuevos `PASO_NO_ENCONTRADO` (404) y `PASO_YA_EN_TAREAS` (409, `Este paso ya está en Tareas.`). Ruta `POST /api/nova/planes/[id]/pasos/[pasoId]/tarea`.
- **Pantalla:** cada paso del plan vigente tiene "Pasar a Tareas" (`PasarATareas`), que abre un diálogo con el título, la fecha límite, la categoría y la prioridad "Media", y pide confirmar. Un paso ya pasado dice "En Tareas" con el enlace a la tarea resaltada. Viendo una versión anterior no hay botón; si el servidor responde RB-24, el diálogo lo dice.
- **También:** `tests/interfaz/conexion.test.tsx` fallaba antes de las 10 de la mañana (esperaba "07:10" y la app muestra "7:10"); la prueba acepta ahora una o dos cifras en la hora.
- **Pruebas:** servidor (4 nuevas: la tarea con sus datos, RB-24 sin crear otra y la marca en una versión editada, un paso que ya no está o un plan ajeno, la ruta 201/409/400), interfaz (2 nuevas). En Edge (`ui_e19.mjs`, base real, sin Gemini) 13 de 13: el diálogo con sus datos, nada sin confirmar, la tarea pendiente con la fecha, la materia y prioridad 2, "En Tareas" con su enlace, RB-24, la tarea en Tareas, Inicio y Calendario, la marca en una versión editada, eliminar la tarea libera el paso, 390 px y 1280 px en oscuro sin desborde.
- **Al cierre:** `npm test` 1294/1294, `eslint` sin errores (las 3 advertencias de siempre), `npm run build` correcto; `tsc` solo con los 2 errores viejos de `json-db.test.ts`.
- **Pendiente:** la prueba del usuario (B-39).

#### E19 terminada (2026-11-18)

- **Prueba del usuario con `fa45e20` en la vista previa, en el iPhone y el PC, sin fallas (las 8):** el diálogo con título, fecha, categoría y prioridad Media, y Cancelar no crea nada; al confirmar el paso queda "En Tareas"; la tarea aparece resaltada en Tareas y también en Inicio y el Calendario; no se puede pasar dos veces (RB-24); se conserva al editar el plan; al eliminar la tarea se puede pasar otra vez; en una versión anterior no aparece el botón; teléfono y modo oscuro. B-39 aceptada.
- Queda cerrada E19. Sigue E19b.

### E19b Ampliación: Semestre sin conexión

- **Sin migración.** `paginaGuardable` (`public/sw-reglas.js`) y `rutaConCopia` (`src/lib/reglas/sinConexion.ts`) guardan "Materias y notas" (`/nova/semestre`), cada materia (`/nova/semestre/{uuid}`) y "Objetivos y plan" (con o sin `?materia=`, una copia por dirección); otras rutas de Semestre no.
- **Sin conexión:** se ven con `Sin conexión · datos de las {HH:MM}`; los enlaces entre ellas abren la copia; la Calculadora sigue funcionando (`data-sin-conexion="permitido"`, calcula solo en el navegador); registrar notas o fallas, cambiar componentes, cortes, metas o temas, proponer temas, generar o editar el plan y "Pasar a Tareas" dicen `Necesitas conexión para esto.` (el bloqueo general de RB-62). Una materia nunca abierta con conexión dice `Esta pantalla aún no está disponible sin conexión.`; una pantalla que no se guarda, el texto nuevo de RB-87: `Esta pantalla necesita conexión. Sin conexión puedes ver Inicio, Tareas, el Calendario y Semestre.`
- **Pruebas:** reglas (las rutas de Semestre en S-68: guardables y que no, y que el navegador y el service worker coinciden), service worker (2 nuevas, S-89: las copias por materia y por `?materia=`, la materia sin copia y el texto de RB-87), atenuado = bloqueado (los enlaces de Semestre, la Calculadora, "Definir meta" y "Pasar a Tareas"). En Edge (`ui_e19b.mjs`, con el service worker de verdad, el modo sin conexión y el servidor apagado) 12 de 12: las tres pantallas guardadas, cada una sin conexión con su aviso y sus datos, abrir la materia desde la lista, la Calculadora, "Editar materia" y "Pasar a Tareas" bloqueados, la materia nunca abierta, la pantalla sin copia con RB-87, 390 px sin desborde.
- **Al cierre:** `npm test` 1309/1309, `eslint` sin errores (las 3 advertencias de siempre), `npm run build` correcto; `tsc` solo con los 2 errores viejos de `json-db.test.ts`.
- **Pendiente:** la prueba del usuario en el iPhone con la app instalada, en modo avión (B-102).

#### E19b terminada (2026-11-18)

- **Prueba del usuario con `a511397` en el iPhone (app instalada), sin fallas (las 9):** las copias se guardan al abrir las pantallas con conexión; sin conexión se ven Materias y notas, la materia y Objetivos y plan con el aviso de la hora; la Calculadora funciona; lo que escribe datos dice `Necesitas conexión para esto.`; la materia nunca abierta dice que aún no está disponible; Productividad muestra el texto de RB-87; al volver la conexión todo se recarga y funciona. B-102 aceptada.
- Queda cerrada E19b. Sigue E20.

### E20 Ampliación: Estadísticas

- **Sin migración.** Reglas en `src/lib/reglas/estadisticas.ts` (`calcularEstadisticas`, con las mismas reglas que "Materias y notas": nota de cada corte y de la materia en décimas con el redondeo de Configuración, estado de 7.4 con las fallas de 7.7, riesgo por nota o por fallas con su texto, ordenado de la más grave a la menos grave, y el promedio de 7.6). Servicio `estadisticasSemestre` en `src/lib/datos/estadisticas.ts` y `GET /api/nova/estadisticas`.
- **Pantalla:** `/nova/semestre/estadisticas`, la tercera pestaña de Semestre (`pestanasSemestre('estadisticas')`), con `GraficosEstadisticas.tsx`: resumen, materias en riesgo con su enlace, comparación entre materias (barras con la marca de aprobar) y evolución por corte (un gráfico SVG por materia con cortes). Una serie por gráfico con el color de acento; título, descripción, valor de cada marca y tabla equivalente plegable (permitida sin conexión). Se puede ver sin conexión: `/nova/semestre/estadisticas` entra en `paginaGuardable` y `rutaConCopia`.
- **Encontrado y corregido en Edge: al llegar a Estadísticas desde otra pestaña de Semestre, a veces la pantalla no cambiaba.** Solo con la build de producción (con `next dev`, 5 de 5) y con la pantalla completa: el navegador recibía la respuesta entera (200, sin errores ni filas faltantes) y el router de Next 15.5 nunca la aplicaba. Medido con 5 intentos por variante: la pantalla completa, 0 a 3 de 5; cada bloque solo, o dos bloques con las pestañas, o todo sin la fila de pestañas, 5 de 5; "Objetivos y plan", siempre 5 de 5. No era el service worker (sin él, 1 de 5), ni la precarga de los enlaces, ni la pestaña cortada al borde (con las tres pestañas a la vista, 4 de 5), ni la dirección (la misma página en otra ruta también fallaba), ni `NuevaMateria`, ni un script pendiente. **Corrección:** el contenido (los datos y los gráficos) va en su propio `<Suspense>` con "Calculando tus estadísticas…", y el encabezado y las pestañas llegan primero: 10 de 10 con `router.push` y 5 de 5 tocando la pestaña, como en el teléfono. No se encontró la causa dentro de Next; no hay un reporte que coincida exactamente.
- **También:** el texto "Sin notas" de un corte vacío quedaba encima de la línea punteada de aprobar: bajó. `tests/servidor/planEstudio.test.ts` (E18) dependía de la fecha en que se escribió (las rutas usan la fecha real y los pasos del 18 de noviembre ya habían pasado): ahora fija la fecha de la prueba.
- **Edge** (`ui_e20.mjs`, base real, sin Gemini) 13 de 13: la pestaña y el toque que la abre, el resumen, las materias en riesgo (por fallas y por nota, la más grave primero), la comparación con el valor de cada barra, la evolución con el corte vacío, las materias sin cortes, las tablas equivalentes, el enlace a la materia, la API, 390 px y 1280 px en oscuro sin desborde.
- **Al cierre:** `npm test` 1322/1322, `eslint` sin errores (las 3 advertencias de siempre), `npm run build` correcto; `tsc` solo con los 2 errores viejos de `json-db.test.ts`.
- **Pruebas:** reglas (5), servidor (2: la ruta con los datos del usuario y 401), interfaz (5: resumen, riesgo con sus motivos y enlace, sin riesgo, comparación con su tabla, evolución con su descripción y el corte vacío), y las de sin conexión con la ruta nueva.
- **Pendiente:** la prueba del usuario (B-40).

#### E20: ajustes tras la prueba del usuario (2026-11-21)

- **Prueba del usuario:** pasaron la 1 a la 6 y la 8. Pidió cuatro cosas; la 3 (un estado "Perdida") queda en propuesta, esperando su respuesta.
- **1. Arranque en negro en el iPhone (app instalada).** Las 26 imágenes de E11b seguían en `public/icons/arranque/` y con los tamaños correctos, pero Next 15.5 manda el `metadata` al final del cuerpo (streaming metadata, desde 15.2), no al `<head>`, y desde `appleWebApp` ya no escribe `apple-mobile-web-app-capable` (solo `mobile-web-app-capable`). **Corrección:** `EtiquetasIphone` en `src/app/layout.tsx` las escribe en el `<head>` real (capable, título, barra, ícono y las imágenes); `metadata` ya no lleva `appleWebApp` ni `icons` (si no, saldrían repetidas al final). Además, un tamaño nuevo: 320×693 a 3x (los iPhone de 6,1" con la vista ampliada). Comprobado en `next start`: 28 etiquetas, todas en el `<head>`. iOS guarda las imágenes al agregar a inicio: hay que quitar la app y volver a agregarla.
- **2. Fallas: al llegar al límite se seguían sumando.** `puedeSumarFalla`, `textoLimiteFallas` y `validarFallasConLimite` en `src/lib/reglas/notas.ts`. En el servidor, la condición va en el mismo `UPDATE` (dos toques seguidos no la saltan): `cambiarFallas` con +1 en el límite responde 409 `LIMITE_FALLAS` ("Llegaste al límite de fallas de esta materia: no puedes sumar más."); `guardarFallas` (a mano) no deja las registradas por encima del límite, con los valores que quedarían: 422 `FALLAS_SOBRE_LIMITE` ("Las fallas registradas no pueden pasar del límite."). En la tarjeta, el "+" queda desactivado con "Llegaste al límite de fallas: ya no puedes sumar más. Si te equivocaste, usa "−"." (`aria-describedby`); el "−" sigue. Sin límite, se suma siempre.
- **4. Sin conexión, Semestre sin "Estadísticas" y "Objetivos y plan" sin abrir.** El cambio de E20 en las reglas solo agregó `/estadisticas` (`sinConexion.ts` y `sw-reglas.js` coinciden y E19b sigue igual): en Edge, con un service worker nuevo, todo funcionaba (14 de 14). La causa probable en el iPhone: E20 solo cambió `sw-reglas.js` y `sw.js` quedó idéntico, y un navegador que no compara los scripts importados se queda con el service worker anterior y sus copias viejas (la de Materias y notas, de antes de E20, sin la pestaña). **Corrección:** `sw.js` importa `/sw-reglas.js?v=<huella>` (sha256 de las reglas, 12 caracteres), así cada cambio de las reglas cambia `sw.js`; y al guardar una pestaña de Semestre el service worker guarda también las otras dos (`PESTANAS_SEMESTRE` y `pestanasHermanas`, sin encadenar más), para que sin conexión se pueda llegar a todas tocando la fila aunque con conexión solo se haya abierto una.
- **Pruebas nuevas:** `tests/reglas/swVersion.test.ts` (la huella de `sw.js` coincide con `sw-reglas.js`; las pestañas del service worker son las de `pestanasSemestre`; cada una con copia en las dos reglas; las hermanas), en `sinConexionEstilo.test.ts` las tres pestañas tal como se dibujan, sin atenuar ni bloquear; fallas en servidor (2) e interfaz (2); en `arranque.test.ts`, las etiquetas en el `<head>` del layout. Las sentencias nuevas de fallas se ejecutaron en la base real con un id inexistente (0 filas).
- **Edge** (`ui_e20sin.mjs`, base real) 16 de 16: con conexión tocando las pestañas, las tres copias; sin las copias de Objetivos y Estadísticas, abrir solo Materias y notas las vuelve a guardar; sin conexión desde Inicio, las tres pestañas visibles y cada una abre su copia.
- **Al cierre:** `npm test` 1334/1334, `eslint` sin errores (las 3 advertencias de siempre), `npm run build` correcto; `tsc` solo con los 2 errores viejos de `json-db.test.ts`.
- **Pendiente:** la respuesta del usuario a la propuesta del estado "Perdida" y su nueva prueba (arranque reinstalando la app, fallas, sin conexión).

#### E20: estado "Perdida" (2026-11-21, decisión del usuario)

- **Decisiones del usuario:** el nombre "Perdida", en rojo lleno con texto claro y un ícono; "Reprobada" se queda aparte, con el mismo color; se pierde por fallas al **llegar** al límite (como estaba); "Fallas registradas" no guarda más que el límite. La materia que vio "En riesgo" siendo perdida era la de fallas al límite.
- **Reglas** (`src/lib/reglas/notas.ts`): `Estado` cambia "No alcanza" por "Perdida" (aún falta calificar y ni con 5,0 en lo que falta se aprueba). `estadoConFallas`: con las fallas en el límite, "Perdida" aunque las notas aprueben (también "Aprobada" o sin notas); "Reprobada" se conserva. "En riesgo" queda para lo que aún se puede salvar.
- **Insignia** (`estadoMateria.tsx`): "Perdida" (ícono `Ban`) y "Reprobada" con `bg-peligro` y `text-acento-texto`, el par del botón de peligro que ya vigila `contraste.test.ts`: blanco sobre rojo en claro; en oscuro el rojo es claro y el texto, oscuro (con blanco no llegaba a 4,5:1). Se ve en "Materias y notas", en la materia (Calculadora) y en Estadísticas.
- **Estadísticas** (`src/lib/reglas/estadisticas.ts`): la lista se llama "Materias perdidas y en riesgo"; primero las perdidas por fallas, luego las demás perdidas y reprobadas, luego en riesgo y alertas. Motivos: "Perdida por fallas: 4 de 4." y "Perdida por nota: aunque saques 5,0 en lo que falta, llegas a 1,8 y necesitas 3,0." (el máximo con el redondeo de Configuración). La tarjeta del resumen: "Perdidas y en riesgo", con "1 perdida · 2 en riesgo" (`textoEnRiesgo(perdidas, enRiesgo)`; las reprobadas cuentan como perdidas, `esPerdida`).
- **Edge** (`ui_e20p.mjs`, base real) 13 de 13 en claro y oscuro: Materias y notas con dos "Perdida", una "Reprobada" del mismo rojo y una "En riesgo"; la materia perdida por fallas; el orden y los motivos en Estadísticas; 390 px sin desborde.
- **Al cierre:** `npm test` 1335/1335, `eslint` sin errores (las 3 advertencias de siempre), `npm run build` correcto; `tsc` solo con los 2 errores viejos de `json-db.test.ts`.
- **Pendiente:** la prueba del usuario de todos los ajustes de E20.

#### E20 terminada (2026-11-21)

- **Prueba del usuario** (iPhone con la app reinstalada y PC): bien el logo de Nova al abrir la app, las fallas en el límite (el "+" desactivado) con "Perdida", "Perdida" por nota y "Reprobada" del mismo rojo, el orden y los motivos en "Materias perdidas y en riesgo", el modo oscuro y Semestre sin conexión con sus tres pestañas. Pruebas 1 a 8 de B-40 sin fallas.
- Sigue **E20b Diseño final**: primero la propuesta sin código, a partir de `doc/PROTOTIPO_DISENO.html` ("Con el video") y `doc/DISENO_PRESENTACION.md`, y la aprobación del usuario.

### E20b Ampliación: Diseño final

#### Propuesta y decisiones (2026-11-21)

- **Propuesta sin código** a partir del prototipo "Con el video" (artifact privado del usuario), con capturas de una copia del prototipo ajustada a la navegación de Nova. **Logo:** el usuario pidió antes un logo nuevo, la "Estrella nova"; se hicieron tres variantes (artifact privado) y eligió la **A (Halo)** tal cual, con la versión pequeña para el favicon y la estrella en lugar del punto brasa dentro de la app.
- **Respuestas del usuario:** aprueba la propuesta; la barra inferior queda como hoy (Inicio, Calendario, Asistente, Tareas y Más); sin librería de animación; entran los seis cambios de comportamiento de `DISENO_PRESENTACION.md` (la respuesta palabra por palabra al final del commit del Asistente; si complica el respaldo entre modelos o las respuestas exactas del servidor, queda fuera y se avisa); la entrada es de noche también en modo claro; bajar el tiempo de carga como último commit, medido antes y después. En cada commit se revisa lo de sin conexión (pestañas, copias de Semestre, el "+" y lo atenuado). Un commit a la vez, con su prueba en el teléfono y el PC.

#### Commit 1: base y navegación (2026-11-21)

- **Tokens y letras:** paleta "noche de estudio" en claro y oscuro (`globals.css`, `COLOR_FONDO` en `src/lib/tema.ts`, la página sin conexión de `sw.js`), tokens de la estrella, los anillos, el halo y el cristal; Bricolage Grotesque, Instrument Sans y JetBrains Mono con `next/font` (las tres son variables: con pesos fijos `next/font` fallaba en el build). `contraste.test.ts` pasa en los dos modos.
- **Logo:** `EstrellaNova` y `LogoNova` en `src/components/nova/marca/EstrellaNova.tsx` (colores de los tokens, halo `nova-halo`), en la barra lateral, el menú "Más" y la tarjeta de acceso. Íconos nuevos (192, 512, maskable con el dibujo dentro de la zona segura, apple-touch-icon 180), `favicon-16/32.png` con la versión pequeña (enlazados en el `<head>`) y las 28 pantallas de arranque con la estrella y "nova" en Bricolage Grotesque 800, en claro y oscuro (generadas en Edge desde SVG). **Hay que quitar la app del iPhone y volver a agregarla** para ver el ícono y el arranque nuevos.
- **Navegación:** barra lateral de cristal flotante, plegable a solo íconos (`--nova-ancho-lateral`, `data-lateral` en `<html>` puesto por `SCRIPT_TEMA` antes de pintar, `nova-lateral` en el navegador), con el perfil (nombre de Configuración o el correo), Semestre con su submenú (Materias y notas, Objetivos y plan, Estadísticas), una tarjeta de aviso (tareas vencidas o el próximo corte; se oculta con menos de 760 px de alto) y "Cerrar sesión". Barra inferior flotante de cristal con el Asistente al centro con el halo y un globo con las vencidas en Tareas. Menú "Más" de cristal casi a pantalla completa, con letras grandes, la actual marcada con guion y punto, y "03 / 04". Píldora que se desliza a la opción activa (`usePildora` en `src/components/ui/usePildora.ts`), en las dos barras y en `Pestanas`; la última posición se recuerda por fila, así también se desliza entre las pestañas de Semestre, que son páginas distintas.
- **Avisos:** `GET /api/nova/avisos` (`avisosNavegacion` en `src/lib/datos/avisos.ts`: nombre, vencidas y próximo corte, tres consultas en paralelo) y las reglas en `src/lib/reglas/avisos.ts`. `ProveedorAvisos` los pide al abrir Nova y un segundo después de cada cambio de pantalla; sin conexión no pide nada y, si falla, la navegación sigue sin globo ni aviso.
- **Vida:** los bloques de cada pantalla entran escalonados (`nova-entrada` en el `<main>` del layout), `Tarjeta` con radio de 20 px, `Boton` se hunde un poco al tocarlo y el secundario toma borde brasa al pasar el puntero, títulos en Bricolage Grotesque. Todo CSS; con "reducir movimiento", la regla global deja las animaciones en 0,01 ms.
- **Sin conexión:** los botones que solo cambian cómo se ve el menú (plegar, mostrar el submenú, abrir y cerrar "Más") llevan `data-sin-conexion="permitido"`; los enlaces nuevos van a pantallas que ya tenían copia. Edge: `ui_e20sin.mjs` 16 de 16 (pestañas y copias de Semestre), `ui_e19b.mjs` 12 de 12 (Semestre, la Calculadora y lo bloqueado) y `ui_e11e.mjs` 34 de 34 (el "+" y las tareas creadas sin conexión). En `ui_e11e.mjs`, tras volver la conexión, la lista tarda unos 6 s en mostrar las tareas enviadas, porque el servidor de prueba se acaba de reiniciar; el script ahora espera hasta 15 s, y su servidor usa la conexión directa a la base, como los demás.
- **Pruebas nuevas:** `tests/reglas/avisos.test.ts`, `tests/servidor/avisos.test.ts` y `tests/interfaz/navegacionNueva.test.tsx` (perfil, globo, aviso, submenú, plegar, "Más" con su posición y lo permitido sin conexión); el favicon en `arranque.test.ts`. Edge (`ui_e20b1.mjs`) 19 de 19: barra lateral desplegada y plegada (recordada al recargar), globo y aviso, letras, píldora en Tareas y entre pestañas de Semestre, barra inferior flotante con el "+" encima, menú "Más", "reducir movimiento", íconos públicos y la API, 390 y 1280 px en claro y oscuro sin desborde.
- **Al cierre:** `npm test` 1348/1348, `eslint` sin errores (las 3 advertencias de siempre), `npm run build` correcto; `tsc` solo con los 2 errores viejos de `json-db.test.ts`.
- **Prueba del usuario (2026-11-21):** en el iPhone (app reinstalada) y el PC, todo bien: el ícono y el arranque con la estrella, la barra inferior con la píldora y el globo, el menú "Más", las pestañas de Semestre, sin conexión, "reducir movimiento", la barra lateral plegable, el favicon y las letras. Pidió para el commit 2: más espacio al final de cada pantalla en el teléfono (el "+" y la barra tapaban lo último) y un ejemplo más corto en "Pregúntale a Nova" (se cortaba a 390 px).

#### Commit 2: Inicio (2026-11-21)

- **Mosaico:** arriba el saludo según la hora de Bogotá con el primer nombre del perfil ("Buenas tardes, Valentina."), la fecha con la semana ISO ("Sábado 21 de noviembre · semana 47") y un resumen corto del día; "Pregúntale a Nova" en una sola fila (el botón es solo el ícono hasta 640 px, con "Preguntar" para lectores de pantalla) y el ejemplo "¿Qué tengo esta semana?", que cabe a 390 px; cuatro tarjetas con números que cuentan y enlazan (tareas de hoy, vencidas con la más antigua, tiempo de la semana con barras por día y la diferencia con la semana pasada hasta el mismo día, y promedio con el asegurado y la marca de aprobar); Mi semana a lo ancho; el progreso, las prioridades de hoy y el **próximo corte** con lo que necesitas para la meta de la materia (o para aprobar; sin texto si los porcentajes no suman 100 %).
- **Cambios de comportamiento de la presentación (2 de 6):** "Faltan N", "Falta 1" o "Semana completa" bajo el anillo, y la casilla de cada tarea con el color de su categoría (borde, y relleno al completarla; `CASILLA_COLOR` en `InsigniaCategoria.tsx`), también en Prioridades de hoy y el Calendario.
- **Vida:** `Contador` (`src/components/ui/Contador.tsx`) cuenta hasta el valor en 0,8 s; el HTML del servidor trae el valor final y el número que se mueve va oculto para lectores de pantalla; el anillo se llena al aparecer (`nova-anillo`). Con "reducir movimiento", nada se mueve.
- **Datos:** `resumenInicio` en `src/lib/datos/inicio.ts` (el nombre, las tareas de hoy, la vencida más antigua, los minutos de esta semana y la pasada por `fecha_cierre`, el promedio y el próximo corte con `cuantoNecesito` y la meta de `metas_nota`); reglas en `src/lib/reglas/inicio.ts`.
- **Espacio al final (pedido del usuario):** el `<main>` deja `12rem` más el área segura abajo en el teléfono (antes `10rem`); en Edge a 390 px, al bajar del todo en Inicio, Tareas, Semestre, Calendario y Configuración, lo último queda 48 px por encima del "+" y de la barra (antes 16).
- **Pruebas nuevas:** `tests/reglas/inicio.test.ts` (saludo, semana ISO, fecha, resumen, tarjetas y "Faltan N"), `tests/servidor/inicio.test.ts` y en `tests/interfaz/inicio.test.tsx` la casilla de color, el ejemplo corto, el saludo, las tarjetas y el próximo corte. Edge (`ui_e20b2.mjs`) 23 de 23: el espacio al final en cinco pantallas, el saludo, el resumen, las cuatro tarjetas con sus textos, "Faltan N", el próximo corte, la casilla de color, el ejemplo que cabe, los números que cuentan, "reducir movimiento", 390 y 1280 px en claro y oscuro sin desborde. Sin conexión: `ui_e20sin.mjs` 16 de 16, `ui_e19b.mjs` 12 de 12 y `ui_e11e.mjs` 34 de 34.
- **Al cierre:** `npm test` 1362/1362, `eslint` sin errores (las 3 advertencias de siempre), `npm run build` correcto; `tsc` solo con los 2 errores viejos de `json-db.test.ts`.
- **Prueba del usuario (2026-11-21):** en el iPhone y el PC todo bien, con dos detalles en Mi semana, corregidos en el mismo commit 2 (segunda parte):
  - **Error:** al pasar a otra semana con las flechas, la lista del teléfono seguía en el día de hoy, que no era de esa semana, y ningún día quedaba marcado (el componente sigue montado al cambiar `?semana=` y el día elegido solo se calculaba al montar). Ahora, al llegar a otra semana se elige una vez el día inicial con `diaInicialSemana` (`src/lib/reglas/semana.ts`): hoy en la semana actual; en otra, el primer día con tareas (contando las creadas sin conexión) o el lunes. "Esta semana" vuelve a hoy.
  - **Mejora:** el punto bajo cada día muestra los colores de las categorías de sus tareas, sin repetir y hasta 3 (`coloresDelDia`, `MAX_PUNTOS_DIA`), como en el Calendario; en el día elegido llevan un aro claro para verse sobre el acento.
  - **Pruebas:** en `tests/reglas/inicio.test.ts` las dos reglas; en `tests/interfaz/inicio.test.tsx` el cambio de semana sin desmontar (primer día con tareas, lunes, la misma semana conserva lo elegido y la vuelta a hoy) y los puntos. Edge (`ui_e20b2b.mjs`) 9 de 9 cargando cada semana por su dirección: en Edge sin ventana el cambio sin recargar no se aplica, tampoco con el código anterior, así que ese paso lo cubre la prueba de interfaz. Sin conexión: `ui_e11e.mjs` 34 de 34. `npm test` 1366/1366, `eslint` sin errores, build correcto.
- **Pendiente:** la prueba del usuario de la segunda parte del commit 2 (va junto con la del commit 3).

#### Commit 3: Tareas (2026-11-21)

- **Celebración al completar:** al confirmar los minutos (en Tareas o con la casilla de Inicio y el Calendario), un aviso de cristal abajo con un check que se dibuja, seis destellos y "¡Tarea completada!" con el título y el tiempo ("Taller de cálculo · 30 min"); se va solo a los 2,8 s. Vive en el layout de Nova (`Celebracion`, `src/components/nova/Celebracion.tsx`) y escucha el evento de `celebrar()` (`src/lib/celebracion.ts`), así no desaparece cuando la fila cambia de lugar con `router.refresh()`; solo se celebra si el servidor confirmó. En el teléfono queda sobre el "+" y la barra; en el PC, abajo y centrado en el contenido. Región `status` siempre montada para los lectores de pantalla.
- **Lista:** "Completada · 45 min" en la insignia de estado (ya no hay fila "Dedicado" ni línea aparte en la tabla); el título de una completada atenuado; en el teléfono, cada tarjeta con radio de 20 px y el borde izquierdo del color de su categoría (`BORDE_COLOR` en `InsigniaCategoria.tsx`); en el PC, las filas se resaltan al pasar el puntero; cada grupo con una barra fina de avance del color de la categoría que se llena al aparecer (`nova-avance`). Las insignias de prioridad ya tenían color (Alta roja, Media amarilla).
- **Vacíos amables:** `EstadoVacio` acepta un ícono (círculo suave); cada vista de Tareas tiene el suyo y una línea amable (`descripcionVacio` en `src/lib/reglas/vistasTareas.ts`), por ejemplo "Hoy no vence nada. Buen momento para adelantar algo." y, en vencidas, el confeti con "Vas al día con tus fechas límite.".
- **Botón con estados:** `Boton` tiene `listo` y `textoListo`: "Guardar tarea" pasa por girando y termina en "Guardada" con un check que se dibuja (o "Cambios guardados" al editar), desactivado mientras vuelve a la pantalla anterior; también al guardarla sin conexión.
- **"Reducir movimiento":** la regla global ahora también quita las esperas de las animaciones (`animation-delay: 0s`): la celebración aparece quieta, con el check completo y sin destellos.
- **Pruebas nuevas:** `tests/interfaz/tareasE20b.test.tsx` (la celebración y que solo se celebre lo confirmado, la insignia con el tiempo, la barra de avance y el borde, el vacío con ícono, el botón listo) y los textos en `tests/reglas/inicio.test.ts`. Edge (`ui_e20b3.mjs`) 18 de 18: insignia con el tiempo, bordes de color (los demás neutros), barras 50 % y 0 %, completar desde una tarjeta con la celebración en su lugar y que se va sola, el vacío de vencidas con ícono, "Guardada" con el check y la tarea en la base, 390 y 1280 px en claro y oscuro sin desborde, la celebración en el PC y con "reducir movimiento". En Edge sin ventana la navegación de Next sin recarga no se aplica (tampoco con el código anterior); la vuelta a Tareas tras guardar se prueba en el teléfono. Sin conexión: `ui_e20sin.mjs` 16 de 16, `ui_e19b.mjs` 12 de 12 y `ui_e11e.mjs` 34 de 34.
- **Al cierre:** `npm test` 1374/1374, `eslint` sin errores (las 3 advertencias de siempre), `npm run build` correcto; `tsc` solo con los 2 errores viejos de `json-db.test.ts`.
- **Prueba del usuario (2026-11-21):** en el iPhone y el PC, todo bien (también la segunda parte del commit 2: el cambio de semana y los puntos de color). Reportó que cambiar de pestaña tarda 2 a 3 s, sobre todo justo después de un despliegue.

#### Medida del tiempo al cambiar de pestaña (2026-11-21)

- **Cómo:** despliegues de prueba en Vercel (sin `.git` ni `.env`, con el usuario temporal como administrador solo en ese despliegue, borrados al final) del código actual y de `92e59f4` (fin de E20), con Edge desde Colombia y el secreto de omisión de la protección de Vercel.
- **Resultado:** las dos versiones iguales: ~0,3 s por pantalla con la función caliente y 0,7 a 1,2 s la primera vez tras desplegar (todas las pantallas están en la misma función de 3,11 MB). De ~0,3 s, ~0,22 s son el viaje a Vercel (una página casi vacía ya tarda eso) y la sesión y la base solo 20 a 70 ms. E20b sumó 10 a 25 ms; las letras pasaron de 47 a 109 KB solo en la primera carga. La cuenta del usuario tiene pocos datos (3 tareas, 3 materias). En Vercel la navegación sin recarga sí funciona en Edge sin ventana (lo que no terminaba era el servidor local).
- **Decisión del usuario:** adelantar el commit 11 (tiempo de carga) antes del Calendario.

#### Commit 11 adelantado: tiempo de carga (2026-11-21)

- **Sesión una sola vez, y sin viaje:** el middleware y `obtenerSesion` usan `supabase.auth.getClaims()`, que verifica el token con la clave pública del proyecto (ES256, en el JWKS de Supabase) sin preguntar a Supabase Auth en cada pedido; si el token venció, lo renueva con el de refresco como antes. Con una clave simétrica la librería volvería a preguntar a Supabase. Consecuencia: una sesión cerrada en otro dispositivo vale hasta que venza su token (máximo 1 hora); cerrar sesión en el mismo dispositivo sigue siendo inmediato.
- **Consultas a la vez:** Inicio pide la semana, las categorías y el resumen en paralelo (el resumen solo necesita la fecha de hoy); Tareas, las categorías y las tareas (el filtro de categoría ya compara sin mayúsculas en la base); `listarMaterias` hace sus cuatro consultas a la vez, filtrando cortes, componentes y notas por usuario y materia.
- **Volver es inmediato:** `experimental.staleTimes.dynamic = 30` en `next.config.ts`: una pantalla vista en los últimos 30 s se muestra sin pedirla. Todo lo que guarda llama a `router.refresh()`, que vacía esa memoria; se agregó en las tres pantallas que no lo hacían (tarea de repaso, "Guardar fuente" y crear cuestionario). Probado: completar una vencida y volver a Inicio muestra 0.
- **Animaciones más cortas (pedido del usuario):** entrada de los bloques 0,2 s con 20 ms entre uno y otro (antes 0,3 s y 40 ms), números que cuentan 0,45 s (antes 0,8 s), el anillo 0,55 s sin espera (antes 0,9 s tras 0,15 s), la barra de los grupos de Tareas 0,45 s sin espera.
- **Barra de herramientas de Vercel:** solo aparece a quien inició sesión en Vercel (no en los pedidos con el secreto de omisión, así que no se pudo medir directo). Su script pesa 23 KB comprimido (76 KB sin comprimir) y abre un marco a vercel.live; se carga al abrir la app o recargar, no en cada cambio de pestaña. Se apaga en Vercel → proyecto → Settings → General → Vercel Toolbar → "Pre-Production Deployments: Off", o con la variable `VERCEL_PREVIEW_FEEDBACK_ENABLED=0` en Preview, o por sesión con "Disable for Session" en su menú.
- **Medida (mismos pasos, Edge en Vercel desde Colombia; "contenido" = se ve la pantalla, "lista" = además quieta):**

| Paso | Antes (contenido / lista) | Después (contenido / lista) |
|---|---|---|
| Cambiar de pestaña, pantalla no vista hace poco | 0,32–0,49 s / 0,70–1,42 s | 0,35–0,48 s / 0,61–0,83 s |
| Cambiar de pestaña, vista en los últimos 30 s | 0,32–0,35 s / 0,70–1,42 s | 0,08–0,10 s / 0,27–0,63 s |
| Inicio, quieta | 1,42 s | 0,62 s |
| Abrir la app en Inicio | 0,48 s / 1,52 s | 0,43 s / 0,92 s |
| Primera visita tras desplegar | 0,35–1,14 s / 1,05–1,52 s | 0,35–0,86 s / 0,61–1,12 s |

- **Pruebas:** `tests/reglas/tiempoCarga.test.ts` (la memoria de 30 s, las duraciones y el `router.refresh()` de las tres pantallas), `tests/servidor/sesion.test.ts` con `getClaims` (token inválido = sin sesión, otro error se propaga). Edge con la base real: `ui_e20b2` 23/23, `ui_e20b3` 18/18; sin conexión `ui_e20sin` 16/16, `ui_e19b` 12/12 y `ui_e11e` 34/34. `npm test`, `eslint` sin errores y build correcto.
- **Prueba del usuario (2026-11-21):** en el iPhone (app instalada) y el PC, todo bien: las pestañas más ágiles, volver casi instantáneo, Inicio con el cambio después de guardar, animaciones cortas, la sesión y sin conexión.
- **Barra de herramientas de Vercel:** a pedido del usuario, `VERCEL_PREVIEW_FEEDBACK_ENABLED=0` en Preview (desde el despliegue siguiente).
- **Para E20c (pedido del usuario):** al bloquear o eliminar una cuenta, la sesión que ya tenía abierta no debe seguir valiendo hasta que venza el token; anotado en el prompt de E20c (`PROMPTS_AMPLIACION.md`).

#### Commit 4: Calendario (2026-11-21)

- **Fechas de Semestre:** el día con un corte, la fecha final o una nota con fecha lleva un contorno del color de acento en su número, además del ícono.
- **Puntos:** uno por categoría con su color, hasta 3, como en Mi semana (`coloresDelDia`); apagado si todas las tareas de esa categoría en el día están completadas (antes, uno por tarea y "+N").
- **"Próximos" (presentación):** debajo de la lista del día (al lado del mes desde 1536 px), las 5 más cercanas de los próximos 30 días desde hoy, sin importar el mes que se ve: tareas pendientes y fechas de Semestre, cada una con su fecha, "Hoy", "Mañana" o "El lunes 23", y la etiqueta Tarea, Corte o Nota; el mismo día, Semestre primero y las tareas por hora. La tarea lleva a su día en el Calendario; lo de Semestre, a la materia. Regla `proximosDelCalendario` en `src/lib/reglas/calendario.ts`; datos en `mesDeTareas` (`proximos`); componente `ProximosCalendario.tsx`.
- **Vida:** el mes entra deslizándose desde el lado de la flecha que se tocó (`nova-mes-siguiente` y `nova-mes-anterior`, 0,22 s); la lista del día aparece suave al elegir otro día. Con "reducir movimiento", nada se mueve.
- **Pruebas:** `tests/interfaz/calendario.test.tsx` (un punto por categoría, el contorno, "Próximos" con sus enlaces y vacío) y la regla en `tests/reglas/inicio.test.ts`. Edge (`ui_e20b4.mjs`) 12 de 12: el contorno, dos puntos para tres tareas de dos categorías, "Próximos" en orden y sin vencidas, sus enlaces, el lado por el que entra el mes, la lista del día, 390, 1280 y 1600 px en claro y oscuro sin desborde. Sin conexión: `ui_e20sin.mjs` 16/16, `ui_e19b.mjs` 12/12 y `ui_e11e.mjs` 34/34. `npm test` sin fallas (una prueba de `indexacionPendiente` falló una vez con la máquina cargada y pasa sola), `eslint` sin errores y build correcto.
- **Prueba del usuario (2026-11-24):** en el iPhone (app instalada) y el PC, todo bien; en el PC "Próximos" al lado del mes y la barra de Vercel ya no aparece.

#### Ajuste: formularios con el teclado del iPhone (2026-11-24)

- **Reporte del usuario:** en Semestre → "Nueva materia" (iPhone, app instalada, oscuro), al tocar el campo se abría el teclado y la hoja subía por detrás de la franja de arriba: el título y el campo quedaban tapados; además el iPhone ofrecía "Autorrellenar contacto".
- **Causa:** la entrada de los bloques de cada pantalla (`nova-entrada`, commit 1 de E20b) dejaba puesto el `transform` de la animación (`both`); mientras está puesto, lo `fixed` de adentro se ubica respecto al bloque y no a la pantalla, así que la hoja quedaba corrida hacia abajo y medía el 85 % del alto completo; con el teclado, el iPhone la empujaba arriba.
- **Corrección:** las animaciones de entrada (`nova-entrar`, `nova-subir`, `nova-mes-*`) terminan sin dejar nada puesto (`backwards`); `Dialogo` se dibuja en `<body>` con un portal, ocupa solo la parte visible (`visualViewport`: alto y desplazamiento, siguiendo sus cambios), su hoja nunca pasa del alto visible menos la franja de arriba y el campo enfocado se lleva a la vista. Vale para todos los diálogos (materia, categoría, componente, nota, corte, minutos al completar).
- **Contactos:** Safari ignora `autocomplete="off"` y ofrece contactos por palabras como "nombre" en el id, la etiqueta o el ejemplo (Apple lo documenta). `Campo` usa `autoComplete="off"` por defecto y los campos que no son de personas cambian de id y etiqueta: "Materia", "Categoría", "Componente", "Descripción (opcional)" en la nota, "Título del corte N", "Tema". El nombre del Perfil sigue con `autoComplete="name"`; "Docente" sí es una persona y queda igual. Lo vigila `tests/interfaz/dialogoTeclado.test.tsx`.
- **Formularios de página completa** (nueva tarea, editar tarea): no son diálogos; el iPhone los desplaza solo y no tienen nada fijo arriba. Las metas semanales van en la página, no en un diálogo.
- **Pruebas:** `dialogoTeclado.test.tsx` (alto visible, campo a la vista, `autoComplete`, ninguna etiqueta o id con "nombre" salvo Perfil). Edge (`ui_teclado.mjs`) 7 de 7: "Nueva materia", "Nueva categoría" y "Agregar componente" a 390 px con el alto visible reducido a 400 px (como con el teclado): el título y el campo dentro de lo visible, sin autorrelleno ni "nombre". Además `ui_e20b2` 23/23, `ui_e20b3` 18/18 (una vez 17/18: el guardado tardó más que la espera de la prueba), `ui_e20b4` 12/12; sin conexión `ui_e20sin` 16/16, `ui_e19b` 12/12 y `ui_e11e` 34/34. `npm test` 1386/1386, `eslint` sin errores y build correcto.

#### Recuperar la contraseña: lo encontrado (2026-11-24, sin programar)

- "¿Olvidaste tu contraseña?" (`/api/auth/recuperar`) crea un enlace propio de 30 minutos y lo manda por Resend con la clave de Vercel Connect y el remitente de prueba `onboarding@resend.dev`. Sin dominio verificado, Resend solo entrega al correo dueño de su cuenta; a cualquier otro responde con error, la ruta anula el enlace y la pantalla igual dice "Si el correo está registrado, recibirás un enlace". Mismo código en la vista previa y en producción (`master`). La clave solo permite enviar (no deja ver dominios ni envíos), así que no se pudo comprobar más sin enviar un correo, y no se envió ninguno.
- La cuenta del usuario tiene el correo confirmado en Supabase: "Entrar con Google" la puede unir sin crear otra.
- Las dos salidas pedidas (Google y contraseña temporal del administrador) quedaron en el prompt de E20c; el commit 10 (entrada) deja lugar para ellas.
- **Prueba del usuario (2026-11-24):** en el iPhone (app instalada, oscuro), todo bien: en "Nueva materia", categoría, componente, nota, cortes y los minutos, el título y el campo se ven sobre el teclado y ya no sale "Autorrellenar contacto"; al cerrar, la pantalla queda en su lugar. Probó "¿Olvidaste tu contraseña?" en la vista previa con su correo y el correo llegó (es el dueño de la cuenta de Resend); para otras personas no llegaría. Anotado en el prompt de E20c. De acuerdo con el plan de recuperación en E20c y con dejar el lugar en el commit 10.

#### Commit 5: Asistente (2026-11-24)

- **Burbujas:** la pregunta en una burbuja de acento con la esquina de arriba a la derecha recortada; la respuesta en un panel con borde y sombra; los mensajes nuevos suben al aparecer (los del historial no); "Tú" y "Nova" en letra mono.
- **Espera (presentación):** tres puntos que laten en una burbuja de Nova en vez de "Pensando…" (que sigue para lectores de pantalla); el aviso de demora de 10 s igual. Con "reducir movimiento" quedan quietos.
- **Cita desplegable (cambio de comportamiento de la presentación):** cada fuente de PDF trae el extracto de su fragmento (`conExtractos` y `extractoCita` en `src/lib/reglas/asistente.ts`, hasta 320 caracteres cortados en una palabra; `fragmento` en `Fuente`, guardado con el mensaje en `mensajes_chat.fuentes`, sin migración). Al tocar la cita se despliega el fragmento en cursiva con un borde de acento (`ListaFuentes`); las respuestas guardadas antes no traen extracto y su cita es solo un chip.
- **Preguntas sugeridas (cambio de comportamiento):** chips bajo la conversación según lo que tiene la persona (`sugerenciasAsistente`: con tareas, la semana y las vencidas; con documentos, resumir y temas del más reciente; sin tareas, las pendientes); tocar una la envía. Solo con "Todos los documentos" y mientras no está respondiendo; en el teléfono la fila se desliza de lado.
- **Respuesta palabra por palabra: queda fuera** (decisión del usuario: si complicaba el respaldo entre modelos o las respuestas exactas del servidor, se deja y se avisa). El servidor necesita la respuesta completa antes de mostrarla: la cambia por los textos exactos ("No encontré…", "No tienes tareas pendientes.", sin documentos), compacta las citas (RB-36) y elige las fuentes; y el modelo principal tiene 15 s antes de pasar al de respaldo, así que un texto a medias podría cortarse o cambiar al final.
- **Pruebas:** `tests/interfaz/asistenteE20b.test.tsx` (reglas del extracto y de las sugerencias, la cita que se despliega y se pliega, las burbujas, los tres puntos con "Pensando…" para lectores de pantalla, una sugerencia que se envía, sin sugerencias con otro "Buscar en"); `consulta.test.ts` y `consultaLibro.test.ts` con el extracto. Edge (`ui_e20b5.mjs`) 22 de 22 a 390 y 1280 px en claro y oscuro, con la consulta respondida en el navegador (sin Gemini). En la primera corrida el service worker de Nova reenvió la consulta al servidor antes de la intercepción: se gastó una llamada real a Gemini; desde entonces la prueba desactiva el service worker. Sin conexión: `ui_e20sin` 16/16, `ui_e19b` 12/12 y `ui_e11e` 34/34. `npm test` 1393/1393, `eslint` sin errores y build correcto.
- **Prueba del usuario (2026-11-24):** en el iPhone (app instalada) y el PC, todo bien: burbujas, tres puntos, la cita que se abre y se cierra (las viejas sin desplegar), las sugerencias que se envían y desaparecen con Wikipedia o IA, modo oscuro, reducir movimiento y sin conexión; en el PC las sugerencias van en filas. De acuerdo con dejar fuera la respuesta palabra por palabra. Encontró un detalle: "[tarea 397a5717]" dentro de la respuesta al nombrar una tarea.

#### Corrección: sin "[Tarea 1a2b3c4d]" en las respuestas (2026-11-24)

- **Causa:** cada tarea va al modelo con la etiqueta interna `Tarea` y los 8 primeros caracteres de su id (`etiquetaTarea`), y el prompt le pide citar copiando la etiqueta; el servidor la usaba para elegir las fuentes pero nunca la quitaba del texto, y el chip de la tarea mostraba esa misma etiqueta. A veces el modelo la escribe en minúscula.
- **Corrección:** `sinMarcasInternas` en `src/lib/reglas/asistente.ts` quita "[Tarea 1a2b3c4d]" o "(tarea 1a2b3c4d)" (también dentro de una cita con varias partes, dejando la del PDF); la respuesta queda con el título y la fecha. `armarFuentes` reconoce la etiqueta sin importar mayúsculas y la fuente de la tarea lleva su título (`TareaContexto.titulo`), así que se ve como las demás citas. También al explicar de otra manera (`conversacion.ts`). En los temas propuestos y en los títulos de los pasos del plan se quitan además "[T2]" o "[F3]" (en el chat no, porque pueden ser texto de un documento). Las respuestas guardadas antes se limpian al mostrarlas (`MensajeChat`) y su chip con el identificador no se muestra (`ListaFuentes`). Las citas de PDF y de fuentes web no cambian.
- **Pruebas:** `tests/servidor/marcasInternas.test.ts` con respuestas simuladas (sin Gemini): en minúscula, como en el contexto, entre paréntesis, en una lista y junto a una cita de PDF; las demás citas quedan igual; temas y plan. `asistenteE20b.test.tsx` con una respuesta guardada antes. `consulta.test.ts` actualizado (la fuente de la tarea es su título). `npm test` 1402/1402, `eslint` sin errores.
- **Probado por el usuario sin fallas** (2026-11-25, iPhone y PC).

#### Commit 6: Fuentes (2026-11-24)

- **Etapas de indexación visibles (cambio de comportamiento de la presentación):** al indexar un PDF se encienden en orden "Subir el archivo" (con su porcentaje real), "Leer el texto", "Dividir en fragmentos", "Crear los vectores con Gemini" y "Guardar en tu biblioteca"; la hecha lleva un check que se dibuja, la de ahora late, la que falla lleva un ícono de alerta y el mensaje exacto de siempre. No son simuladas: el servidor avisa cada etapa cuando empieza, en la misma respuesta (`application/x-ndjson`: una línea por etapa y al final la respuesta del contrato), solo si la pantalla lo pide con `Accept`; los scripts y las pruebas reciben el JSON de siempre. Sesión y datos se validan antes, con su estado HTTP normal. Reglas en `src/lib/reglas/etapasIndexacion.ts`, `responderConEtapas` en `src/lib/http/respuestas.ts`, `alEtapa` en `indexarDocumento`, `indexarContenido` y `avanzarIndexacion` (`src/lib/datos/documentos.ts`), componente `EtapasIndexacion`. Un libro largo muestra las etapas en `IndexacionPendiente` con "Crear los vectores" y su porcentaje. Para lectores de pantalla, una sola línea de estado ("Etapa 3 de 5: Dividir en fragmentos").
- **Zona para el PDF:** un recuadro punteado para tocar o arrastrar el archivo ("Toca para elegir un PDF" en el teléfono, "Elige un PDF o arrástralo aquí" en el PC), con el nombre y el tamaño del elegido; el campo de archivo la cubre entera, así el clic, el teclado y soltar el archivo son los del navegador.
- **Botón con estados:** "Indexar PDF" pasa por "Indexando…" y termina en "Indexado" con el check unos 2,5 s antes de volver.
- **Documentos:** cada uno lleva su sello "PDF" en la tabla y en las tarjetas del teléfono; la columna del nombre tiene un ancho mínimo para no cortar palabras.
- **Pruebas:** `tests/servidor/etapasIndexacion.test.ts` (reglas, la ruta con y sin etapas, el error en la última línea, sin sesión 401 antes de empezar), el orden de las etapas en `documentos.test.ts` y `tests/interfaz/fuentesE20b.test.tsx` (las etapas que se encienden con lo que llega, el fallo en "Leer el texto", el libro largo, la zona y el sello). Edge (`ui_e20b6.mjs`) 36 de 36 a 390 y 1280 px en claro y oscuro: el servidor real responde las etapas y el error de un PDF que no existe (sin Gemini); en la pantalla, la subida a Blob se respondió en el navegador (no se subió nada) y la indexación llegó simulada por partes. `npm test` 1414/1414, `eslint` sin errores y build correcto.
- **Prueba del usuario (2026-11-24):** en el iPhone (app instalada) y el PC, todo bien: ya no sale "[tarea …]"; en Fuentes, el recuadro, las cinco etapas en orden, "Indexado", el sello "PDF", modo oscuro, reducir movimiento, sin conexión y arrastrar el PDF en el PC. Reportó que "¿Qué tengo esta semana?" respondió "- Tarea (categoría: General; prioridad: Media; fecha límite: 28/11/2026, 2026-11-28)": la línea interna copiada, con la fecha dos veces. Pidió además dos propuestas, sin programar: leer PDF escaneados con OCR y subir otros tipos de documento.

#### Corrección: respuestas naturales sobre tareas (2026-11-24)

- **Causa:** cada tarea iba al modelo en una sola línea con todo entre paréntesis y la fecha dos veces ("fecha límite: 28/11/2026, 2026-11-28"), y el prompt no decía cómo nombrarla; el modelo copiaba la línea tal cual.
- **Corrección:**
  - el contexto lleva un dato por línea ("Título:", "Vence: sábado 28 de noviembre (2026-11-28)", "Prioridad: media", "Categoría:", "Horario:"), con la fecha en palabras una vez (`fechaEnPalabras` en `src/lib/reglas/fechas.ts`, con el año solo si no es el de hoy) y la forma AAAA-MM-DD solo para comparar (RB-31 sigue);
  - el prompt pide una frase natural ("Taller de cálculo: vence el viernes 28 de noviembre (prioridad media)"), sin copiar las líneas del contexto ni escribir fechas en números;
  - respaldo del servidor (`fechasNaturales` en `src/lib/reglas/asistente.ts`), solo cuando hubo tareas en el contexto: el paréntesis copiado pasa a ": vence el … (prioridad …)", la fecha repetida queda una vez y las fechas AAAA-MM-DD o DD/MM/AAAA sueltas pasan a palabras. Una respuesta solo de documentos conserva sus fechas.
- **Pruebas:** `tests/servidor/respuestaTareas.test.ts` con respuestas simuladas (sin Gemini): el caso reportado, con horario, la forma nueva copiada, fechas sueltas y de otro año, una respuesta de documentos sin cambios, el prompt y el contexto. `aislamiento.test.ts` con el formato nuevo; `marcasInternas.test.ts` con la fecha en palabras. `npm test` 1419/1419, `eslint` sin errores.
- **Probado por el usuario sin fallas** (2026-11-25, iPhone y PC).

#### Commit 7: Semestre (2026-11-24)

- **Materias:** la tarjeta de una materia perdida o reprobada lleva fondo y borde rojizos; la que está en riesgo (por nota o a 2 fallas del límite), ámbar; la insignia del estado sigue igual. El promedio del semestre y la nota de cada materia cuentan al aparecer (`Contador` con décimas).
- **Fallas en puntos:** un punto por falla permitida (con límite de hasta 40), los de las registradas en rojo; al sumar una falla, el punto nuevo se pinta con un pulso; en el límite, la tarjeta de Fallas va con borde rojo. Los puntos van ocultos para lectores de pantalla (el número ya lo dice). `Fallas` ya no se monta de nuevo con una `key` al cambiar: reinicia sus campos cuando llegan datos nuevos (si no, el pulso no se veía).
- **Calculadora:** la nota actual cuenta; los cortes como una barra, cada uno con su ancho según su porcentaje y lleno hasta su nota, y el corte sin notas rayado; "¿Cuánto necesito?" cambia de color al instante con la meta: verde (asegurada o hasta 4,2), ámbar (más de 4,2) y rojo (no alcanzable), con su ícono (`tonoNecesito`).
- **Objetivos y plan:** los temas propuestos llevan borde punteado ámbar hasta confirmarlos; "Proponer temas" termina en "Temas propuestos" con el check unos 2,5 s.
- **Sin cambios de reglas:** los cálculos, los estados y los textos son los de siempre.
- **Pruebas:** `tests/interfaz/semestreE20b.test.tsx` (puntos de fallas, el pulso, el borde en el límite, los campos que siguen a los datos, el tono de "¿Cuánto necesito?", la barra de cortes, la nota que cuenta, los temas propuestos y el botón con "listo"); `temas.test.tsx` espera a que el botón vuelva. Edge (`ui_e20b7.mjs`) 36 de 36 a 390 y 1280 px en claro y oscuro: el fondo de riesgo, los puntos, la barra, los tres colores, los temas punteados, el pulso, el borde rojo en el límite y "reducir movimiento". Sin conexión: `ui_e20sin` 16/16, `ui_e19b` 12/12 y `ui_e11e` 34/34. `npm test` 1427/1427, `eslint` sin errores y build correcto.
- **Probado por el usuario sin fallas** (2026-11-25, iPhone y PC).

#### Forma de trabajo desde el commit 8 (pedido del usuario, 2026-11-25)

- Los commits 8, 9 y 10 van seguidos, cada uno en su commit, sin esperar la prueba del usuario entre ellos; al final, una sola lista de pruebas agrupada por pantalla.
- Pruebas para el usuario: solo lo nuevo y visible en el iPhone, y en el PC lo que cambie en pantalla ancha. Sin conexión, modo oscuro, tamaños y "reducir movimiento" los cubren las pruebas automáticas (se informa el resultado); se le pide probarlos solo si un commit toca el service worker o algo que no cubren.
- Si una decisión cambia lo acordado, se pregunta antes de seguir.

#### Commit 8: Productividad y Cuestionarios (2026-11-25)

- **Anillo y minigráfico** (`src/components/ui/Anillo.tsx`): un anillo que se llena al aparecer (el mismo de Progreso semanal, ahora reutilizable) y un minigráfico de línea que se dibuja de izquierda a derecha. Decorativos: el dato va en texto.
- **Productividad:** los puntos del día en un anillo del color del nivel (verde, ámbar o rojo) con el número que cuenta; barras que se llenan para las tareas completadas y los minutos (hasta el tope de 120); la recomendación en un recuadro con ícono. Las barras de las metas semanales también se llenan al aparecer.
- **Cuestionarios:** el resultado de un intento en un anillo con la nota que cuenta (verde con todo bien); en "Mis cuestionarios", la tendencia ("Mejoraste", "Igual", "Bajaste") en una píldora de color con ícono, y un minigráfico con la evolución de los puntajes (sin los repasos), del color de la última tendencia; "Crear cuestionario" termina en "Cuestionario listo" mientras se abre.
- **Sin cambios de reglas:** los cálculos y los textos son los de siempre.
- **Pruebas:** `tests/interfaz/productividadE20b.test.tsx` (el anillo, el minigráfico, Productividad con su anillo y sus barras, el resultado en verde, la evolución sin repasos, la píldora y el botón con "listo"). Edge (`ui_e20b8.mjs`) 26 de 26 a 390 y 1280 px en claro y oscuro, con Productividad respondida en el navegador (sin Gemini) y "reducir movimiento". Sin conexión: `ui_e20sin` 16/16, `ui_e19b` 12/12 y `ui_e11e` 34/34. `eslint` sin errores y build correcto.
- **Probado por el usuario sin fallas** (2026-11-25, iPhone y PC).

#### Commit 9: Configuración (2026-11-25)

- **Títulos con ícono** en cada bloque (`TituloBloque`), **el perfil con su inicial** y el correo arriba del formulario.
- **Apariencia:** el tema (claro, oscuro, automático) y el formato de hora como tarjetas con ícono; los textos y el guardado son los de siempre.
- **Botones con "listo"** (`useListo` en `src/components/ui/useListo.ts`): "Guardar nombre" y "Guardar" de Académico terminan en "Guardado", y "Guardar hora" en "Guardada", unos 2,5 s; los avisos de siempre siguen.
- **Pantalla ancha (desde 1280 px):** un índice de secciones fijo a la izquierda (`IndiceConfiguracion`) que lleva a cada bloque y marca el que se está viendo; sus enlaces solo desplazan la página (permitidos sin conexión). En el teléfono no aparece.
- **Pruebas:** `tests/interfaz/configuracionE20b.test.tsx` (la inicial y "Guardado", las tarjetas del tema con los mismos nombres, el índice); `configuracion.test.tsx` sin cambios. Edge (`ui_e20b9.mjs`) 17 de 17 a 390 y 1280 px en claro y oscuro: títulos, inicial, tarjetas, el índice solo en pantalla ancha, ir a Notificaciones, la tarjeta "Oscuro" aplica el tema y "Guardado". `eslint` sin errores y build correcto.
- **Probado por el usuario sin fallas** (2026-11-25, iPhone y PC).

#### Commit 10: Entrada con la Estrella nova (2026-11-25)

- **Escena** (`EntradaNova` y `CieloNoche` en `src/components/login/`, solo en el inicio de sesión): cielo de noche también en modo claro (tokens `--nova-cielo-*`, una sola definición), 64 estrellas que titilan cada una a su ritmo (posiciones fijas con semilla, iguales en el servidor y el navegador) y un cielo que se desplaza muy despacio. La Estrella nova en el centro, apagada (sin color) y latiendo, con sus colores de noche dentro de la escena.
- **Luz:** en el PC, una luz cálida sigue al mouse sin retraso (`translate3d` en `requestAnimationFrame`, sin transición en la posición), las estrellas cercanas brillan más con una transición corta y el cielo se mueve un poco al lado contrario. En el teléfono, la luz sigue al dedo mientras se arrastra (sin la inclinación). Después de encenderla, la luz queda al 40 %. Con la pestaña oculta, todo se detiene (`data-pausado`).
- **Indicación:** "Toca la estrella" en el teléfono y "Haz clic en la estrella" con "o pulsa Enter" en el PC, con un ícono y un brillo que va y viene; desaparece al encenderla. La estrella es lo primero al pulsar Tab, con un contorno visible, y se enciende con Enter o Espacio.
- **Encender:** el centro y los anillos se iluminan, crece un brillo cálido que queda como halo, y salen tres ondas que viajan con la estrella. Un solo movimiento suave (Web Animations, `cubic-bezier(0.65, 0, 0.35, 1)`, 1 s) hasta su lugar: en el teléfono sube y se encoge hasta ser el logo arriba del formulario; en pantalla ancha (desde 1024 px) se desliza a la izquierda y queda grande, con "Nova" y "Tu semestre, tus tareas y tus documentos, en un solo lugar.". El formulario aparece cuando la estrella va por el 45 % del viaje (sube en el teléfono; entra desde la derecha en pantalla ancha). Si se encendió con la estrella, el foco pasa al correo.
- **Siempre usable:** el formulario está en la página desde el principio (ni oculto para lectores de pantalla ni fuera del orden de Tab); al llegar a él con Tab, la estrella se enciende. Si nadie la toca, se enciende sola a los 2 s. Con "reducir movimiento", todo está encendido desde el principio, sin la escena ni la luz.
- **E20c:** `EntradaNova` recibe `extra`, el lugar para "Entrar con Google" y el texto nuevo de "¿Olvidaste tu contraseña?". El inicio de sesión, sus mensajes y su lógica no cambian; registro y recuperación siguen con `TarjetaAcceso`.
- **Pruebas:** `tests/interfaz/entradaE20b.test.tsx` (apagada con la indicación y el formulario usable, encender con la estrella y las tres ondas dentro de la que viaja, sola a los 2 s, con Tab al formulario, "reducir movimiento", las estrellas iguales y el contraste del cielo); `contraste.test.ts` vigila también `EntradaNova` y `CieloNoche`. Edge (`ui_e20b10.mjs`) 37 de 37 a 390 y 1280 px en claro y oscuro: la estrella en el centro, la indicación según el dispositivo, las ondas que viajan, el formulario a mitad del viaje, la estrella en su lugar y el foco en el correo, la luz pegada al mouse y sin transición en la posición, las estrellas cercanas, el cielo detenido con la pestaña oculta, sola a los 2 s, la luz tenue, Tab con contorno, Enter, Espacio, "reducir movimiento" e iniciar sesión. Además, el índice de Configuración se ve al lado de la barra lateral en una captura normal. Sin conexión: `ui_e20sin` 16/16, `ui_e19b` 12/12 y `ui_e11e` 34/34 (la entrada no toca el service worker). `npm test` 1443/1443, `eslint` sin errores y build correcto.
- **Probado por el usuario sin fallas** (2026-11-25, iPhone y PC).

#### Pantalla de carga con la Estrella nova (2026-11-25, pedida por el usuario antes de cerrar E20b)

- **Qué es:** `PantallaCarga` (`src/components/nova/PantallaCarga.tsx`) en el layout de Nova, con el SVG y el CSS del usuario pasados a clases `nova-carga-*` y tokens `--nova-carga-*` (definidos solo en `:root`: siempre oscura, en claro y en oscuro). La estrella late y salen dos ondas; con "reducir movimiento", quieta, sin ondas y solo el desvanecido de 0,35 s.
- **Solo en frío:** va en el HTML inicial. Su script (`SCRIPT_CARGA` en `src/lib/pantallaCarga.ts`) corre mientras el navegador lee la página y pone `data-nova-carga` en `<html>`, que es lo único que la muestra. Se muestra en una carga `navigate` que no viene de otra página de Nova. No en una recarga, al volver atrás, al navegar con el menú (React la agrega sin correr el script), en las cargas completas de sin conexión ni al llegar desde /login. La Entrada no la tiene.
- **Sin espera:** se va en DOMContentLoaded (todo lo que manda el servidor en la misma respuesta ya está), sin tiempo mínimo. Si eso pasa antes del primer cuadro pintado, se quita sin desvanecer (no parpadea).
- **iPhone:**
  - Las 28 imágenes de arranque son ahora el primer cuadro de la animación: fondo `#14110f` y la estrella quieta de 112 puntos al centro de la pantalla. Son iguales en claro y oscuro. Se generaron en Edge con el mismo SVG y CSS; comparadas con la captura de la pantalla de carga, la diferencia es 0.
  - En la app instalada, la estrella se centra en la pantalla completa (`--nova-carga-y`) aunque la página empiece debajo de la barra de estado.
  - Mientras se ve, una etiqueta `theme-color` propia pone la barra oscura. Va escrita `#14110F` (`COLOR_BARRA_CARGA`): con el mismo texto que la de Next, React 19 la tomaba como suya y fallaba al navegar (`removeChild`). `tema.ts` no la toca.
  - El manifiesto usa `background_color` `#14110f`; `theme_color` sigue claro.
- **Service worker:** guarda `/icons/` y el manifiesto con "primero lo guardado", y las imágenes nuevas tienen el mismo nombre. Por eso, al activarse, ahora borra de su caché los íconos y el manifiesto (`seRenuevaAlActualizar` en `sw-reglas.js`, huella actualizada). Los archivos de `/_next/static/` se quedan porque las copias sin conexión los usan.
- **Pruebas:**
  - `tests/interfaz/pantallaCarga.test.tsx`: cuándo se muestra y cuándo no, el desvanecido sin tiempo mínimo, que no parpadea, el centro en la app instalada, el marcado, el CSS y que el tema no toca su barra. `arranque.test.ts` exige el fondo oscuro en las 28 imágenes y en el manifiesto. `serviceWorker.test.ts` prueba la activación. `npm test` 1455 de 1455, `eslint` sin errores y build correcto.
  - Edge (`ui_e20b11.mjs`), 26 de 26, a 393 y 1280 px en claro y oscuro con la red lenta: el fondo y la estrella al centro, el primer cuadro igual a la imagen de arranque, el desvanecido y la barra oscura, unos 400 ms desde que la página está lista hasta quitarla, contando el desvanecido, y nada puesto después. También que no aparece al navegar, al recargar, al volver desde segundo plano, en la Entrada ni después de iniciar sesión, "reducir movimiento" y sin errores de página.
  - Sin conexión: `ui_e20sin` 16 de 16, `ui_e19b` 12 de 12 y `ui_e11e` 34 de 34. Entrada: `ui_e20b10` 37 de 37.
- **Probado por el usuario sin fallas** (2026-11-25, iPhone con la app reinstalada, en claro y oscuro, y PC): pasa del arranque a la estrella sin saltos, sin franjas de otro color arriba ni abajo, no aparece al navegar ni al volver desde segundo plano; en el PC solo en una pestaña nueva.

#### Cierre de E20b (2026-11-25)

- **Terminada el 2026-11-25** tras la prueba del usuario en iPhone (app reinstalada) y PC, sin fallas: la fecha en palabras en el Asistente, el commit 7 (Semestre), los commits 8, 9 y 10 y la pantalla de carga. Antes ya había probado los commits 1 a 6, el 11 adelantado, el ajuste del teclado del iPhone y la corrección de "[Tarea …]".
- **Lo que quedó:** paleta "noche de estudio" y letras con `next/font`; logo "Estrella nova" con ícono, favicon y arranque; barra lateral de cristal plegable y barra inferior flotante con píldora; Inicio con tarjetas animadas y próximo corte; celebración al completar tareas; Calendario con "Próximos"; Asistente con burbujas, citas desplegables y preguntas sugeridas; Fuentes con las etapas reales de indexación; Semestre con fallas en puntos, barra de cortes y "¿Cuánto necesito?" con color; anillos y minigráficos en Productividad y Cuestionarios; Configuración con íconos, tarjetas e índice; la Entrada con la Estrella nova en un cielo de noche; la pantalla de carga al abrir en frío; y la sesión verificada sin ir a Supabase con consultas en paralelo (tiempo de carga). Todo sin librería de animación y con "reducir movimiento" respetado; sin conexión revisado en cada commit.
- **Quedó fuera:** la respuesta palabra por palabra del Asistente (choca con las respuestas exactas del servidor y el respaldo entre modelos).
- **El mismo día:** el usuario aprobó la propuesta E20d tal como está escrita, para después de E20c. Sus columnas pasan a ser **M26**, porque E20c ya usa M24 (`claves_gemini`) y M25 (cuentas y administración).
- **Sigue:** la propuesta de cómo hacer E20c y E20d, que espera la confirmación del usuario antes de programar.

#### Propuesta E20d (2026-11-24)

- A pedido del usuario, sin programar: leer PDF escaneados con OCR (comparación de solo Gemini, solo Tesseract y combinado; recomendación: Gemini solo para las páginas sin texto, preguntando antes de gastar) y subir Markdown, texto, Word, PowerPoint y fotos, cada uno con su estructura. Escrita en `PROMPTS_AMPLIACION.md`, sección E20d, entre E20c y E21. **Aprobada por el usuario el 2026-11-25** tal como está, para después de E20c (migración M26).

#### Cambio para el commit 10 (2026-11-24)

- El usuario cambió la entrada: en vez de la lámpara, la Estrella nova en un cielo de noche que se enciende al tocarla (detalle en el prompt de E20b, "Commit 10, Entrada"). Se programa al llegar al commit 10.


### E20c Ampliación: clave de Gemini propia y acceso de otras personas

#### Propuesta y decisiones (2026-11-25)

- **Partes:** E20c-1 clave propia, E20c-2 Administración con niveles, E20c-3 "Entrar con Google", control de registro y contraseña temporal. Cada una con la prueba del usuario antes de la siguiente.
- **Cambios del usuario:** llave con versiones, `ilegible`, `uso_ia_diario`, niveles dueño, administrador y usuario, y permiso de la clave del proyecto por persona y apagado. `SUPABASE_ADMIN_EMAILS` queda solo para emergencias. Las cuentas nuevas nacen `pendiente` hasta que se habiliten. Detalle en el plan (5.14, "Cambios aprobados el 2026-11-25") y en el prompt de E20c.
- **E20d:** aprobada; su migración pasa a M26.
- **Pasos de Google Cloud y Supabase** para "Entrar con Google": se le dieron al usuario aparte. Los hace mientras se programan E20c-1 y E20c-2, con el proveedor apagado en Supabase hasta E20c-3.

#### E20c-1: clave de Gemini propia (2026-11-25)

- **Antes de migrar:** `db:respaldar` (`respaldos/2026-11-25_163257`).
- **M24** (`20261125100000_nova_claves_gemini.sql`), aplicada y solo aditiva:
  - `claves_gemini`: texto cifrado, IV, etiqueta, `version_llave`, últimos 4 y estado `activa`, `rechazada`, `sin_cuota` o `ilegible`;
  - `uso_ia_diario`: solo conteos por cuenta y día de Bogotá;
  - las dos con RLS y sin políticas, y en `tablas-respaldo.mjs`.
- **Comprobaciones de M24:**
  - `db:verificar` 0 fallas, con las restricciones nuevas (ei a ep).
  - Respaldo con filas de un usuario temporal: `db:respaldar` incluye las dos tablas con todas sus columnas, y `db:restaurar --probar` las restaura (BYTEA incluido) y revierte. Después se borraron el usuario y ese respaldo de prueba.
  - Compatibilidad con `master` (worktree temporal, borrado al terminar sin tocar el `node_modules` real): `db:verificar` y `probar:rag` con 0 fallas.
- **Llave:**
  - `NOVA_LLAVE_CLAVES_V1` (32 bytes al azar) y `NOVA_LLAVE_CLAVES_ACTUAL=1`, en `.env.local` y en Vercel Production y Preview como "Config" (visibles, para que el usuario guarde su copia).
  - Se comprobó por huella que el valor de Vercel es igual al local. Nunca se mostró.
- **Cifrado** (`src/lib/ia/cifrado.ts`):
  - AES-256-GCM con datos asociados `nova-gemini:v{versión}:{usuario}` y la llave de la versión de cada clave.
  - `npm run claves:recifrar` (`-- --probar` para el simulacro) pasa todas a la llave actual. Una clave que no se descifra queda `ilegible`.
  - Sin `server-only`: Next lo resuelve por dentro y rompía los scripts. Solo lo importa el servicio de la clave, y en las pruebas se simula en `src/test/setup.ts`.
- **Quién usa qué clave** (`src/lib/llm/contextoIa.ts` y `src/lib/datos/claveGemini.ts`):
  - **Contexto:** cada servicio con IA corre dentro de `conIaDe(usuario)`. `dataService` los exporta envueltos con `usaIa`, y el aviso de cada minuto avanza cada libro con la clave de su dueño.
  - **Sin contexto,** `gemini.ts` no llama a Gemini (falla cerrado). Los scripts `probar:*` usan `conClaveDelProyecto`.
  - **Clave del proyecto:** sin clave propia, solo la usa el dueño. Antes de M25 no hay más permisos.
  - **Memoria:** la clave descifrada vive en la memoria como mucho 5 minutos. La memoria del modelo saturado es por clave.
  - **Errores de la clave propia:** 401, 403 o `API_KEY_INVALID` la dejan `rechazada`; un 429 la deja `sin_cuota` (el chat prueba antes el respaldo con la misma clave) y vuelve a `activa` al funcionar. Nunca cae en la clave del proyecto.
  - **Registros:** pasan por `ocultarClave`.
  - **Uso:** cada llamada a Gemini suma 1 en `uso_ia_diario`.
- **Segundo plano (RB-57):** solo toma libros cuyo dueño tiene una clave `activa` o `sin_cuota` o, sin clave, puede usar la del proyecto. Los demás quedan en pausa.
- **API:** `GET/PUT/DELETE /api/nova/clave-gemini`.
  - Solo devuelve `{ vinculada, ultimos4, estado, verificadaEn }`.
  - La verificación es `models.get` con la clave en el encabezado `x-goog-api-key`, nunca en la dirección.
  - `/api/nova/web` pasa el usuario.
  - Errores nuevos: `SIN_CLAVE_GEMINI`, `CLAVE_GEMINI_INVALIDA`, `CLAVE_GEMINI_RECHAZADA`, `CUOTA_CLAVE_AGOTADA`, `CLAVE_GEMINI_NO_VERIFICADA` y `CLAVE_GEMINI_ILEGIBLE` (RB-90).
- **Pantallas:**
  - **Configuración → Asistente → "Vincular mi clave de Gemini"** (`ClaveGemini`):
    - campo de contraseña sin autocompletar, con "Mostrar", que se vacía siempre;
    - "Verificar y guardar"; ya vinculada, `••••{últimos 4}`, su estado y la fecha en palabras;
    - "Cambiar clave" y "Desvincular" con confirmación.
  - **La guía** `/nova/configuracion/gemini`: pasos revisados en la documentación oficial. Se quitó lo de la cuota por proyecto, que no aparece en esas páginas.
  - **El estado de la IA** va en `ProveedorPreferencias` (el layout lo calcula sin descifrar).
  - **`RequiereIa` muestra el aviso** con "Cómo crear tu clave" y "Vincular en Configuración" en lugar del Asistente (campo, sugerencias, "Explicar de otra manera" y "Preguntarle a la IA"), subir un PDF, crear un cuestionario, "Proponer temas" y "Generar plan".
  - **La recomendación de Productividad** ya quedaba con el texto fijo si la IA falla.
- **Pruebas:**
  - **Automáticas:** `cifradoClaves` (S-81 y S-84), `claveGemini` (S-82 y S-83, `uso_ia_diario`), `geminiClavePropia` (contexto, errores de la clave propia y conteo), `claveGeminiRuta` (la API sin la clave) y `interfaz/claveGemini` (bloque y aviso). `npm test` 1497 de 1497, `eslint` sin errores y build correcto.
  - **`npm run probar:clave`** con Google real, 17 de 17 con una sola pregunta corta:
    - una clave inventada se rechaza sin guardar;
    - la real se verifica y queda solo cifrada;
    - se descifra con su usuario y no con otro;
    - la pregunta usa la clave de la persona y queda contada;
    - el simulacro de cambio de llave la recifra sin cambiar nada;
    - desvincular la borra.
  - **Edge (`ui_e20c1.mjs`), 28 de 28** con una cuenta temporal que no es la dueña, a 390 y 1280 px en claro y oscuro:
    - el aviso en el Asistente, Fuentes y Cuestionarios, con sus enlaces;
    - la guía y la API con `SIN_CLAVE_GEMINI`;
    - una clave inventada rechazada con el campo vacío;
    - una real con `••••` y ausente del HTML y de la API, también al recargar;
    - el Asistente con su campo;
    - desvincular con confirmación y el aviso de vuelta.
  - **Sin conexión:** `ui_e20sin` 16 de 16, `ui_e19b` 12 de 12 y `ui_e11e` 34 de 34 (al segundo intento; el primero no dejó resultado).
- **Probado por el usuario sin fallas** (2026-11-25, iPhone con la app instalada y PC): el bloque, la guía y la clave inventada rechazada con el campo vacío. No probó una clave real. Guardó su copia de `NOVA_LLAVE_CLAVES_V1`.

#### Ajuste de la pantalla de carga: cometa, estrella y portal (2026-11-25, pedido del usuario antes de E20c-2)

- **Secuencia** (`PantallaCarga`, `SCRIPT_CARGA` en `src/lib/pantallaCarga.ts` y CSS `nova-carga-*`; solo CSS y un poco de JavaScript, todo de frente):
  1. Fondo #14110F sin nada.
  2. Un cometa dibuja el anillo en 0,7 s: cabeza crema con halo y cola crema sobre el trazo en el acento. La cabeza gira con la misma curva que el trazo; medido en Edge, coinciden.
  3. Al cerrarse el anillo, la estrella se enciende con rebote y un destello, y aparecen "Nova" y "Tu noche de estudio, en orden." (de 0,7 a 1 s).
  4. Cuando la app está lista, se abre el portal (0,5 s): la app (`[data-nova-fondo]`) pasa encima y se ve por dentro de `clip-path: circle()`, que crece desde el centro de la estrella hasta salirse de la pantalla, con un aro de luz en el borde que se desvanece.
- **Tiempos:** el reloj empieza en el primer cuadro pintado.
  - Si la app ya está lista, todo dura 1,5 s (medido en Edge: de 1516 a 1554 ms).
  - Si tarda, la estrella respira hasta que esté lista.
  - La secuencia corre aunque la app esté lista antes del primer cuadro; se salta solo con la pestaña oculta.
  - Sigue solo en frío: nada al navegar, recargar o volver.
- **Números:** cuentan al abrirse el portal (`alVerseLaApp` y el evento `nova-carga-fin` en `Contador`).
- **"Reducir movimiento":** sin cometa ni portal; la estrella encendida y quieta, con su texto, y un desvanecido de 0,35 s.
- **Arranque:** las 28 imágenes del iPhone son solo el fondo #14110F, sin la estrella. El `background_color` del manifiesto ya era #14110F. La barra de estado sigue oscura mientras carga.
- **Service worker:** las imágenes cambian sin cambiar de nombre. `sw.js` lleva `// VERSION_ICONOS: <huella de public/icons>` (lo vigila `arranque.test.ts`), así cambia, se instala el nuevo y al activarse borra los íconos guardados.
- **Pruebas:**
  - `pantallaCarga.test.tsx` con reloj y cuadros simulados: la secuencia completa en 1,5 s, la espera si tarda, el portal sin cuadros, la app lista antes del primer cuadro, la pestaña oculta, "reducir movimiento", `alVerseLaApp`, el marcado de frente y el CSS. `npm test` 1502 de 1502, `eslint` sin errores y build correcto.
  - Edge (`ui_e20b12.mjs`), 36 de 36, a 393 y 1280 px en claro y oscuro, con el estado anotado en cada cuadro:
    - empieza vacío;
    - el cometa con el trazo a medias;
    - la estrella y el texto hacia los 0,83 s;
    - el portal hacia 1 s y el fin antes de 1,55 s;
    - el círculo crece desde la estrella hasta salirse;
    - el aro se desvanece;
    - la barra oscura hasta el portal;
    - los números en 0 al abrirse y luego contando;
    - nada puesto después;
    - con la app lenta, el portal a los 2,55 s;
    - "reducir movimiento", navegar y recargar;
    - la imagen de arranque de un solo color.
  - Sin conexión: `ui_e20sin` 16 de 16, `ui_e19b` 12 de 12 y `ui_e11e` 34 de 34. `ui_e20sin` ahora espera a que se quite la pantalla de carga antes de tocar: al entrar en frío cubre la app hasta 1,5 s, también para quien toca en el teléfono. Una corrida dio 15 de 16 por tiempos, y las siguientes, 16 de 16.
- **Probado por el usuario sin fallas** (2026-11-25, iPhone con la app reinstalada y PC). Aceptó que dure alrededor de 1,5 s solo en frío.

#### E20c-2: Administración con niveles (2026-11-25)

- **Respaldo antes de M25:** `respaldos/2026-11-25_194715`. M25 se probó primero dentro de una transacción revertida y luego se aplicó. Respaldo después: `respaldos/2026-11-25_202117`, con `cuentas` (5 filas) y `administracion`; `db:restaurar --probar` correcto.
- **Código:** reglas en `src/lib/reglas/cuentas.ts`; `src/lib/datos/cuentas.ts` (`leerCuenta`, `accesoDe`, `exigirEspacio`); `src/lib/datos/administracion.ts` (`panelAdministracion`, `accionSobreCuenta`, `eliminarCuenta`, `cambiarTopes`); `exigirSesion` con nivel, `exigirAdministrador` y `exigirDueno` en `src/lib/auth/sesion.ts` (`src/lib/auth/acceso.ts` ya no existe); rutas `/api/nova/administracion` (GET, PATCH) y `/api/nova/administracion/cuentas/[id]` (POST, DELETE); `/nova/administracion` con `src/components/nova/administracion/`; `/cuenta`; "Administración" en el menú con `menuLateral` y `menuMas`.
**Cómo quedó E20c-2 (2026-11-25), decisiones de detalle:**
- **M25** (`20261125110000_nova_cuentas.sql`): `cuentas`, `administracion` y `acciones_admin` como en 6.21; `nova_proteger_cuentas` (un solo dueño, solo el correo incorporado, siempre activo, sin bajar de nivel ni borrar su fila salvo en el simulacro de restauración, con `nova.restaurando`); el disparador `nova_cuenta_nueva` en `auth.users` (nace `pendiente`; ya deja `activa` a la que llega con Google, que sigue apagado hasta E20c-3); `nova_espacio(usuario)` (7.16, recorre las tablas con `usuario_id` y suma los fragmentos con su vector otra vez); `nova_antes_de_crear_usuario` (el gancho del tope, creado y probado, se activa en E20c-3); `nova_limpiar_registros` con el trabajo `nova-limpieza` (8:00 UTC, 3:00 a. m. de Bogotá). Ninguna función se puede llamar desde la API pública.
- **Acceso:** el middleware solo exige la sesión; `exigirSesion` y el layout de Nova leen `cuentas` en cada pedido (`leerCuenta`, que de paso anota el último acceso como mucho una vez por hora). Pendiente o bloqueada: la API responde 403 y las páginas llevan a `/cuenta`, que explica por qué y deja cerrar sesión; el inicio de sesión también lo dice y no deja la sesión abierta. Bloquear además prohíbe la cuenta en Supabase Auth (`ban_duration`).
- **404 de verdad:** con `loading.tsx`, un `notFound()` de la página llega con 200; el middleware pasa la ruta (`x-nova-ruta`) y el layout de Nova responde 404 en "Administración" a quien no es administrador.
- **Un administrador solo actúa sobre usuarios:** para bloquear o eliminar a un administrador, el dueño primero le quita el nivel. "Nombrar administrador", como bloquear, pide confirmación.
- **Filtro "Pendientes"** además de los de B-104.
- **"Activas · 7 días"** sale del último acceso, que no guarda historia: la tarjeta dice "de N cuentas" en lugar de la variación frente a la semana anterior. "Nuevas esta semana" sí la tiene.
- **Tope de espacio (RB-85)** ya se exige: al pedir el permiso de subida, al indexar y antes de cada parte (también en segundo plano). Los administradores y el dueño no tienen tope.
- **Clave del proyecto:** `puedeUsarClaveProyecto` = dueño o `usa_clave_proyecto` con la cuenta activa; al cambiar el permiso, la instancia olvida la clave resuelta (las demás, a más tardar en 5 minutos).
- **Las 4 cuentas que ya existían** (además del dueño) quedaron `activa` y nivel usuario, como se aprobó: en la vista previa ya entran a Nova (en producción manda la lista de correos de master).
- **Pruebas:**
  - `npm test` 1545 de 1545 (nuevas: `reglas/cuentas`, `servidor/sesion` reescrita, `servidor/administracion`, `servidor/administracionRutas`, `interfaz/administracion`), `eslint` sin errores (3 advertencias de antes) y build correcto.
  - `db:verificar` 0 fallas, con la sección 6t (eq a fi).
  - Edge (`ui_e20c2.mjs`), 33 de 33, con dos cuentas temporales y sin `SUPABASE_ADMIN_EMAILS`: nacen pendientes; la pendiente no entra y ve su mensaje; la administradora (nombrada en la base) ve el panel, habilita, bloquea con la confirmación y desbloquea; con la sesión abierta, el pedido siguiente al bloqueo responde `CUENTA_BLOQUEADA` y la página lleva a `/cuenta`; bloqueada no entra; la cuenta normal no ve el menú, la página da 404 y la API 403 sin datos; eliminar, nombrar, topes y bloquear al dueño dan "No tienes permiso para esto."; el registro de acciones; 1280 px claro y 393 px oscuro (tarjetas) sin desborde. Las cuentas y sus filas del registro se borraron al final.
  - Sin conexión: `ui_e20sin` 16 de 16, `ui_e19b` 12 de 12 y `ui_e11e` 34 de 34.
  - `master` desde una copia temporal: `db:verificar` y `probar:rag` con 0 fallas.
- **Sin probar en Edge (lo prueba el usuario como dueño):** eliminar una cuenta, guardar los topes, nombrar y quitar administradores y el permiso de la clave del proyecto (cubiertos por las pruebas automáticas con la base simulada).
- **Probado por el usuario sin fallas** (2026-11-25, PC e iPhone). Eliminó desde "Administración" sus 4 cuentas de prueba; comprobado: en Supabase Auth queda solo su cuenta, ninguna de las 28 tablas con `usuario_id` (ni `users`, `profiles` ni los fragmentos) conserva filas de ellas, sin sesiones ni identidades sueltas, Blob vacío (los PDF se borran al leerlos) y las 4 eliminaciones en `acciones_admin` a nombre del dueño.

#### Cambio de dirección de producción (2026-11-25, pedido del usuario antes de E20c-3)

- **Nueva:** `https://novaassistantjc.vercel.app`. El usuario la agregó en Vercel (Production) y puso `https://nova-assistantsm-kappa.vercel.app` con "Redirect to" 308. En Supabase: Site URL nueva y Redirect URLs con la nueva, la vista previa y `http://localhost:3000`.
- **Hecho por Claude:** `APP_URL` en Production (los enlaces de recuperación de `master` usan `obtenerUrlBase`) y `vercel redeploy` del mismo despliegue de producción (`master` sin cambios, `d175142`); el contacto de las notificaciones push (`SUJETO_POR_DEFECTO`) con la dirección nueva en `ampliacion`.
- **Comprobado:** la vieja responde 308 a la nueva conservando la ruta y los parámetros (`/login`, `/nova/tareas?vista=hoy`); en la nueva, sin sesión, `/` y `/nova` llevan a `/login`, `/api/nova/tareas` responde 401, `/login`, `/register`, `/recuperar-contrasena` y `/api/health` responden 200 y el inicio de sesión contesta "Correo o contraseña incorrectos." a una contraseña equivocada.
- **Aviso de cada minuto:** sigue llamando a la vista previa (producción no tiene la ruta); pasa a la dirección nueva en E21, TAREA 6 (decidido con el usuario).
- **Lo que le toca al usuario:** iniciar sesión en la dirección nueva. No hay que reinstalar la app ni volver a activar notificaciones: hoy están en la vista previa.

#### E20c-3: entrar con Google, registro y contraseña temporal (2026-11-25)

- **Pasos externos:** dados al usuario al empezar (cliente OAuth en Google Cloud, proveedor Google y gancho "Before User Created" en Supabase), para que los hiciera mientras se programaba.
- **Código:** `/auth/google`, `/auth/callback` (reescrito), `EntrarConGoogle` y `LogoGoogle`, `/register` y `/recuperar-contrasena` nuevos, `/cambiar-contrasena` con `FormularioContrasenaNueva`, `POST /api/cuenta/contrasena`, `src/lib/datos/contrasenas.ts`, `darContrasenaTemporal` con `POST /api/nova/administracion/cuentas/[id]/contrasena-temporal`, "Contraseña temporal" en la tabla de cuentas, `vencerContrasenasTemporales` en el aviso de cada minuto y "Poner una contraseña nueva" en Configuración → Sesión. Sin migración (las columnas son de M25).
**Cómo quedó E20c-3 (2026-11-25), decisiones de detalle:**
- **"Entrar con Google":** `/auth/google` (enlace normal, sin JavaScript) pide a Supabase la dirección con PKCE y `prompt=select_account`; `/auth/callback` cambia el código por la sesión y va a `/nova` (solo destinos dentro de `/nova`); con error vuelve a `/login?error=google` y, si el gancho rechazó por el tope, a `/login?error=tope` con el texto de RB-81. "Por si acaso": una cuenta nueva de Google que igual pasó el tope se borra al volver. La cuenta de Google nace `activa` (disparador de M25). El logo de Google lleva sus colores (`LogoGoogle.tsx`, única excepción a "solo tokens").
- **Registro:** `/register` ya no tiene formulario (`Para crear tu cuenta, usa "Entrar con Google".`) y `POST /api/auth/register` responde 403 con ese texto en `ampliacion`. En producción (`master`) el control de registro se activa solo con el aviso al usuario; se desactiva en un minuto con "Instant Rollback" del despliegue anterior en Vercel.
- **"¿Olvidaste tu contraseña?":** explica las dos salidas (Google y la contraseña temporal del administrador); el formulario de correo queda en el código para el día que haya dominio.
- **Contraseña temporal (RB-91):** `darContrasenaTemporal` (administradores y el dueño, solo a usuarios activos), 16 caracteres sin los que se confunden, en Supabase Auth y nunca en la base; se muestra una vez en un diálogo con "Copiar". Al entrar con ella: `temporal_usada_en` se marca en un solo `UPDATE` (dos ingresos a la vez: uno gana); un segundo ingreso o una vencida se rechazan con su texto; mientras tanto todo responde `DEBE_CAMBIAR_CONTRASENA` y las páginas llevan a `/cambiar-contrasena`. El aviso de cada minuto (`vencerContrasenasTemporales`) reemplaza las vencidas sin usar por una al azar; `temporal_vence_en` queda para decir "venció" si alguien la intenta.
- **Cerrar la sesión al rechazar un ingreso:** con `scope: 'local'` (solo la de ese pedido). El `signOut()` por defecto de Supabase es global y cortaba la sesión de quien estaba poniendo su contraseña (lo encontró la prueba en Edge).
- **Contraseña nueva:** `POST /api/cuenta/contrasena` (fuera de `/api/nova`, para la cuenta que debe cambiarla); no pide la anterior tras la temporal ni si la sesión entró con Google (`amr` del token, `Sesion.conGoogle`); si no, la verifica. Configuración → Sesión tiene "Poner una contraseña nueva".
- **Pruebas:**
  - `npm test` 1570 de 1570 (nuevas: `servidor/contrasenaTemporal`, `interfaz/accesoGoogle` y casos en `reglas/cuentas`, `servidor/administracion` y `rutasRecordatorios`; el registro con correo de `auth.test` pasa a 403). Dos pruebas que importan mucho código (`arranque` y la primera del panel) pasaban de 5 s con toda la suite corriendo: tienen 20 y 15 s. `eslint` sin errores y build correcto.
  - Edge (`ui_e20c3.mjs`), 31 de 31, con dos cuentas temporales: la entrada con Google arriba y el aviso del tope; `/auth/google` lleva a Supabase con PKCE y la vuelta correcta; el registro sin formulario y su API sin crear cuentas; las dos salidas de la recuperación; la contraseña temporal dada desde Administración (texto exacto, no queda en ninguna tabla, desaparece al cerrar); la anterior deja de servir; con la temporal entra solo a `/cambiar-contrasena` y la API responde `DEBE_CAMBIAR_CONTRASENA`; un segundo ingreso se rechaza; al poner la propia entra a Nova y la temporal ya no sirve; Configuración pide la anterior; una vencida se rechaza; cada una queda en el registro; 393 y 1280 px sin desborde. Repetidas: `ui_e20c2` 33 de 33 y `ui_e20sin` 16 de 16.
- **Sin probar aquí:** entrar de verdad con una cuenta de Google (lo prueba el usuario con su segunda cuenta en el iPhone).
- **Prueba del usuario (2026-11-26):** sin fallas, junto con el cambio de dirección. Hizo los pasos de Google Cloud y Supabase (proveedor Google con un secreto nuevo, porque el primero quedó en una captura; gancho "Before User Created"). La app de Google queda en modo "Prueba" con sus dos cuentas hasta que `/privacidad` esté en producción (E21). Topes puestos en 15 cuentas y 30 MB (estaban en 10), con su fila en el registro.

#### Versión original de Nova: `v1-original` (2026-11-26, pedido del usuario)

- **Etiqueta:** `v1-original` (anotada) en el commit `d175142` de `master` ("docs: P00 a P11 completados"), subida a GitHub antes de tocar `master`.
- **Despliegue de producción con esa versión:** `https://nova-assistant-k6l8gi58e-dlrjuank.vercel.app` (id `dpl_8LhtFaRzp5fZXEYkZwmzCpxZTiHv`, creado el 2026-11-25 al poner `APP_URL`). La dirección propia de un despliegue pide iniciar sesión en Vercel (protección del proyecto): no es pública.
- **Para volver a mostrar v1-original:**
  1. **Si el despliegue sigue en Vercel** (Deployments, filtro Production, el de `d175142`): "⋯" → "Promote" (o "Instant Rollback") lo pone en `novaassistantjc.vercel.app`. Para volver a la versión de hoy, "Promote" del despliegue más reciente. Ojo: mientras tanto, producción es la original.
  2. **Si Vercel ya lo borró** (guarda los despliegues un tiempo limitado): `git worktree add ../nova-v1 v1-original`, y en esa carpeta `npx vercel deploy` (sin `--prod`, queda como vista previa con su propia dirección) o `npx vercel deploy --prod` para reemplazar producción.
- **Dirección pública fija para v1 (sin hacer, a la espera del usuario):** ver la respuesta del 2026-11-26 (alias de Vercel al despliegue; riesgos con la base compartida después de E21).

#### Control de registro en producción (2026-11-26, con el visto bueno del usuario)

- **Commit en `master`:** `6ce9a4d` (desde una copia aparte con `git worktree`): `/register` muestra `Por ahora las cuentas nuevas se crean con "Entrar con Google".` y `POST /api/auth/register` responde 403 sin crear cuentas (texto en `src/lib/auth/registro.ts`). 239 de 239 pruebas de `master` y build correcto.
- **Despliegue:** `https://nova-assistant-iyv8fch8v-dlrjuank.vercel.app`. Comprobado en `novaassistantjc.vercel.app`: `/register` con el aviso, la API de registro 403, `/login` carga, `/nova` sin sesión lleva a `/login` y una contraseña equivocada recibe "Correo o contraseña incorrectos.". Que la cuenta del usuario sigue entrando lo confirma él.
- **Para desactivarlo:** Vercel → Deployments → el despliegue `nova-assistant-k6l8gi58e` → "Instant Rollback".

#### Página pública de privacidad (adelantada de E21, 2026-11-26)

- `/privacidad` en `ampliacion`: qué guarda Nova, qué se envía a Gemini, a Google y a Wikipedia, cómo eliminar la cuenta y el contacto `nova.asistente.app@gmail.com` (decisión del usuario). Sin sesión (el middleware la deja pasar), con `LogoNova` y los tokens; enlace "Privacidad" bajo "Crear una cuenta" en el inicio de sesión. Prueba en `tests/interfaz/privacidad.test.tsx`.
- Va a `master` con E21 (decisión del usuario): hasta entonces la app de Google sigue en modo "Prueba".

### E20d Ampliación: más tipos de documento y OCR

#### E20d-1: Markdown y texto (2026-11-26)

- **M26:** respaldo antes (`respaldos/2026-11-26_150356`) y después (`2026-11-26_152352`); aplicada (`20261126100000_nova_tipos_documento.sql`). Los 4 documentos que había quedaron `pdf` por `pagina`. `db:verificar` sin fallas, con la sección 6u (fj–fn); desde la copia de `master` (`6ce9a4d`), `db:verificar` y `probar:rag` sin fallas; simulacro de restauración (`--probar`) correcto con los dos respaldos.
- **Código:** `tiposDocumento.ts`, `lectores/texto.ts`, `leerEstructura` en `documentos.ts`, `COLUMNAS_UNIDAD` en `fragmentos.ts` (también en "Buscar en", el plan de estudio y la explicación), `consultaLibro.ts` por unidad, `SelloDocumento`, filtro en Fuentes, "Ver contenido", cuestionarios y plan de lectura con la unidad.
- **Unidades sobre el modelo de páginas (M26):** `documentos.tipo` y `documentos.unidad` (`pagina`, `seccion`, `parte`, `diapositiva`), `capitulos.tipo` (`capitulo`, `seccion`, `parte`, `diapositiva`) y `fragmentos_pdf.ocr` (para E20d-3). `paginas`, `pagina_inicio`, `pagina_fin` y `etiqueta_paginas` cuentan la unidad; la etiqueta sigue siendo numérica ("3" o "3–4"), así "Buscar en", los cuestionarios por rango, el plan de lectura y las citas compactas sirven sin rehacerlos. Reglas en `src/lib/reglas/tiposDocumento.ts`; lectores en `src/lib/lectores/texto.ts`.
- **Markdown:** secciones por encabezado de `#` a `###` (sin contar los bloques de código); se corta en los dos niveles más altos que use el archivo (nivel 1 y 2 de `capitulos`), los más bajos quedan dentro. Lo de antes del primer título es la sección "Inicio". Sin encabezados, se lee como texto (por partes). Los títulos pierden el formato en línea (énfasis, código, enlaces).
- **Texto:** partes de hasta 1.500 palabras, cortadas antes del párrafo que las pasaría; un párrafo enorme se corta solo. UTF-8 y, si no lo es, Windows-1252 (Latin-1). Cada parte es un grupo "Parte N".
- **Citas:** la sección por su título ("Apuntes.md · Unidad 2"; lo da `COLUMNAS_UNIDAD` en las consultas de fragmentos: la sección que empieza en la primera unidad del fragmento), "parte 3", "diapositiva 7"; los PDF siguen con "p. 45".
- **Preguntas:** "sección 2", "parte 3" y "diapositiva 7" (en los documentos de esa unidad; con un PDF elegido siguen la consulta normal), "la sección sobre derivadas" por título; "página N" en un documento que no es PDF es su unidad N.
- **Fuentes:** la pestaña "Subir PDF" pasa a "Documentos", la columna "Páginas" a "Contenido" ("3 secciones"), "Ver capítulos" a "Ver contenido" (misma ruta `/nova/fuentes/[id]/capitulos`), y cada documento lleva el sello de su tipo (`SelloDocumento`, colores de las categorías). El filtro por tipo (`?tipo=`) aparece con dos tipos o más. Otro archivo responde `TIPO_NO_ADMITIDO`.
- **Cuestionarios y plan de lectura:** "Una sección", "Un rango de partes", "Desde la parte", "Secciones por semana"; la tarea de una sección, parte o diapositiva se titula "Leer: Derivadas".
- **Pruebas:** `npm test` 1591 de 1591 (nuevas: `reglas/lectoresTexto`, casos E20d en `servidor/documentos` y `servidor/consultaLibro`; ajustadas las de Fuentes por los textos nuevos). `eslint` sin errores y build correcto. Edge (`ui_e20d1.mjs`), 24 de 24, con una cuenta temporal y un Markdown y un texto sembrados por SQL: sellos, "3 secciones" y "2 partes", filtro, "Ver contenido", vista previa del plan por secciones, cuestionario por partes, el campo de archivo (.md sí, .heic no), `/privacidad` sin sesión y 393 y 1280 px sin desborde.
- **Sin probar aquí:** subir de verdad un .md o un .txt (pasa por Blob y Gemini): lo prueba el usuario.

#### E20d-2: Word y PowerPoint (2026-11-26)

- **Código:** `src/lib/lectores/office.ts` (`leerDocx`, `leerPptx`), `seccionesPorTitulos` compartida con el Markdown, `docx` y `pptx` en `tiposDocumento.ts`, `fflate` 0.8.2 en las dependencias. Sin migración (usa M26).
- **Lectura:** `src/lib/lectores/office.ts` con `fflate` 0.8.2 (solo se descomprimen los XML que hacen falta, con un tope de 60 MB inflados contra los ZIP trampa) y expresiones regulares sobre el XML; las imágenes de adentro no se leen.
- **Word:** párrafos, listas (con "• ") y tablas (cada fila, un párrafo con las celdas separadas por " | ") de `word/document.xml`. El nivel de cada título sale del estilo: `w:outlineLvl` en `styles.xml` (también por `basedOn`) o el nombre estándar "heading N", así sirve "Título 1" en un Word en español; o el `w:outlineLvl` del párrafo. Las secciones se cortan con la misma regla del Markdown (`seccionesPorTitulos`); sin títulos, por partes.
- **PowerPoint:** las diapositivas en el orden de `presentation.xml` (no el de los nombres de archivo), cada una con su título (marcador `title` o `ctrTitle`; si no tiene, "Diapositiva N"), su texto (también el de las tablas) y las notas del orador ("Notas: …"); el número, la fecha y el pie no cuentan. Cada diapositiva es un grupo de `capitulos`.
- **Fuentes:** el campo acepta .docx y .pptx (también por su tipo, para que el iPhone los ofrezca), con sus sellos Word (azul) y PowerPoint (ámbar) y en el filtro. Los .doc y .ppt antiguos se rechazan con `TIPO_NO_ADMITIDO`.
- **Pruebas:** `npm test` 1598 de 1598 (nuevas: `reglas/lectoresOffice` con un Word y un PowerPoint armados en la prueba, casos en `servidor/documentos` y `interfaz/SubidorPdf`). `eslint` sin errores y build correcto. Edge (`ui_e20d2.mjs`), 30 de 30: lo de E20d-1 más un PowerPoint y un Word sembrados (sellos, "2 diapositivas", filtro con los cuatro tipos, "Ver contenido" por diapositivas, cuestionario "Una diapositiva", el campo acepta .docx y .pptx).
- **Sin probar aquí:** un Word y un PowerPoint hechos con Office (las pruebas usan archivos armados con la estructura del estándar): lo prueba el usuario.
- **Pendiente:** la prueba del usuario de E20d-1 y E20d-2 juntas.

#### Filtros y pestañas sin subir la página (2026-11-26, pedido del usuario tras probar E20d-1 y E20d-2)

- **Qué pasaba:** al tocar un filtro que se queda en la misma pantalla (tipo en Fuentes, categorías y pestañas de Tareas, Materia, PDF/Web, semanas de Mi semana, meses del Calendario), la página subía. `scroll={false}` no alcanza: al llegar la vista nueva, Next enfoca el primer elemento de la página (`handlePotentialScroll`) y eso la sube; además Inicio colgaba directo del layout con el esqueleto de carga.
- **Qué se hizo:** `Pestanas` pone `scroll={false}` y anota la posición (`conservarScroll`, `src/lib/conservarScroll.ts`) solo si el enlace se queda en la misma ruta; las que van a otra pantalla (secciones de Semestre) siguen empezando arriba. Lo mismo en las flechas y "Hoy" de Mi semana y del Calendario y en la fila de categorías (también al renombrar o eliminar). `ConservarScroll` (en el layout de Nova) devuelve la página a su lugar antes de pintar. Inicio pasó a `src/app/nova/(inicio)/page.tsx` (la dirección sigue siendo `/nova`). Atrás lo maneja el navegador; sin conexión, los enlaces permitidos siguen con carga completa.
- **Pruebas:** `tests/interfaz/filtrosSinSubir.test.tsx` y las de categorías; Edge (`ui_scroll.mjs`): Fuentes, Tareas, Calendario y Mi semana quedan en la misma posición, Atrás vuelve al filtro anterior y Semestre → Objetivos empieza arriba. En Edge sin ventana, a veces un toque no navega (pasa igual sin estos cambios, en una copia limpia de la rama): la prueba lo repite.

### Ajuste: Sentry (2026-11-26, pedido del usuario)

- **Sentry:** organización `juank-ing`, proyecto `nova-assistant` (Next.js, región de EE. UU.). `NEXT_PUBLIC_SENTRY_DSN` (público) en Vercel Production y Preview; `SENTRY_AUTH_TOKEN` (Secret, lo puso el usuario) en Production y Preview para subir los mapas de código. Sin DSN (local y pruebas) Sentry queda apagado.
- **Código:** `@sentry/nextjs` 11.19; `src/instrumentation.ts` (solo el runtime de Node: `sentry.server.config.ts`, errores y 10 % de trazas) y `onRequestError`; `src/instrumentation-client.ts` carga el SDK con `import()` cuando el navegador queda libre (`requestIdleCallback`, 4 s como máximo), solo errores; `responderError` avisa los `ERROR_INTERNO` (la API los atrapa y no llegan solos); `src/app/global-error.tsx` ("Algo salió mal" + "Recargar"); `withSentryConfig` en `next.config.ts` con los mapas solo si hay `SENTRY_AUTH_TOKEN` (se suben y se borran del build) y `webpack.autoInstrumentMiddleware: false`.
- **Privacidad** (`src/lib/sentry/opciones.ts`): `sendDefaultPii: false`, sin usuario, el pedido solo con la dirección sin consulta y el método, sin migajas de la consola y sin `?…` en navegaciones y pedidos (`?pregunta=` lleva lo que se escribe). `/privacidad` lo explica. Lo vigila `tests/reglas/sentryOpciones.test.ts`.
- **Peso (decisión por la carga de E20b):** con el SDK cargado de entrada, lo compartido pasaba de 103 a 169 kB y el middleware de 95 a 152 kB. Con la carga diferida y sin Sentry en el middleware: compartido 104 kB, Inicio 132 kB (antes 130), middleware 100 kB. A cambio, un error del navegador en el primer segundo y los del middleware no llegan a Sentry (los del middleware se ven como 500 en Vercel).
- **Pruebas:** `npm test` 1604 de 1604, `tsc` sin errores nuevos (los 2 de `src/lib/__tests__/json-db.test.ts` ya estaban), eslint sin errores, build correcto.
- **Sin probar aquí:** que lleguen errores reales a Sentry: necesita un despliegue de `ampliacion` (sin commit ni push todavía).
- **Prueba en la vista previa (2026-11-26):** despliegue de `273cccb` READY con los mapas subidos (navegador, servidor y edge); compartido 105 kB y middleware 101 kB en Vercel. Errores de prueba en `/privacidad` (NOVA-ASSISTANT-1 a 3, resueltos). Sentry deducía la IP de la conexión: el usuario activó "Prevent Storing of IP Addresses" en la organización y el siguiente evento llegó sin IP. Queda el país y la ciudad aproximada (Sentry los calcula antes de borrar la IP): `/privacidad` lo dice (decisión del usuario).

#### E20d-3 y E20d-4: PDF escaneados y fotos con OCR (2026-11-26)

- **Prueba de E20d-1 y E20d-2 por el usuario:** sin fallas (los cuatro tipos, sellos, filtro, "Ver contenido", citas por diapositiva y por sección, .docx y .pptx desde Archivos en el iPhone). Confirmó que su cuenta sigue entrando en producción y que no quiere por ahora una dirección fija para v1 (grabará un video).
- **Código:** `src/lib/reglas/ocr.ts`, `src/lib/datos/ocr.ts`, `src/lib/datos/descargas.ts` (la descarga de Blob, compartida), `llm.leerArchivos` en `gemini.ts`, la detección en `extraer.ts`, la lectura en `documentos.ts` (`crearLecturaOcr`, `avanzarOcr`, `terminarLectura`, `responderOcr`, `vencerPreguntasOcr`, `iniciarFotos`), `POST /api/nova/documentos/[id]/ocr`, `masUrls` en `esquemaIndexar`, el aviso de cada minuto, `IndexacionPendiente` (pregunta y avance), `TablaDocumentos`, `SubidorPdf` (varias fotos) y `EtapasIndexacion` (`textoLeer`). `pdf-lib` 1.17.1 en las dependencias; `npm run probar:ocr`.
- **Sin migración nueva:** usa M26 (`fragmentos_pdf.ocr`, `documentos.tipo` `pdf_escaneado` e `imagen`). Lo que espera la lectura va en `documentos.por_indexar` como un objeto (`LecturaOcr` en `src/lib/reglas/ocr.ts`: estado `pregunta` o `leyendo`, las direcciones en Blob, el texto de cada página, las que faltan, las leídas y hasta cuándo se espera la respuesta); lo normal ahí sigue siendo la lista de fragmentos. `master` no usa esa columna.
- **Detección:** una página sin texto (menos de 20 caracteres) que pinta una imagen que cubre al menos el 30 % de la página (`inspectPages` de unpdf, en `src/lib/pdf/extraer.ts`). Una página en blanco o con un adorno no cuenta: un libro con páginas en blanco no pregunta.
- **La pregunta:** "Este PDF tiene 180 páginas escaneadas. Leerlas usa unas 18 consultas de tu clave de Gemini (unos 6 minutos). ¿Leerlas?" (fotos: "Estas 5 fotos se leen con OCR…"), con "Leerlas" y "Ahora no", en Fuentes (`IndexacionPendiente`); la fila dice "Espera tu respuesta". Mientras espera, nada gasta consultas: ni la pantalla ni el aviso de cada minuto toman el documento.
- **"Leerlas":** cada parte lee un grupo de hasta 10 páginas o fotos (y hasta 12 MB) con `llm.leerArchivos` (el PDF del grupo, separado con `pdf-lib` 1.17.1, o las fotos, en el mismo pedido; transcripción literal con `[ilegible]`). Lo leído se guarda en cada grupo; al terminar se arman los fragmentos (los que tocan una página leída llevan `ocr`), los capítulos (PDF) y sigue la indexación de siempre. Si la cuota se agota, queda en pausa y sigue después. La pantalla muestra "Leyendo con OCR… 10 de 20 páginas" y la etapa "Leer con OCR". El aviso de cada minuto también avanza (45 s por grupo).
- **"Ahora no" (o 24 horas sin respuesta, con el aviso de cada minuto):** se indexa solo lo que tenía texto; sin texto (todo escaneado, o fotos), el documento no se guarda y se avisa. En todos los casos el PDF o las fotos se borran de Blob; también al eliminar un documento que esperaba.
- **Topes:** 300 páginas escaneadas por PDF, 30 fotos por documento, 15 MB por archivo.
- **Fotos (E20d-4):** .jpg, .jpeg y .png (el iPhone convierte las HEIC a JPEG). Varias fotos elegidas juntas son un solo documento, con "Título del documento" (por defecto, el nombre de la primera) y una página por foto; un PDF con fotos juntos se rechaza. Tipo `imagen`, sello "Foto".
- **Citas:** "Libro.pdf · p. 45 (escaneada)".
- `PDF_SIN_TEXTO` pasa a decir "El documento no tiene texto ni páginas escaneadas que leer."
- **Pruebas:** `npm test` 1628 de 1628 (nuevas: `reglas/ocr` con un PDF real de texto, escaneada y en blanco armado con pdf-lib; `servidor/ocr` con la pregunta, "Leerlas", "Ahora no", el avance por grupos, el vencimiento, el borrado y las fotos; `interfaz/ocrPantalla`). `eslint` sin errores y build correcto. `npm run probar:ocr` con Gemini real, una vez (dos llamadas): detecta solo la página escaneada, la lee exacta ("PAGINA ESCANEADA NOVA LEE PDF") y lee la foto; la foto dio "AP NTES" porque a la fuente de píxeles del script le faltaba la U (Gemini copió fielmente lo dibujado; se agregó la U y no se repitió para no gastar cuota). Edge (`ui_e20d34.mjs`), 14 de 14, con dos documentos sembrados que esperan la respuesta: la pregunta con su estimación, "Espera tu respuesta" en la lista, el campo con varias fotos y su título, "Ahora no" en las fotos y en un PDF todo escaneado (no se guardan y lo dicen), 393 y 1280 px sin desborde. Corregido en la ronda: el aviso "no se guardó" no se veía mientras quedaba otra pregunta; el ciclo de avance se reiniciaba con cada `router.refresh()`.
- **Revisión (agente revisor) y correcciones:** confirmó que sin respuesta no se gasta cuota, que `master` no lee `por_indexar` y que la ruta solo toca documentos propios. Corregido: (1) un grupo que falla siempre ya no se reintenta sin fin ni frena a los demás: los fallos que no son de cuota se cuentan (`fallos`) y al quinto termina con lo leído; un archivo que ya no se puede leer termina enseguida; en segundo plano, tras un fallo el documento espera 10 minutos; (2) el tope de 12 MB por llamada también vale para los PDF (el grupo se parte a la mitad) y una foto que no cabe queda sin texto en vez de fallar; el navegador rechaza fotos de más de 12 MB; (3) si falla la subida de una de varias fotos, el servidor borra las que alcanzaron a subir (`descartar`); (4) una lectura que no avanza en 7 días (`avanzoEn`) termina con lo leído; (5) "Ahora no" y el vencimiento solo terminan si sigue esperando la respuesta; (6) las fotos se descargan de a una hasta el tope. `npm test` final: 1633 de 1633; Edge 14 de 14.
- **Sin probar aquí:** subir de verdad un PDF escaneado y fotos y leerlos de punta a punta en la vista previa (pasa por Blob y por la clave de Gemini del usuario): lo prueba el usuario.
- **Pendiente:** la prueba del usuario de E20d-3, E20d-4 y la corrección de los filtros, juntas.

#### Ajuste de E20d-4 tras la prueba del usuario (2026-11-26)

- **OCR de una foto real** (una libreta desde el iPhone): el Asistente encontró una palabra puesta en la foto. Funciona.
- **Título de una sola foto:** el campo "Título del documento" salía solo con 2 fotos o más, y con una quedaba el código al azar del iPhone (`6dcfab87-….jpeg`). Ahora se pide con cualquier foto, y si el nombre es de la cámara (código, `IMG_1234`, `20261126_…`) se propone "Foto del 26 de noviembre" / "Fotos del …" (`tituloPorDefecto` en `SubidorPdf.tsx`).
- **"Ver contenido" de una foto** decía "No encontré capítulos en este PDF". Ahora: "Las fotos no tienen capítulos. Pregúntale al Asistente por lo que dicen." (`MENSAJE_FOTOS_SIN_CAPITULOS`), y el mensaje general dice "documento" en vez de "PDF".
- **Pruebas:** `npm test` 1636 de 1636, `tsc` sin errores nuevos, eslint sin errores. Sin build local (otra sesión trabaja en Nova).

#### Ajuste: texto de las fotos y "Buscar en" con muchos documentos (2026-11-26, pedido del usuario)

- **"Ver contenido" de las fotos** muestra lo que Nova leyó en cada una ("Foto N", o "No encontré texto en esta foto."): `textoDePaginas` en `src/lib/datos/documentos.ts` arma el texto de cada página con `soloTextoDePagina` (sin repetir el solapamiento), comprueba el dueño (RB-01), no muestra nada mientras se indexa (`progreso`) y tiene tope de 30 páginas. El texto se ve en un solo párrafo: los fragmentos no guardan los saltos de línea.
- **"Buscar en" del Asistente:** con más de 5 documentos aparece "Buscar documento" (`src/lib/reglas/buscarEn.ts`): filtra por título sin tildes ni mayúsculas, con todas las palabras en cualquier orden, elige el primero que coincide y el elegido no se pierde aunque no coincida. Enter o "Listo" cierra el teclado sin enviar la pregunta. Los documentos van agrupados por tipo (PDF, Word, PowerPoint, Fotos, Markdown, Texto) y web, Wikipedia e IA en "Otras fuentes" (`Selector` admite `grupo` → `<optgroup>`). Se sigue usando el selector nativo, que en el iPhone abre la rueda del sistema.
- **Revisor:** 5 puntos, corregidos: Enter enviaba el formulario, la palabra "nombre" en el campo (Safari ofrece contactos), texto a medias mientras se indexa, `whitespace-pre-line` sin efecto y la ayuda sin contar el elegido.
- **Pruebas:** `npm test` 1645 de 1645 (nuevas: `reglas/buscarEn`, casos en `interfaz/Chat` y `servidor/documentos`), `tsc` sin errores nuevos, eslint sin errores. Sin build local.
