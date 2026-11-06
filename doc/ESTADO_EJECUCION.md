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
