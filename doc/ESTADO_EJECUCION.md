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

