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
| P09 Aceptación del MVP | pendiente | | | |
| P10 Opcionales: completar tarea e índice | pendiente | | | |
| P11 Opcional: búsqueda en Wikipedia | pendiente | | | |

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
