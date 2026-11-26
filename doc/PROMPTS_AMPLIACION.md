# Prompts de la ampliación · Nova Assistant

Etapas E00 a E21 (más E02b, E02c, E05b, E06b, E20b y E20c, pedidas por el usuario, y las demás con letra que se agregaron después, como E10g) para ejecutar `doc/PLAN_AMPLIACION.md`, en orden de dependencias. Cada etapa es pequeña, se puede probar sola y termina en un commit en la rama `ampliacion`. Se ejecuta una etapa por vez y se espera la confirmación del usuario antes de la siguiente.

## Reglas de todas las etapas

Estas reglas se aplican a cada prompt sin repetirlas:

1. Antes de escribir código, leer `CLAUDE.md`, `doc/PLAN_AMPLIACION.md` (las secciones que nombra la etapa), `doc/ESTADO_EJECUCION.md` y el código que se va a tocar.
2. Trabajar en la rama `ampliacion`. Nunca commit ni push a `master`.
3. Migraciones solo aditivas, con `npm run db:migrar` (usa `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`). Tras cada migración: `npm run db:verificar` y la prueba de compatibilidad con `master` (plan, 11.3).
4. Tablas nuevas con `usuario_id`, RLS activo sin políticas y permisos revocados a `anon` y `authenticated`. Toda consulta filtra por el usuario de la sesión.
5. Mensajes exactos de `PLAN_AMPLIACION.md` sección 8 y de `PLAN_NOVA.md` sección 5.1, textuales.
6. Sin botones muertos: una sección entra al menú solo cuando existe.
7. Funciona en 1280 px y en 390 px, con teclado y en claro y oscuro (desde E02).
8. Verificación: pruebas nuevas de la etapa; `npm test`, `npm run build` y `eslint` sin errores; navegador real si la etapa tiene interfaz (si Edge no arranca, verificación por HTTP y avisar).
9. Al terminar: commit en `ampliacion` (sin `.env.local`, `.env.respaldo.local` ni `doc/CORREO RESEND VERCEL CONNECT (1).md`), push de `ampliacion`, confirmar que el despliegue de vista previa termina sin errores y dar su URL.
10. Actualizar `CLAUDE.md` (etapa completada) y `doc/ESTADO_EJECUCION.md` (tabla y bitácora). Decir qué debe probar el usuario en el teléfono y esperar su confirmación.

---

## E00 · Rama y vista previa

**Plan:** secciones 1 y 13.

```text
OBJETIVO: dejar lista la rama y comprobar que la vista previa de Vercel funciona con el código actual, antes de cambiar nada.

TAREA 1. Confirmar que la rama ampliacion existe, viene de master y no tiene cambios de código.
TAREA 2. Listar por NOMBRE (sin valores) las variables de entorno de Vercel en Preview y compararlas con las que usa el código (README). Si falta alguna, decir cuál y en qué entorno agregarla; no agregarla sin permiso.
TAREA 3. Hacer push de ampliacion y esperar el despliegue de vista previa. Comprobar /api/health, /login y que /nova redirige al login.
TAREA 4. Averiguar si la vista previa tiene protección de Vercel (pide iniciar sesión en Vercel) y explicarle al usuario cómo entrar desde el teléfono.

VERIFICACIÓN: el usuario entra a la vista previa desde el teléfono con su cuenta y ve el Asistente actual.
```

**Commit:** `docs: plan y prompts de la ampliación` (solo los dos documentos nuevos).

---

## E01 · Dueño en tareas, documentos y fuentes web

**Plan:** 1, 6.1, 11.3, RB-01. **Requisito:** E00.

```text
OBJETIVO: que tareas, documentos y fuentes web tengan dueño sin romper el código de master, que sigue en producción con la misma base.

TAREA 1. Migración M5 según la sección 6.1: tabla nova_config con el dueño por defecto (el id en auth.users del correo incorporado en src/modules/auth/admin.ts; si no existe, la migración falla con un mensaje claro), columna usuario_id nullable en tareas_personales, documentos y fuentes_web, relleno de lo existente, disparador BEFORE INSERT que completa el dueño cuando falta, índices y la función buscar_fragmentos_usuario. No tocar buscar_fragmentos ni ninguna columna existente.
TAREA 2. Código: crearTarea, listarTareas, completarTarea, eliminarTarea, tareasPendientesComoTexto, indexarDocumento, listarDocumentos, existenDocumentos, eliminarDocumento, recuperarFragmentos (con buscar_fragmentos_usuario), calcularProductividad y buscarEnWikipedia (RN-05 por usuario y categoría) reciben el id del usuario de la sesión y filtran por él. Un id de otro usuario se comporta como inexistente.
TAREA 3. Ampliar db:verificar: columnas, disparador (un INSERT sin usuario_id queda con el dueño por defecto) e índices.
TAREA 4. Prueba de compatibilidad (plan, 11.3): git worktree de master en una carpeta temporal, instalar dependencias, correr su npm run probar:rag y su npm run db:verificar contra la base migrada; deben dar 0 fallas. Borrar el worktree.
TAREA 5. Pruebas: aislamiento entre dos usuarios en cada servicio (datos simulados) y probar:rag del código nuevo.

AL TERMINAR: decirle al usuario qué casos de A-01 a A-21 repetir en PRODUCCIÓN (al menos A-02, A-05, A-06, A-10, A-12, A-15, A-16, A-17, A-18 y A-21) y B-01.
```

**Commit:** `feat(datos): dueño por usuario en tareas, documentos y fuentes web`

---

## E02 · Diseño base

**Plan:** 3. **Requisito:** E01.

```text
OBJETIVO: nueva identidad visual de Nova sin cambiar comportamiento.

TAREA 1. Tokens de la sección 3.1 en globals.css para claro y oscuro (clase en <html>), con un script mínimo en el <head> que aplica el tema guardado (o el del sistema, "automático") antes de pintar. Sin selector todavía: la preferencia la cambia Configuración en E11.
TAREA 2. Prueba de contraste: lee los tokens y comprueba ≥ 4,5:1 en cada par texto/fondo en ambos modos y en los 8 colores de categoría. Ajustar los valores hasta que pase.
TAREA 3. Instalar lucide-react. Actualizar Boton, Campo, Selector, Tarjeta, Insignia, Aviso y EstadoVacio a los tokens nuevos (redondeo, sombra suave, foco con el acento, transiciones cortas con prefers-reduced-motion). Crear EncabezadoPantalla (título, subtítulo, acción principal) y Pestanas (píldoras, con la pestaña en la URL).
TAREA 4. Aplicar EncabezadoPantalla a las pantallas existentes. Ningún color suelto fuera de los tokens (comprobarlo con una búsqueda).

VERIFICACIÓN: todas las pantallas actuales en claro y oscuro, a 1280 y 390 px; A-01 a A-21 siguen funcionando (pruebas y probar:rag).
```

**Commit:** `feat(diseño): paleta cálida, modo claro y oscuro y componentes base`

---

## E02b · Asistente sin documentos (pedida por el usuario)

**Plan:** 5.2, RB-30, B-43; cambia A-13. **Requisito:** E02.

```text
OBJETIVO: que el Asistente responda con las tareas pendientes aunque no haya documentos.

TAREA 1. consultar: con documentos, igual que hoy; sin documentos y con tareas pendientes, contexto solo con las tareas (sin vector, sin filtro por palabras); sin ninguno, SIN_DOCUMENTOS. Mensajes exactos sin cambios.
TAREA 2. Al modelo van como máximo las 50 tareas pendientes de fecha límite más próxima (TAREAS_CONTEXTO_MAX), con prueba.
TAREA 3. Pantalla del Asistente: aviso informativo aprobado cuando hay tareas y no documentos; el aviso de siempre cuando no hay ninguno.
TAREA 4. Pruebas de los cuatro casos; probar:rag: paso 9 según RB-30 y paso 11 con Gemini real.
TAREA 5. Anotar el cambio de A-13 en doc/ACEPTACION.md.

VERIFICACIÓN: B-43 y A-13 (nuevo resultado) en la vista previa.
```

**Commit:** `feat(asistente): responder con tareas aunque no haya documentos`

---

## E02c · Fecha de hoy y preguntas por fechas (pedida por el usuario)

**Plan:** RB-31, B-44. **Requisito:** E02b.

```text
OBJETIVO: que el Asistente sepa qué día es en Bogotá y responda "esta semana", "mañana" o "qué vence primero" con las tareas.

TAREA 1. lineaHoy en src/lib/reglas/fechas.ts (hoy, mañana y semana lunes-domingo con America/Bogota explícita) y primera línea del contexto, con y sin documentos.
TAREA 2. Cada tarea del contexto con su fecha límite AAAA-MM-DD; regla de fechas en el System Prompt ("No tienes tareas para {periodo}." y la más próxima); palabras semana, mañana, hoy y vencid en RN-12.
TAREA 3. Pruebas: relojes fijos, incluido el caso de noche en Bogotá con UTC en el día siguiente; contexto; System Prompt; palabras clave. probar:rag paso 12 con Gemini real.

VERIFICACIÓN: B-44; A-01 a A-21 y B-43 siguen pasando.
```

**Commit:** `feat(asistente): fecha de hoy y preguntas por fechas en el contexto`

---

## E03 · Navegación

**Plan:** 4. **Requisito:** E02.

```text
OBJETIVO: barra lateral en computador y barra inferior con "Más" y botón "+" en el teléfono.

TAREA 1. Mover el chat a /nova/asistente sin cambiar su comportamiento. /nova pasa a ser Inicio en versión mínima: solo el bloque "Pregúntale a Nova" (envía la pregunta al Asistente, que la manda al cargar, una sola vez).
TAREA 2. Barra lateral (≥ 1024 px) y barra inferior (< 1024 px) según 4.2 y 4.3, con solo las secciones que existen hoy: Inicio, Asistente, Tareas, Documentos, Web y Productividad (Documentos y Web se unen en Fuentes en E10). La barra inferior ocupa con secciones existentes los lugares de las que aún no existen.
TAREA 3. Hoja "Más" accesible (Escape, botón Cerrar, tocar fuera, foco atrapado y devuelto) y botón "+" con "Nueva tarea" y "Subir documento" (oculto en el Asistente).
TAREA 4. Pruebas de interfaz de la navegación (ítem activo con aria-current, hoja Más, botón +).

VERIFICACIÓN: A-01 (/nova sin sesión → login) y el login lleva a Inicio; B-05 a B-09 con las secciones existentes.
```

**Commit:** `feat(interfaz): navegación lateral e inferior, Inicio mínimo`

---

## E04 · Login con el mismo estilo

**Plan:** 3.2. **Requisito:** E02.

```text
OBJETIVO: login, registro y recuperación de contraseña con el estilo nuevo, sin tocar su lógica ni sus rutas.

TAREA 1. Reestilizar src/app/login, register, recuperar-contrasena y restablecer-contrasena y sus componentes de src/components/login con los tokens y componentes nuevos, marca "Nova", en claro y oscuro.
TAREA 2. Confirmar que las pruebas existentes del login (src/modules/auth/auth.test.ts y similares) pasan sin cambios.

VERIFICACIÓN: iniciar sesión, error de contraseña y recuperar contraseña en 390 px.
```

**Commit:** `feat(diseño): login y registro con el estilo de Nova`

---

## E05 · Categorías

**Plan:** 6.2, 3.1 (paleta), RB-02 a RB-04. **Requisito:** E03.

```text
OBJETIVO: categorías de tareas con color, administradas desde Configuración.

TAREA 1. Migración M6 (categorias) con siembra desde las categorías ya usadas en tareas y "General".
TAREA 2. Servicio y API de categorías (listar, crear, renombrar actualizando las tareas en la misma transacción, cambiar color, eliminar pasando sus tareas a General) con los mensajes RB-02 a RB-04.
TAREA 3. /nova/configuracion con el bloque Categorías (entra al menú). Selector de color con los 8 de la paleta, cada uno con su nombre.
TAREA 4. InsigniaCategoria con punto de color y nombre; usarla en la lista de Tareas actual.

VERIFICACIÓN: B-18.
```

**Commit:** `feat(categorias): categorías de tareas con color`

---

## E05b · Categorías dentro de Tareas (pedida por el usuario)

**Plan:** 5.4, RB-33, B-18, B-46. **Requisito:** E05.

```text
OBJETIVO: manejar las categorías sin salir de Tareas, sin pantallas nuevas.

TAREA 1. Fila de categorías arriba de Tareas ("Todas", "General", las del usuario, "+ Nueva"), deslizable en el teléfono; filtra por ?categoria= conservando el estado.
TAREA 2. "+ Nueva" y el menú de cada categoría ("⋯", presión larga, clic derecho) en un diálogo: renombrar, cambiar color, eliminar con confirmación; General "Por defecto", solo color. Usa la API de E05.
TAREA 3. RB-33 en el servidor (resolverCategoria) y crearTarea en una transacción.
TAREA 4. Quitar Categorías de Configuración y Configuración del menú hasta E11.
TAREA 5. Aviso del proveedor solo en el Asistente (completo) y bajo "Pregúntale a Nova" (línea corta).

VERIFICACIÓN: B-18 y B-46; las pruebas pendientes de E05 (tarea con categoría, renombrar con otro color, eliminar y pasar a General, General sin "Eliminar").
```

**Commit:** `feat(categorias): categorías dentro de Tareas`

---

## E06 · Inicio

**Plan:** 5.1, 7.1. **Requisito:** E05.

```text
OBJETIVO: Inicio completo.

TAREA 1. Reglas puras de semana (lunes a domingo en Bogotá) y de progreso semanal, con pruebas (incluido el borde del domingo a medianoche y total 0).
TAREA 2. GET /api/nova/semana?inicio= con las tareas de la semana y los contadores.
TAREA 3. Vista Mi semana (7 columnas en computador, selector de días en teléfono, flechas de semana), Progreso semanal (anillo accesible con su porcentaje en texto) y Prioridades de hoy con vencidas y "Agregar".
TAREA 4. La casilla de una tarea pendiente abre el diálogo de minutos de AccionesTarea (reutilizar el componente, no copiarlo).

VERIFICACIÓN: B-09 a B-12.
```

**Commit:** `feat(inicio): semana, progreso semanal y prioridades de hoy`

---

## E06b · Horario de las tareas (pedida por el usuario)

**Plan:** 6.10 (M14), RB-34, B-47. **Requisito:** E06.

```text
OBJETIVO: hora de inicio y de fin opcionales en las tareas, en 24 horas, antes del Calendario.

TAREA 1. Respaldo y migración M14 (hora_inicio, hora_fin con su CHECK); prueba en seco; db:verificar y compatibilidad con master.
TAREA 2. Reglas puras (validarHorario, formatearHorario, compararPorHorario) con los mensajes exactos de RB-34.
TAREA 3. Servicio: crear con horario, listar ordenado por hora, texto del Asistente con el horario.
TAREA 4. Formulario con "Desde" y "Hasta" (selector de hora del navegador); horario en Mi semana (ordenado por hora), Prioridades de hoy y Tareas.
TAREA 5. Pruebas; probar:rag paso 14 ("¿qué tengo a las 3?") con Gemini real.

VERIFICACIÓN: B-47.
```

**Commit:** `feat(tareas): horario opcional de las tareas`

---

## E07 · Calendario

**Plan:** 5.3. **Requisito:** E06.

```text
OBJETIVO: calendario mensual con las tareas.

TAREA 1. GET /api/nova/calendario?mes=YYYY-MM (tareas del mes agrupadas por día con su categoría y color). Deja preparado el lugar para los eventos de Semestre (E13), sin datos falsos.
TAREA 2. Vista mensual (lunes primero, flechas, "Hoy", puntos por categoría con máximo 3 y "+N", leyenda), lista del día elegido con completar (mismo diálogo) y "Agregar tarea".
TAREA 3. El formulario de tarea acepta ?fecha=YYYY-MM-DD válida (se ignora si no lo es).
TAREA 4. Calendario entra al menú y a la barra inferior.

VERIFICACIÓN: B-13 y B-14.
```

**Commit:** `feat(calendario): vista mensual con tareas por categoría`

---

## E08 · Tareas con pestañas y categorías

**Plan:** 5.4. **Requisito:** E05.

```text
OBJETIVO: pestañas Todas / Hoy / Importantes / Completadas y agrupación por categoría.

TAREA 1. Filtros en el servicio (por URL ?vista=) con pruebas.
TAREA 2. Agrupación por categoría con punto de color y contador completadas/total dentro de la pestaña.
TAREA 3. Formulario: selector de categorías existentes y opción de escribir una nueva (se crea con el siguiente color libre).
TAREA 4. Conservar completar y eliminar con sus mensajes (A-16, CU-07).
TAREA 5. (Decidido en E08) Marca sutil "Vencida" (rojo suave) en las tareas pendientes con fecha pasada, en Mi semana y en Tareas. "N tareas vencidas" de Inicio lleva a la vista "Vencidas" de Tareas.

VERIFICACIÓN: B-16, B-17, B-48 y B-49; A-02 a A-05 siguen pasando.
```

**Commit:** `feat(tareas): pestañas y agrupación por categoría`

---

## E09 · Editar tareas

**Plan:** 5.4 (Editar), RB-29. **Requisito:** E08.

```text
OBJETIVO: poder corregir una tarea pendiente (título, categoría, prioridad y fecha límite) con las mismas validaciones de crear. Va antes de que el plan de estudio pueda crear tareas (E19).

TAREA 1. Servicio editarTarea(usuario, id, datos): solo tareas pendientes del usuario; reutiliza el esquema y las reglas de crear (RN-01, RN-03, RN-04, RN-07), no las copia. No toca estado, minutos ni fecha de cierre. Completada → TAREA_YA_COMPLETADA; de otro usuario o inexistente → TAREA_NO_ENCONTRADA.
TAREA 2. PATCH /api/nova/tareas/[id] (DELETE y completar no cambian).
TAREA 3. /nova/tareas/[id]/editar con FormularioTarea en modo edición (lleno, botón "Guardar cambios", "Cancelar" vuelve sin cambiar nada). Si la categoría escrita es nueva, se crea como al crear (E08).
TAREA 4. Acción "Editar" en cada tarea pendiente de Tareas, Inicio y la lista del día del Calendario; las completadas no la muestran.
TAREA 5. Pruebas (plan, 11.1, Editar tareas) de servicio, ruta e interfaz.

VERIFICACIÓN: B-41 y B-42; A-02 a A-05 y A-16 siguen pasando.
```

**Commit:** `feat(tareas): editar tareas pendientes`

---

## E10 · Fuentes

**Plan:** 5.5, 4.4. **Requisito:** E03.

```text
OBJETIVO: Documentos y Búsqueda web en una sola sección.

TAREA 1. /nova/fuentes con pestañas "Subir PDF" y "Buscar en la web", reutilizando SubidorPdf, TablaDocumentos, EliminarDocumento y BuscadorWeb.
TAREA 2. Redirecciones permanentes de /nova/documentos, /nova/documentos/nuevo y /nova/web a la pestaña correcta. Fuentes reemplaza a Documentos y Web en el menú; el botón "+" → "Subir documento" lleva a la pestaña PDF.

VERIFICACIÓN: B-19 y B-20; A-06 a A-08, A-18 y A-21.
```

**Commit:** `feat(fuentes): documentos y búsqueda web en una sección`

---

## E10b · Libros: páginas y capítulos (pedida por el usuario, 2026-11-07)

**Plan:** 5.9, 6.11, RB-36 a RB-38. **Requisito:** E10.

```text
OBJETIVO: que cada fragmento sepa su página, detectar los capítulos y aguantar libros largos.

TAREA 1. Respaldo y migración M15 (documentos.paginas/progreso/por_indexar, fragmentos_pdf.pagina_inicio/pagina_fin/etiqueta_paginas, capitulos). Compatibilidad con master (11.3).
TAREA 2. Extraer por página con unpdf (sin mergePages) y las etiquetas de página; fragmentar por palabras (RN-10) guardando el rango de páginas de cada fragmento. Pruebas S-33 a S-36.
TAREA 3. Capítulos: índice interno del PDF (con la página final de cada uno) y, si no hay, encabezados al comienzo de página; nunca inventar (RB-37).
TAREA 4. Indexación por partes que se puede reanudar (POST .../continuar), "Indexando… %" en Fuentes y límite de 800 páginas (RB-38). Las citas muestran la página en todo el Asistente (RB-36).
TAREA 5. Fuentes: "Ver capítulos" con títulos y páginas. Script probar:libro (parte de páginas y capítulos).

VERIFICACIÓN: B-50; A-06 a A-12 y A-21 siguen pasando.
```

**Commit:** `feat(fuentes): páginas y capítulos de los libros`

---

## E10b2 · Fuentes web guardadas (pedida por el usuario, 2026-11-09)

**Plan:** 5.5, RB-54. **Requisito:** E10.

```text
OBJETIVO: ver y eliminar las fuentes web, para no quedar bloqueado al llegar a 20 por categoría.

TAREA 1. Servicios y API para listar y eliminar, con aislamiento por usuario (RB-54).
TAREA 2. En la pestaña "Buscar en la web", "Fuentes guardadas" por categoría con su cupo, enlace, resumen, fecha y "Eliminar" con confirmación; se actualiza al buscar y al eliminar.
TAREA 3. El aviso del tope de 20 indica que se pueden eliminar en esa lista.

VERIFICACIÓN: B-67.
```

**Commit:** `feat(fuentes): ver y eliminar las fuentes web guardadas`

---

## E10c · Libros en el Asistente (pedida por el usuario, 2026-11-07)

**Plan:** 5.9, RB-39 a RB-41. **Requisito:** E10b.

```text
OBJETIVO: preguntar por página o capítulo y pedir otra explicación.

TAREA 1. Selector "Buscar en" (Todos los documentos o uno) encima del campo del Asistente. Migración M19 (mensajes_chat.contexto), con respaldo y compatibilidad con master (11.3).
TAREA 2. Reglas puras para reconocer página y capítulo (S-37 a S-39); consulta directa por página o capítulo, sin vector, con citas de página (RB-39, RB-40). Las reglas de RB-30 a RB-32 no cambian.
TAREA 3. "Explicar de otra manera" bajo las respuestas con citas: 5 modos, mismos fragmentos, mismas citas, historial (RB-41).
TAREA 4. probar:rag y probar:libro con Gemini real (pregunta por página, capítulo y "Más simple").

VERIFICACIÓN: B-51 a B-53; B-43 a B-45 siguen pasando.
```

**Commit:** `feat(asistente): preguntas por página y capítulo y explicar de otra manera`

---

## E10c2 · Wikipedia y fuentes guardadas en "Buscar en" (pedida por el usuario, 2026-11-09; rehecha el mismo día)

**Plan:** 5.5, 5.9, 6.14, 6.17, RB-55, RB-56, RB-58, RB-61. **Requisito:** E10c y E10b2, y `probar:rag` con 0 fallas en la rama y con el código de `master`.

```text
OBJETIVO: guardar solo lo que sirve y poder preguntarle al Asistente por eso. "Guardar" va primero: con guardado automático, cada búsqueda de prueba terminaría en las respuestas del Asistente.

TAREA 0. Scripts de prueba: guardar los embeddings fuera de git y reutilizarlos solo si coinciden el texto, el modelo y la dimensión (sección 13). Sin cambios en el código de producción.
TAREA 1. Respaldo y migraciones M18 (fuentes_web.vector y buscar_fuentes_web_usuario) y M21 (mensajes_chat.origen). Compatibilidad con master (11.3). Historial solo del mismo origen (RB-61). Pruebas S-64.
TAREA 2. "Wikipedia" en "Buscar en" (RB-58): responde con el resumen y los enlaces, sin guardar. "Guardar fuente" con la categoría, el tope de 20 y sin duplicar (RB-55); POST /api/nova/web/fuentes. Pruebas S-60.
TAREA 3. "Fuentes web" en "Buscar en": responde solo con las guardadas y las cita con su enlace (RB-56). Un embedding al guardar; las guardadas antes se vectorizan la primera vez que se busca. Pruebas S-61.
TAREA 4. Fuentes queda con Subir PDF y Fuentes guardadas; ?pestana=web abre Fuentes guardadas. Actualizar A-18 en doc/ACEPTACION.md.
TAREA 5. probar:rag una sola vez con Gemini real (pregunta sobre una fuente guardada y su cita).

VERIFICACIÓN: B-19, B-68, B-69 y B-71; A-18 con "Guardar fuente".
```

**Commit:** `feat(fuentes): wikipedia y fuentes guardadas en el asistente`

---

## E10c3 · IA general en "Buscar en" (pedida por el usuario, 2026-11-09)

**Plan:** 5.9, 6.17, RB-59 a RB-61. **Requisito:** E10c2.

```text
OBJETIVO: poder preguntar algo general sin que parezca salido de los documentos.

TAREA 1. "IA (conocimiento general)" en "Buscar en": solo modelo de chat, sin embeddings y sin documentos, tareas ni fuentes en el prompt (RB-59). Guardar origen "ia". Pruebas S-65 y S-66.
TAREA 2. Tipo de mensaje propio con la marca exacta "Respuesta general de la IA, sin fuentes. Compruébala si es importante.", sin citas ni "Explicar de otra manera", también al recargar.
TAREA 3. "Preguntarle a la IA" solo bajo "No encontré" (RB-60). Pruebas S-67.

VERIFICACIÓN: B-72 y B-73.
```

**Commit:** `feat(asistente): preguntas generales a la IA con marca visible`

---

## E10d · Plan de lectura por capítulos (pedida por el usuario, 2026-11-07)

**Plan:** 5.9, RB-42. **Requisito:** E10b.

```text
OBJETIVO: convertir capítulos en tareas con fecha.

TAREA 1. Regla pura del reparto (entre dos fechas o N por semana), con pruebas S-40 y S-41.
TAREA 2. En "Ver capítulos": elegir capítulos y fechas, vista previa con "Leer cap. N: Título (pp. a–b)" y su fecha, confirmar; crea las tareas en una transacción (categoría con RB-33, prioridad 2) y marca capitulos.tarea_id. Un capítulo ya en Tareas no se repite.

VERIFICACIÓN: B-54; las tareas aparecen en Inicio, Calendario y Tareas.
```

**Commit:** `feat(fuentes): plan de lectura por capítulos`

---

## E10e · Cuestionarios (pedida por el usuario, 2026-11-09)

**Plan:** 5.11, 6.13, 7.11, 9.6, RB-48 a RB-52. **Requisito:** E10b.

```text
OBJETIVO: practicar con preguntas de selección múltiple que salen del documento.

TAREA 1. Respaldo y migración M17 (cuestionarios, preguntas_cuestionario, intentos_cuestionario, respuestas_intento). Compatibilidad con master (11.3).
TAREA 2. Reglas puras: contexto y mínimo de texto, validación de 9.6, barajar opciones y puntaje de 7.11. Pruebas S-51 a S-57.
TAREA 3. Generar con Gemini (JSON y esquema, nuevo método en src/lib/llm con pruebas), máximo 2 llamadas; RB-49 y RB-52.
TAREA 4. API con aislamiento por usuario; la respuesta correcta no sale antes de responder (RB-50, RB-51).
TAREA 5. Pantallas: "Crear cuestionario" en Fuentes y en "Ver capítulos"; /nova/cuestionarios/[id] con una pregunta por pantalla, opciones grandes, resultado con el puntaje y las falladas, "Repetir solo las que fallé" y "Hacer de nuevo". 390 y 1280 px, claro y oscuro, "reducir movimiento".
TAREA 6. Script probar:cuestionario con Gemini real.

VERIFICACIÓN: B-60 a B-64.
```

**Commit:** `feat(cuestionarios): generar y responder cuestionarios`

---

## E10f · Historial de cuestionarios y repaso (pedida por el usuario, 2026-11-09)

**Plan:** 5.11, RB-53. **Requisito:** E10e.

```text
OBJETIVO: ver si mejoro y convertir lo que fallo en una tarea.

TAREA 1. /nova/cuestionarios: intentos por documento y por capítulo, con fecha, dificultad, puntaje y comparación con el intento anterior; los repasos dicen "Repaso". Pruebas S-58 y S-59.
TAREA 2. En el resultado, sugerir "Repasar cap. N: Título (pp. a–b)" con 2 o más falladas de un capítulo: diálogo con fecha y categoría (RB-33), sin duplicar (RB-53).
TAREA 3 (pedida por el usuario, 2026-11-12). Enlace a los cuestionarios desde Fuentes y desde "Ver capítulos", para volver a abrir uno ya creado.

VERIFICACIÓN: B-65 y B-66.
```

**Commit:** `feat(cuestionarios): historial y tarea de repaso`

---

## E11 · Configuración completa

**Plan:** 5.8, 6.3, RB-11, RB-25 a RB-28. **Requisito:** E05.

```text
OBJETIVO: el resto de Configuración.

TAREA 1. Migración M7 (preferencias_usuario) y GET/PATCH /api/nova/configuracion.
TAREA 2. Perfil: nombre (public.users.full_name), correo de solo lectura, cambiar contraseña con la ruta existente /api/auth/password y sus mensajes.
TAREA 3. Apariencia: claro, oscuro, automático; se guarda en la base y en el navegador (el script del <head> de E02 la usa). Formato de hora: 24 horas (por defecto) o 12 horas (pedido del usuario en E06b); formatearHorario lo respeta en toda la app.
TAREA 4. Académico: escala 0,0 a 5,0 solo lectura; nota para aprobar; redondeo truncar/redondear (truncar por defecto); cortes por defecto: la plantilla que se usa al dividir una materia en cortes (aquí sí deben sumar 100 % para guardar).
TAREA 5. Asistente: aviso de que las preguntas y los fragmentos se envían a Gemini; "Borrar historial" con confirmación (RB-25) → DELETE /api/nova/conversaciones.
TAREA 6. Cerrar sesión.

VERIFICACIÓN: B-03, B-22 y B-23.
```

**Commit:** `feat(configuracion): perfil, apariencia, académico y asistente`

---

## E11b · App instalable (PWA) (pedida por el usuario, 2026-11-07)

**Plan:** 5.10, 10, RB-62, RB-63. **Requisito:** E11.

```text
OBJETIVO: que Nova se pueda agregar a inicio como una app, antes de los recordatorios (en el iPhone, las notificaciones solo funcionan así, iOS 16.4 o más reciente).

TAREA 1. src/app/manifest.ts (nombre "Nova", display standalone, start_url /nova, colores de los tokens), íconos 192, 512, maskable y apple-touch-icon (provisionales; los finales en E20b), metadatos de Apple en el layout. El middleware deja públicos el manifiesto, los íconos y el service worker.
TAREA 2. public/sw.js registrado solo dentro de /nova. Primero la red; sin conexión, la última copia de Inicio, Tareas, Calendario del mes actual y capítulos (RB-62). Nunca Asistente, API de escritura ni texto de documentos.
TAREA 2b. Aviso "Sin conexión · datos de las HH:MM" y controles desactivados. Borrado de la copia según RB-63: cerrar sesión, sesión rechazada por el servidor, otro usuario y 7 días sin respuesta válida. Pruebas S-68 y S-69.
TAREA 3. Configuración → "Instalar Nova" con la guía para iPhone (Safari › Compartir › Agregar a inicio) y Android (Instalar app o el botón cuando Chrome lo ofrece); si ya está instalada, lo dice.

VERIFICACIÓN: B-55, B-74, B-75 y B-76; Lighthouse sin errores de instalabilidad.
```

**Commit:** `feat(app): Nova instalable y consulta sin conexión`

---

## E11c · Recordatorios con notificaciones push (pedida por el usuario, 2026-11-07)

**Plan:** 5.9, 5.10, 6.12, 7.10, RB-43 a RB-45, RB-57. **Requisito:** E11b y E09.

```text
OBJETIVO: avisos como los de cualquier app, a la hora elegida.

TAREA 1. Respaldo y migración M16; claves VAPID en Vercel (Production y Preview) y en .env.local; librería web-push. Compatibilidad con master (11.3).
TAREA 2. Regla pura de la hora del recordatorio (7.10) y del texto (RB-44), pruebas S-42 a S-49.
TAREA 3. Campo "Recordatorio" en crear y editar (opciones según haya horario); recalcular al editar, cancelar al completar o eliminar.
TAREA 4. Suscripción: "Activar notificaciones" solo por acción del usuario (RB-45), guía de E11b en el iPhone sin instalar, "Enviar una de prueba"; Configuración → Notificaciones con la hora fija.
TAREA 5. Tick cada minuto (pg_cron + pg_net + Vault) con la ventana de 30 min sin envíos dobles; borrar suscripciones vencidas (404/410). Service worker: mostrar, numerito (setAppBadge), abrir /nova/tareas?tarea=<id> y resaltarla.
TAREA 6. Indexación en segundo plano (RB-57): el tick avanza una parte del libro a medias más antiguo, sin esperar la cuota, y la tarjeta cambia su aviso a "Puedes cerrar esta pantalla: seguirá sola." Pruebas S-62 y S-63.
TAREA 7. probar:recordatorios; prueba real en el iPhone y en Android del usuario (pantalla de bloqueo, banner, centro de notificaciones, numerito y sonido: se anota lo que hace iOS).

VERIFICACIÓN: B-56, B-57 y B-70.
```

**Commit:** `feat(recordatorios): notificaciones push de las tareas`

---

## E11d · Resumen diario y "Agregar a mi calendario" (pedida por el usuario, 2026-11-07; sin correo desde el 2026-11-09)

**Plan:** 5.10, RB-46, RB-47. **Requisito:** E11c.

```text
OBJETIVO: un resumen por la mañana y que el teléfono pueda poner su propia alarma.

TAREA 1. Resumen diario opcional por notificación (hora en Configuración), uno por día, solo si hay tareas de hoy o vencidas.
TAREA 2. GET /api/nova/tareas/[id]/ics y botón "Agregar a mi calendario", con la alarma del recordatorio (S-50).

VERIFICACIÓN: B-58 y B-59.
```

**Commit:** `feat(recordatorios): resumen diario y calendario del teléfono`

---

## E11e · Crear tareas sin conexión (pedida por el usuario, 2026-11-13)

**Plan:** 5.13, 6.19, 7.14, RB-70 a RB-75. **Requisito:** E11d.

```text
OBJETIVO: poder anotar una tarea sin conexión y que llegue sola al servidor, una sola vez, cuando vuelva la conexión.

TAREA 1. Respaldo y migración M23 (tareas_personales.id_cliente con índice único parcial por usuario). Compatibilidad con master (11.3).
TAREA 2. POST /api/nova/tareas acepta idCliente: ON CONFLICT DO NOTHING y, si ya existía, devuelve la misma tarea sin repetir categoría ni recordatorio (7.14). Pruebas S-76.
TAREA 3. El formulario de nueva tarea, con su copia, disponible sin conexión (RB-62 y la lista del service worker); al guardar sin conexión o con falla de red, la tarea queda en IndexedDB a nombre del usuario, con el tope de 50 (RB-70). Pruebas S-77.
TAREA 4. Las pendientes en Tareas, Inicio (Mi semana y Prioridades de hoy) y Calendario con la insignia "Pendiente de enviar", sin casilla y con "Descartar" (RB-71).
TAREA 5. Envío al volver la conexión, al abrir con conexión y cada 30 s mientras queden: en orden, una pestaña a la vez (Web Locks) y según el resultado de 7.14; aviso al terminar y pantallas actualizadas (RB-72). Recordatorio calculado por el servidor y aviso si ya pasó (RB-73). Rechazadas con "Corregir" y "Descartar" (RB-74). Pruebas S-78 y S-79.
TAREA 6. Cerrar sesión con pendientes: aviso, y al confirmar se borran con la copia de RB-63; las de otro usuario nunca se envían (RB-75). Pruebas S-80.
TAREA 7. Edge con la base real: crear sin conexión, dos pestañas al volver, rechazo, cerrar sesión. Prueba del usuario en el iPhone (app instalada) y el PC.

VERIFICACIÓN: B-82 a B-86.
```

**Commit:** `feat(tareas): crear tareas sin conexión`

---

## E10g · Tipos de pregunta en los cuestionarios (sugerida por un amigo del usuario, aprobada el 2026-11-13)

**Plan:** 5.12, 6.18, 7.12, 7.13, 9.7, RB-64 a RB-69. **Requisito:** E10f. **Se hace después de E11d.**

```text
OBJETIVO: elegir el tipo de preguntas al crear un cuestionario, sin gastar más llamadas a Gemini.

TAREA 1. npm run db:respaldar y migración M22 (6.18), aditiva: tipo en cuestionarios y preguntas, columnas de cada tipo y de las respuestas, y CHECK por tipo. Las filas existentes quedan como selección única, con sus puntos. db:verificar con las restricciones nuevas y compatibilidad con master.
TAREA 2. Reglas puras: puntos de cada tipo y puntaje (7.12), comparación de completar (7.13), reparto de mixto (RB-64), validación de cada tipo y frase con _____ armada por el servidor (9.7). Pruebas S-70 a S-73.
TAREA 3. Generación: un solo pedido con la cantidad de cada tipo y esquema JSON con tipo; segunda llamada solo por lo que falta de cada tipo; como máximo 2.
TAREA 4. Responder según el tipo (RB-65 a RB-69) y la ruta de autoevaluación de la abierta. La vista no adelanta ninguna respuesta (RB-50). "Repetir solo las que fallé", el historial y la tarea de repaso cuentan como falladas las de menos de 1 punto. Pruebas S-74 y S-75.
TAREA 5. Pantallas: "Tipo de preguntas" en el formulario (Mixto por defecto); una pantalla por tipo, cómoda en el teléfono; resultado con "a medias"; el tipo en el historial.
TAREA 6. probar:cuestionario con un mixto de 5 y Gemini real (una sola ejecución).

VERIFICACIÓN: B-77 a B-81, y que los cuestionarios anteriores siguen funcionando igual (B-60 a B-66).
```

**Commit:** `feat(cuestionarios): tipos de pregunta`

---

## E12 · Semestre: materias, componentes y notas

**Plan:** 5.7, 6.4, 7.2 a 7.4, RB-05 a RB-10, RB-13, RB-35. **Requisito:** E11.

```text
OBJETIVO: el modelo de la calculadora de notas y sus cálculos puros, con una pantalla para registrar datos.

TAREA 1. Migración M8 (materias con usa_cortes, cortes con fecha, componentes, notas, documentos.materia_id). Una materia sin cortes tiene un corte único oculto de 100 %. Al crear una materia: su corte único y una categoría con su nombre.
TAREA 2. Reglas puras en src/lib/reglas/notas.ts, con enteros en centésimas y fracciones exactas: mostrar (truncar/redondear), aprueba (con el valor mostrado), peso de cada nota (p / N), nota actual (lo que falta no cuenta como 0), asegurado, peso pendiente, definitiva, estado y avisos de suma. Pruebas S-01 a S-12b (plan, 11.1), con el ejemplo de 7.4.
TAREA 3. Servicios y API de materias (dividir en cortes y quitarlos, RB-35), cortes (en bloque; aviso RB-07), componentes (aviso RB-08, RB-10) y notas (RB-09; nota vacía = "sin nota"), con aislamiento por usuario.
TAREA 4. /nova/semestre (entra al menú) con la pestaña "Materias y notas": crear, editar y eliminar (con confirmación) materias, cortes, componentes y notas; agregar varias notas a un componente, también "sin nota"; avisos de suma visibles.

VERIFICACIÓN: B-24 a B-27.
```

**Commit:** `feat(semestre): materias, componentes y notas`

---

## E13 · Semestre: calculadora de notas

**Plan:** 5.7, 7.4 a 7.6, RB-12, RB-18. **Requisito:** E12.

```text
OBJETIVO: la calculadora de notas en pantalla ("nota actual" y "¿Cuánto necesito?") y el promedio; llevar las fechas al Calendario y las materias a Fuentes.

TAREA 1. Reglas puras de "¿Cuánto necesito?" (con lo asegurado y el peso pendiente, 7.5) y promedio por créditos. Pruebas S-13 a S-21, con el ejemplo de 7.5.
TAREA 2. Tarjetas de materia con nota actual y estado. Detalle con la nota de cada corte (si hay cortes), la nota actual, lo asegurado y la calculadora: campo "Nota meta" (por defecto la nota para aprobar, RB-18, no se guarda) y los mensajes de RB-12 (necesitas x, ya asegurado, o imposible con el máximo). Con sumas que no son 100 %, solo la nota actual y el aviso. Promedio del semestre arriba.
TAREA 3. Calendario: cortes y notas con fecha como eventos (ícono propio, enlace a la materia).
TAREA 4. Fuentes: al subir un PDF se puede elegir una materia como categoría (documentos.materia_id); la lista la muestra.
TAREA 5. Script npm run probar:semestre (plan, 11.2) con el ejemplo hecho a mano de 7.4 y 7.5.

VERIFICACIÓN: B-15, B-21 y B-28 a B-31.
```

**Commit:** `feat(semestre): calculadora de notas`

---

## E14 · Fallas

**Plan:** 6.5, 7.7, RB-14, RB-15. **Requisito:** E13.

```text
TAREA 1. Migración M9 (fallas_limite, fallas_registradas).
TAREA 2. Regla pura de fallas con pruebas S-22 a S-24.
TAREA 3. En la materia: límite y registradas editables, botones +1/−1, alerta RB-14; la tarjeta muestra el estado; perdida por fallas cuenta como en riesgo.

VERIFICACIÓN: B-32.
```

**Commit:** `feat(semestre): fallas con alerta`

---

## E15 · Metas semanales en Productividad

**Plan:** 6.6, 7.8, RB-16, RB-17. **Requisito:** E05.

```text
TAREA 1. Migración M10 (metas_semanales).
TAREA 2. Regla pura del progreso semanal por fecha de cierre, con pruebas S-25 a S-28.
TAREA 3. API y sección "Metas semanales" en Productividad: crear (tareas o tiempo, global o por categoría), ver progreso de la semana actual, eliminar con confirmación. Explicar en pantalla que las metas usan la fecha en que se completó la tarea.

VERIFICACIÓN: B-33; A-17 sigue pasando.
```

**Commit:** `feat(productividad): metas semanales`

---

## E16 · Objetivos: metas de nota

**Plan:** 6.7, 7.9, RB-18. **Requisito:** E13.

```text
TAREA 1. Migración M11 (metas_nota).
TAREA 2. Pestaña "Objetivos y plan" en Semestre: por materia y corte, meta de nota con la fecha del corte, y "¿Es alcanzable?" (regla 7.9). Metas de corte solo en materias con cortes; en una sin cortes, la meta es de la materia. La meta guardada es el valor inicial del campo "Nota meta" de la calculadora (E13).

VERIFICACIÓN: B-34.
```

**Commit:** `feat(semestre): metas de nota y si son alcanzables`

---

## E17 · Temas del corte

**Plan:** 6.8, 9.1, RB-19, RB-21. **Requisito:** E16.

```text
TAREA 1. Migración M12 (temas).
TAREA 2. Temas manuales (nacen confirmados), editar y eliminar.
TAREA 3. "Proponer temas desde un PDF": búsqueda vectorial limitada al documento elegido, llamada a Gemini con JSON y esquema (nuevo método en src/lib/llm, con pruebas), validación de que cada fuente es una etiqueta entregada; se guardan como propuestos. Confirmar o descartar cada uno.
TAREA 4. Un PDF de prueba con temas conocidos para la verificación real.

VERIFICACIÓN: B-35.
```

**Commit:** `feat(semestre): temas del corte manuales y propuestos`

---

## E18 · Plan de estudio con el asistente

**Plan:** 6.9, 9.2 a 9.4, RB-19, RB-20, RB-22, RB-23. **Requisito:** E17.

```text
TAREA 1. Migración M13 (planes_estudio, versiones_plan, pasos_en_tareas).
TAREA 2. Generar: contexto según 9.2, Gemini con JSON y esquema, validación de 9.3 en una función pura con pruebas S-29 a S-32 (tema no confirmado, fuente inventada, fecha fuera de rango, plan válido), un reintento y PLAN_INVALIDO. Los ids de los pasos los pone el servidor.
TAREA 3. Vista del plan por semanas y días, con las citas de cada paso.
TAREA 4. Editar (título, fecha, minutos, borrar, agregar con un tema confirmado) → versión manual; lista de versiones; restaurar → versión nueva.
TAREA 5. Huella y aviso RB-23 con la lista de cambios y "Actualizar plan".
TAREA 6. Script npm run probar:plan (plan, 11.2) con Gemini real.

VERIFICACIÓN: B-36 a B-38.
```

**Commit:** `feat(semestre): plan de estudio con versiones`

---

## E19 · Pasar pasos del plan a Tareas

**Plan:** 9.5, RB-24. **Requisito:** E18 y E09.

```text
TAREA 1. POST de pasar a tareas: crea la tarea (fecha del paso, categoría de la materia, prioridad 2) y registra pasos_en_tareas en una transacción; segunda vez → RB-24.
TAREA 2. Botón por paso con diálogo de confirmación; el paso queda marcado "En Tareas" con enlace, también en versiones nuevas.

VERIFICACIÓN: B-39; la tarea aparece en Inicio, Calendario y Tareas.
```

**Commit:** `feat(semestre): pasar pasos del plan a tareas`

---

## E19b · Semestre sin conexión (propuesta del 2026-11-17, aprobada por el usuario el 2026-11-18)

**Plan:** 5.10 (Semestre sin conexión), RB-62, RB-63, RB-87, S-89, B-102. **Requisito:** E19 y E11b.

```text
TAREA 1. paginaGuardable (public/sw-reglas.js) y rutaConCopia (src/lib/reglas/sinConexion.ts) con /nova/semestre, /nova/semestre/[id] y /nova/semestre/objetivos (con y sin ?materia=); la prueba que exige que coincidan.
TAREA 2. Sin conexión, todo lo que escribe datos en Semestre queda desactivado con "Necesitas conexión para esto." (notas, fallas, componentes, cortes, metas, temas, proponer, generar o editar el plan, pasar a Tareas). La Calculadora sigue si calcula solo en el navegador: comprobarlo y marcarla como permitida. Las pestañas de materias llevan a la copia de cada una.
TAREA 3. La pantalla sin copia que necesita conexión dice qué sí se puede ver (RB-87).
TAREA 4. Pruebas del service worker y de las reglas (S-89); en Edge: cargar con conexión, cortar la red, ver las tres pantallas, los controles desactivados y la Calculadora, 390 px.

VERIFICACIÓN: B-102 (en el iPhone con la app instalada, en modo avión).
```

**Commit:** `feat(sin-conexion): consultar Semestre sin conexión`

---

## E20 · Estadísticas

**Plan:** 5.7, 7.4, 7.7. **Requisito:** E14.

```text
TAREA 1. GET /api/nova/estadisticas (notas por corte de cada materia, nota actual, riesgo por nota o por fallas).
TAREA 2. Pestaña Estadísticas: evolución por corte, comparación entre materias y lista de materias en riesgo, con gráficos SVG propios accesibles (título, descripción y tabla equivalente), en claro y oscuro y a 390 px.

VERIFICACIÓN: B-40.
```

**Commit:** `feat(semestre): estadísticas`

---

## E20b · Diseño final: darle vida a Nova (pedida por el usuario; versión completa del 2026-11-07)

**Cuándo:** al terminar todas las etapas de funciones (después de E20) y antes de la aceptación (E21), para que la aceptación final se haga con el diseño nuevo. **Requisito:** E20.

Texto del usuario, tal como lo pidió (reemplaza a la primera versión):

```text
Etapa E20b: diseño final, darle vida a Nova

Objetivo: hoy la app funciona bien, pero se ve simple y plana. Quiero que se sienta viva, moderna y agradable de usar. Toma el estilo de las referencias, no sus colores: mantén la identidad de Nova (crema y terracota en claro, su modo oscuro).

Referencias:

El video de ejemplo que te paso ("Dashboard V22"): panel con tarjetas tipo mosaico, barra lateral de íconos, números grandes y animaciones suaves al pasar el mouse.
La cuenta de Instagram @code.xr (React + Framer Motion): sobre todo los menús con indicador animado ("Glassy Navigation Tabs"), los paneles con gráficos ("Dashboard V21/V22") y el login animado ("Lamp Toggle Login Form"). Si no puedes ver los videos, te paso los que me interesen.
La imagen del planificador de tareas que te paso (Mi semana, Progreso semanal, Prioridades de hoy y Mis tareas por categoría).

Prioridad 1: que se sienta viva
Navegación animada: en la barra inferior del teléfono, en la barra lateral del computador y en pestañas como Todas, Pendientes y Completadas, la opción activa tiene una píldora que se desliza al cambiar.
Entrada de pantallas: las tarjetas aparecen escalonadas y suaves al abrir cada pantalla.
Respuesta al usuario: al pasar el mouse, las tarjetas suben un poco y ganan sombra; en el teléfono, una respuesta sutil al tocar botones y tarjetas.
Números y progreso: los números cuentan hasta su valor y el anillo de progreso se llena al aparecer.
Completar una tarea: una pequeña celebración (check animado, un destello) sin exagerar.
Transiciones: suaves al cambiar de semana, de filtro o de categoría, y al abrir menús, hojas y diálogos.
Estados vacíos: con ícono o ilustración y un texto amable, en vez de "Sin tareas" plano.
Saludo en Inicio: según la hora ("Buenos días", "Buenas tardes") con un resumen corto del día.
Login con personalidad: una entrada animada inspirada en el "Lamp Toggle Login Form", adaptada a los colores de Nova.

Prioridad 2: el diseño
Inicio en mosaico ("bento"): bloques de distintos tamaños bien alineados (Pregúntale a Nova, Mi semana, Progreso, Prioridades y, si aporta, horas dedicadas en la semana con los minutos registrados).
Números grandes como protagonistas, con texto pequeño de apoyo.
Gráficos más vistosos en Productividad (líneas, barras y anillos animados).
Bordes más redondeados, sombras suaves, más espacio entre bloques y degradados sutiles con los colores de Nova.
Íconos con fondo de color en los encabezados de las tarjetas, y más presencia de los colores de las categorías.
Efecto vidrio (fondo translúcido con desenfoque) solo en pocos lugares, como la barra inferior o los menús flotantes, cuidando el contraste y el rendimiento.
Barra lateral del computador más pulida, que se pueda plegar a solo íconos. En el teléfono se mantiene la barra inferior.

Reglas que no se negocian
Igual de bien en claro y oscuro, a 390 px y a 1280 px, sin desborde.
Con "reducir movimiento" activado, nada se anima: todo aparece directo.
Rendimiento: debe sentirse fluido en un teléfono normal. Nada de animaciones pesadas ni librerías grandes sin necesidad. Si propones una (por ejemplo framer-motion), justifícala y dime cuánto pesa.
Accesibilidad: buen contraste, foco visible, campos de al menos 16 px y botones fáciles de tocar.
Solo cambia la presentación: lógica, rutas, datos y pruebas existentes siguen igual.
No toques master hasta que yo lo apruebe.

Cómo trabajar
Propuesta primero, sin tocar el código: cómo quedaría Inicio (captura o maqueta en claro y oscuro, teléfono y computador), la lista de animaciones y la librería que usarías. Espera mi aprobación.
Pantalla por pantalla: Inicio, Tareas, Calendario, Asistente, Documentos, Productividad, Web, Configuración y login. Un commit por pantalla, con vista previa y una lista corta de qué probar en el teléfono.
Anota en el plan lo que decidas y avísame antes de pasar a la siguiente pantalla.
```

**Commits:** uno por pantalla (Inicio, Tareas, Calendario, Asistente, Documentos, Productividad, Web, Configuración y login), cada uno con su vista previa y su lista corta de pruebas en el teléfono.

**Pendiente anotado el 2026-11-13 (pedido del usuario al cerrar E11b), para E20b o el cierre (E21):** revisar cómo bajar el tiempo de carga de cada pantalla, hoy ≈ 550 ms medidos en local (la señal de carga ya sale al instante). Casi todo es el servidor: la sesión se consulta a Supabase Auth en el middleware y otra vez en la pantalla, y las consultas a la base van en serie. Medición y detalle en `ESTADO_EJECUCION.md`, "E11b: rapidez al cambiar de pestaña".

**Anotado el 2026-11-16 (pedido del usuario al cerrar E14): la propuesta parte de `doc/DISENO_PRESENTACION.md`.** Ese archivo recoge los detalles de la página de presentación del usuario: la paleta "noche de estudio", las tipografías (Bricolage Grotesque, Instrument Sans y JetBrains Mono), el logo con halo, las animaciones y los detalles en funciones que ya existen (su sección 2). La presentación solo tiene modo oscuro, así que la propuesta también debe traer el modo claro, con los colores pasando `tests/reglas/contraste.test.ts` en los dos. Lo de su sección 3 que cambia el comportamiento también va en E20b, salvo que el usuario pida alguno antes:
- la respuesta palabra por palabra (streaming desde Gemini);
- las preguntas sugeridas;
- la cita desplegable con el fragmento;
- las etapas de indexación visibles;
- "Faltan N" en el progreso semanal;
- la casilla con el color de la categoría.

Esos seis no son "solo presentación": cada uno lleva sus pruebas y se avisa antes de hacerlo.

**Decidido el 2026-11-18 (el usuario eligió "Con el video", no el "Plan anterior"): E20b parte del prototipo interactivo `doc/PROTOTIPO_DISENO.html`** (React con JSX, 7 pantallas; se abre en el navegador y arriba tiene el selector de versión). La decisión y cada ejemplo del video están en `doc/DISENO_PRESENTACION.md` (secciones "Decisión del usuario" y 4). Lo que se lleva a Nova:
- barra lateral de cristal con el perfil arriba, submenú de Semestre (Materias y notas, Objetivos y plan) y una tarjeta de aviso abajo (próximo corte, tarea vencida o cuota);
- barra inferior flotante en el teléfono, con el indicador que se desliza al activo;
- menú "Más" de cristal;
- entrada (inicio de sesión) con la lámpara (**reemplazada el 2026-11-24 por la Estrella nova**: ver "Commit 10, Entrada" más abajo);
- botones con estados "cargando" y "listo";
- Inicio con el saludo según la hora, tarjetas con mini gráficos y números que cuentan.

Cómo se hace: se pasa a componentes reales de Nova (TSX, tokens `--nova-*`, `lucide-react`), **sin copiar el código del prototipo tal cual**, cuidando el contraste en claro y en oscuro (`tests/reglas/contraste.test.ts`), "reducir movimiento" en cada animación y el rendimiento en el teléfono (cristal con moderación, `motion` liviano si se usa, sin empeorar el tiempo de carga). La propuesta que se presenta primero, sin código, se apoya en el prototipo en lugar de describirlo desde cero.

**Opción anotada el 2026-11-13 para E20b, junto con bajar el tiempo de carga (el usuario decidió no hacerla por ahora):** Abrir la app mostrando al instante la copia guardada de Inicio con un aviso "Actualizando…" y reemplazarla en su lugar al llegar la respuesta del servidor, con completar, crear y editar desactivados mientras tanto; solo Inicio, con una copia del mismo usuario de menos de 24 h, sin pedidos extra al servidor. Riesgo: por un momento puede verse una tarea ya completada en otro dispositivo, o la copia antes de llevar al inicio de sesión si la sesión venció. Propuesta del 2026-11-13, no hecha por decisión del usuario.

**Commit 10, Entrada: cambio del usuario del 2026-11-24 (reemplaza a la lámpara; se programa al llegar al commit 10, no antes).** Lo interactivo es el logo de Nova. La pantalla empieza con un cielo de noche (también en modo claro) y la Estrella nova en el centro, apagada y latiendo suave.

*Cielo vivo:*
- las estrellas del fondo titilan, cada una a su ritmo, y el cielo se desplaza muy despacio;
- en el PC, una luz cálida suave sigue al mouse y las estrellas cercanas brillan un poco más; el cielo se mueve un poco al lado contrario del mouse (profundidad);
- la luz va pegada al cursor, sin retraso visible: se mueve con `transform` (`translate3d`) dentro de `requestAnimationFrame`, sin transición en la posición; las estrellas cercanas pueden encenderse con una transición corta;
- en el teléfono, la luz sigue al dedo mientras se arrastra por el cielo (sin la inclinación del teléfono, que en el iPhone pide permiso);
- después de encender la estrella, la luz se vuelve más tenue para no estorbar el formulario;
- liviano: sin librerías, solo CSS y un poco de JavaScript; sin gastar batería de más ni trabar teléfonos lentos; se detiene si la pestaña no está visible.

*Indicación:* debajo de la estrella, un texto claro con un ícono y un brillo suave que va y viene: "Toca la estrella" en el teléfono y "Haz clic en la estrella" en el PC, con "o pulsa Enter" debajo. La estrella se elige con Tab y se enciende con Enter o Espacio, con un contorno visible al tener el foco. La indicación desaparece al encenderla.

*Al encenderla, como una nova:*
- el centro y los anillos se iluminan y crece un brillo cálido detrás que queda tenue como halo;
- salen tres ondas desde la estrella que viajan con ella mientras se mueve (no se quedan en el centro);
- se mueve en un solo movimiento suave (arranca despacio, acelera y frena al llegar);
- el formulario aparece mientras la estrella termina de llegar, todo encadenado.

*Teléfono:* la estrella sube y se encoge hasta ser el logo arriba del formulario. *PC (pantalla ancha):* la estrella se desliza a la izquierda y queda grande, con "Nova" y una frase corta debajo; el formulario entra desde la derecha.

*Además:* con "reducir movimiento", el cielo queda quieto, sin luz que sigue al mouse, y todo se ve ya encendido desde el principio. Si nadie toca la estrella, se enciende sola a los 2 segundos. El formulario se puede usar con el teclado y con lectores de pantalla aunque no se haya encendido. Queda el lugar de "Entrar con Google" y del texto nuevo de "¿Olvidaste tu contraseña?" para E20c.

---

## E20c · Clave de Gemini propia y acceso de otras personas (pedida por el usuario el 2026-11-16, solución de su profesor)

**Cuándo:** después de E20b y antes de E21. **Plan:** X33, 5.14, 6.20, 6.21, 7.15, 7.16, RB-76 a RB-86, S-81 a S-88, B-87 a B-101, riesgos (13). **Requisito:** E20b.

**Decisiones del usuario (2026-11-16):**
1. **Acceso:** no por invitación. Cualquier persona se registra en cualquier momento con "Entrar con Google". Pestaña "Administración" solo para los administradores: cuentas (correo, nombre, registro, último acceso, espacio y si tiene clave, sí o no), bloquear y desbloquear, eliminar con todos sus datos, uso total frente al plan gratuito con avisos, y los topes de cuentas (15 al empezar) y de espacio por persona, editables. Ninguna otra cuenta la ve ni llama a su API.
2. **Tope de espacio por persona:** 30 MB (cálculo en el plan, 7.16).
3. La cuenta del usuario sin clave propia sigue usando la clave del proyecto.
4. Claude guarda `NOVA_LLAVE_CLAVES` en Vercel con `vercel env add`, sin mostrar su valor.
5. Se empieza con 10 personas. Si el espacio no alcanza, el siguiente paso es Supabase Pro (25 USD al mes, 8 GB).

```text
TAREA 1. Revisar otra vez los pasos de Google AI Studio en la documentación oficial (aistudio.google.com/docs/api-key) y ajustar la guía si cambiaron.
TAREA 2. Migraciones M24 (claves_gemini) y M25 (cuentas y administracion, con las cuentas que ya existen y la función del gancho "Before User Created"), y el trabajo diario de pg_cron que borra cron.job_run_details de más de 7 días. Antes: npm run db:respaldar; las tablas nuevas entran en scripts/tablas-respaldo.mjs. db:verificar con sus restricciones y RLS; compatibilidad con master (11.3).
TAREA 3. Llave NOVA_LLAVE_CLAVES (32 bytes, base64) en .env.local y en Vercel (Production y Preview) con vercel env add, generada sin mostrar su valor. Módulo server-only de cifrado (7.15) con pruebas S-81.
TAREA 4. src/lib/llm: un cliente de Gemini por usuario (clave propia o, solo para administradores sin clave, la del proyecto), con la memoria del modelo de respaldo por usuario; cada llamada (chat, respaldo, explicar, JSON de cuestionarios, temas y plan, embeddings, recomendación del índice) recibe el usuario. El tick de RB-57 usa la clave del dueño de cada libro. Errores RB-78 y estado de la clave; ocultarClave en todos los registros. Pruebas S-82 a S-84.
TAREA 5. API GET/PUT/DELETE /api/nova/clave-gemini y el bloque "Vincular mi clave de Gemini" en Configuración → Asistente (RB-77, RB-80), con el campo de contraseña y "Mostrar"; la guía /nova/configuracion/gemini con los avisos de 5.14.
TAREA 6. Sin clave (RB-79): aviso con el enlace a la guía en el Asistente, "Explicar de otra manera", subir PDF, crear cuestionario, Wikipedia, guardar fuente, recomendación del índice, temas y plan; el servidor responde SIN_CLAVE_GEMINI antes de llamar a Gemini.
Diseño de "Administración" (decidido el 2026-11-18): sigue el prototipo `doc/PROTOTIPO_DISENO.html`, con el diseño de E20b: tarjetas de resumen, medidores circulares del espacio con marcas al 80 % y al 95 %, gráfico de actividad de 14 días, tabla de cuentas con búsqueda y filtros, bloquear, eliminar escribiendo el correo, topes que calculan el margen, estado del sistema y registro de acciones (PLAN 5.14, 6.21 `acciones_admin`, RB-88, RB-89, S-90, S-91, B-103 a B-105).

TAREA 7. Acceso y Administración: "Entrar con Google" en /login (cliente OAuth en Google Cloud y proveedor en Supabase: pasos para el usuario, que los hace en su cuenta), /register sin crear cuentas con correo, el gancho "Before User Created" activado en Supabase, exigirSesion con cuentas bloqueadas y último acceso (RB-81, RB-82). Pestaña /nova/administracion solo para administradores, en el menú solo para ellos, con su API (RB-83 a RB-86, RB-88, RB-89) y el espacio por persona de 7.16 al subir e indexar; con el diseño del prototipo: resumen, medidores, actividad de 14 días, tabla con búsqueda y filtros, topes con margen, sistema y registro de acciones (tabla acciones_admin en M25). Pruebas S-85 a S-88, S-90 y S-91.
TAREA 8. npm run probar:clave (11.2) y prueba en Edge con una cuenta de prueba no administradora: sin clave, clave inventada, clave válida, la clave no aparece en ninguna respuesta ni en el HTML, desvincular, Administración bloqueada para ella (404 y 403), bloquear, tope de espacio, eliminar, 390 px y 1280 px.
Pedido del usuario (2026-11-21), tenerlo en la propuesta de E20c: desde el commit del tiempo de carga de E20b la sesión se verifica sin ir a Supabase (`getClaims`) y un token vale hasta 1 hora. Al bloquear o eliminar una cuenta desde Administración, esa persona no debe poder seguir usando Nova durante esa hora: la revisión de cuenta bloqueada de exigirSesion (RB-81) y del middleware tiene que valer en cada pedido (por ejemplo, una consulta a la base o una lista de bloqueados con caché corta), además de cerrar sus sesiones en Supabase (`auth.admin.signOut` o eliminar el usuario). La prueba de la TAREA 8 debe incluir que una sesión ya abierta deja de funcionar en el siguiente pedido después de bloquear o eliminar.
Recuperar la contraseña (pedido del usuario, 2026-11-24; va en la propuesta de E20c, sin programar antes): hoy "¿Olvidaste tu contraseña?" manda un enlace propio por Resend con el remitente de prueba `onboarding@resend.dev`, que solo entrega al correo dueño de la cuenta de Resend (no hay dominio verificado); a cualquier otro correo Resend responde con error, el enlace se anula y la pantalla igual dice que llegará. Igual en la vista previa y en producción. La clave de Resend (Vercel Connect) solo permite enviar: no deja ver dominios ni envíos. Probado por el usuario el 2026-11-24 en la vista previa con su correo: el correo sí llega, porque es el dueño de la cuenta de Resend; para cualquier otra persona no llega. Dos salidas nuevas:
- a) Con Google: "Entrar con Google" entra a la cuenta que ya tiene ese correo aunque se haya creado con contraseña (Supabase une las identidades con el mismo correo si el de la cuenta está confirmado; la del usuario lo está; confirmarlo en la prueba sin crear una cuenta nueva). En Configuración, "Poner una contraseña nueva" sin pedir la anterior cuando la sesión entró con Google (revisar la opción "Secure password change" de Supabase: con sesión reciente no pide nada más).
- b) Con el administrador: en "Administración", "Contraseña temporal" para una cuenta (solo administradores, con `auth.admin.updateUserById`); la persona debe cambiarla al entrar la primera vez (marca en la base que revisan el middleware y `exigirSesion`, con una pantalla para cambiarla); queda en `acciones_admin` quién y cuándo.
- "¿Olvidaste tu contraseña?" explica estas dos salidas en vez de prometer un correo; el envío por correo se quita o queda solo si un día hay dominio verificado. El commit 10 de E20b (entrada) rediseña /login y /recuperar-contrasena: deja lugar para "Entrar con Google" y el texto nuevo, que se activan en E20c.

VERIFICACIÓN: B-87 a B-101 y B-103 a B-105; A-01 a A-21 y B-01 a B-86 siguen pasando con la cuenta del usuario (administrador).
```

**Cambios aprobados por el usuario el 2026-11-25 (prevalecen sobre lo anterior de E20c donde choquen):**
- **Partes:** E20c-1 clave propia (M24), E20c-2 Administración con niveles (M25), E20c-3 "Entrar con Google", control de registro y contraseña temporal. Cada una con la prueba del usuario antes de la siguiente.
- **Llave de cifrado con versiones (7.15):**
  - Variables `NOVA_LLAVE_CLAVES_V{n}` (32 bytes en base64) y `NOVA_LLAVE_CLAVES_ACTUAL` (la versión con la que se cifra). Van en Preview y en Production con el mismo valor desde E20c-1.
  - Es una variable visible en Vercel, no "Sensitive": el usuario guarda su copia desde Settings → Environment Variables.
  - Cada clave guarda su `version_llave` y se descifra con esa versión.
  - Para cambiar la llave: se agrega `V{n+1}`, se pasa `ACTUAL` y `npm run claves:recifrar` vuelve a cifrar todas. La versión anterior se borra cuando ya ninguna la usa.
- **Clave que no se puede descifrar:** estado `ilegible`. Nunca se usa la del proyecto en su lugar y se le pide a esa persona vincularla otra vez (RB-90).
- **Uso por cuenta:** tabla `uso_ia_diario` (M24), con solo el conteo de llamadas a Gemini por cuenta y día de Bogotá. Nunca guarda preguntas ni respuestas. "Administración" muestra MB y consultas de cada cuenta.
- **Niveles (M25, RB-93):** `cuentas.nivel` es `dueno`, `admin` o `usuario`. Se revisan en el servidor y en la base, no solo en la pantalla.
  - **Dueño:**
    - solo el correo incorporado, y uno solo (lo garantiza la base);
    - puede todo: nombrar y quitar administradores, cambiar topes, eliminar cuentas y dar el permiso de la clave del proyecto;
    - nadie lo puede bloquear, bajar de nivel ni eliminar.
  - **Administrador:**
    - ve las cuentas con su uso (MB y consultas) y el registro de acciones;
    - bloquea y desbloquea usuarios, habilita cuentas pendientes y da contraseñas temporales;
    - no elimina cuentas, no nombra ni quita administradores, no cambia topes ni el permiso de la clave del proyecto;
    - no puede bloquear a otro administrador, al dueño ni a sí mismo.
  - **Usuario:** Nova normal, sin "Administración".
  - Nadie, tampoco el dueño, ve desde "Administración" tareas, documentos ni conversaciones de otros: solo correo, registro, uso, estado y nivel.
  - Cada cambio de nivel y de permiso queda en `acciones_admin` con quién y cuándo.
- **Clave del proyecto:** es un permiso por persona (`cuentas.usa_clave_proyecto`, apagado por defecto) que da el dueño. El dueño sin clave propia la usa siempre, como hoy. Un administrador no la usa por serlo (cambia RB-76, RB-79 y B-93). En E20c-1, antes de M25, solo el dueño la usa.
- **`SUPABASE_ADMIN_EMAILS` solo para emergencias:** sus correos cuentan como administrador (nunca como dueño) aunque la base diga otra cosa. En Vercel no existe; sirve para recuperar el acceso sin desplegar código y para las pruebas automáticas.
- **Acceso desde E20c-2:** lo decide la tabla `cuentas`. Entra quien tiene una fila en estado `activa`.
- **Condición del usuario (2026-11-25), cuentas creadas con correo antes del control de registro:**
  - **Al nacer:** un disparador de M25 en `auth.users` crea la fila de `cuentas` de toda cuenta nueva en estado `pendiente`.
  - **Al migrar:** las cuentas que ya existen quedan `activa`, y la del dueño con nivel `dueno`.
  - **Mientras está pendiente:** no entra a Nova ni a su API (`CUENTA_PENDIENTE`, 403, RB-92).
  - **Sin fila:** tampoco entra. Si se borrara el disparador, la regla falla cerrada.
  - **Habilitar:** un administrador o el dueño la habilita desde "Administración", y queda en el registro.
  - **Desde E20c-3:** las cuentas que llegan con Google pasan el gancho de registro y nacen `activa`. Las creadas con correo siguen `pendiente`.
  - **Prueba:** S-92 y una prueba en Edge crean una cuenta con correo y comprueban que no entra hasta habilitarla.
- **Contraseña temporal (E20c-3, RB-91):**
  - Nova la genera al azar, de 16 caracteres, y se muestra una sola vez a quien la da.
  - Sirve para entrar una sola vez (`temporal_usada_en`). Un segundo ingreso con ella antes de cambiarla se rechaza.
  - Vence a las 24 horas si no se usa: el aviso de cada minuto la reemplaza por una al azar que nadie conoce.
  - Al entrar con ella, solo se puede ver la pantalla para poner una contraseña propia. Todo lo demás, también la API, responde `DEBE_CAMBIAR_CONTRASENA` (403).
  - Nunca se guarda: las columnas de M25 son `debe_cambiar_contrasena`, `temporal_vence_en` y `temporal_usada_en`.
  - Queda en el registro quién la dio y cuándo.
- **Control de registro (E20c-3):**
  - se activa en E20c-3, avisándole antes al usuario;
  - las cuentas existentes siguen entrando en producción;
  - el registro de producción muestra `Por ahora las cuentas nuevas se crean con "Entrar con Google".` en vez de un error; es un cambio pequeño en master que se consulta ese día;
  - queda escrito cómo desactivarlo en un minuto.
- **Respaldo:** `claves_gemini` y `uso_ia_diario` (M24) entran en `tablas-respaldo.mjs`, y `cuentas`, `administracion` y `acciones_admin` (M25) también, con todas sus columnas. Se comprueba con `db:restaurar --probar`.

Guía de la clave (TAREA 1, revisada el 2026-11-25 en aistudio.google.com/docs/api-key y en sus términos): las claves nuevas desde el 28 de mayo de 2026 ya vienen limitadas a la API de Gemini y la API rechaza las claves sin restricción; 18 años o más; en el plan gratuito Google usa lo enviado para mejorar sus productos y personas pueden leerlo. La frase de que la cuota es por proyecto y la prohibición de crear varios proyectos no aparecen en esas páginas: no van en la guía.

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

**Commits:** uno por parte: `feat(configuracion): clave de Gemini propia` (E20c-1), `feat(administracion): pestaña de administración con niveles` (E20c-2) y `feat(acceso): entrar con Google, control de registro y contraseña temporal` (E20c-3).

**Qué cambia en E21:** `NOVA_LLAVE_CLAVES` debe estar en Production antes de unir; la tabla de aceptación pasa a B-01 a B-105; la revisión final busca la clave en registros, respuestas y en el repositorio; el acceso de otras personas se abre solo después de unir y de quitar el disparador de dueño por defecto (TAREA 4 de E21); se prueba con una segunda cuenta no administradora en producción.

---

## E20d · PDF escaneados (OCR) y más tipos de documento (propuesta del 2026-11-24, aprobada el 2026-11-25)

**Cuándo:** después de E20c y antes de E21. Con la clave propia de cada persona (E20c), leer páginas con Gemini gasta su cuota, no la compartida. **Requisito:** E20c. **Estado:** aprobada por el usuario el 2026-11-25 tal como está escrita; se programa después de E20c. La migración es **M26** (E20c usa M24 y M25).

**Pedido del usuario (2026-11-24):**
- Un libro escaneado (cada página es una imagen) no se pudo leer.
- Quiere leer PDF escaneados con OCR, con tres opciones comparadas.
- Quiere subir más que PDF:
  - primero Markdown (.md), texto (.txt), Word (.docx) y PowerPoint (.pptx);
  - después fotos (.jpg, .png) con el mismo OCR;
  - sin .doc ni .ppt antiguos.
- Cada tipo con su propia estructura, un sello con su color e ícono en Fuentes, un filtro por tipo, "Ver contenido" en lugar de "Ver capítulos", y elegir una sección o diapositiva en "Buscar en", en los cuestionarios y en el plan de lectura. Citas como "Apuntes.docx · Unidad 2" o "Clase3.pptx · diapositiva 7".
- En cualquier caso, Nova detecta sola que el PDF es escaneado y pregunta antes de gastar consultas.

### 1. Leer PDF escaneados: comparación

**Cómo se detecta (igual en las tres opciones):**
- Al leer el PDF, `unpdf` ya da el texto de cada página.
- Una página con menos de unos 20 caracteres de texto es "de imagen".
- Si hay páginas de imagen, Nova no rechaza el PDF como hoy (`PDF_SIN_TEXTO`): guarda lo que tiene texto y pregunta antes de gastar consultas. Por ejemplo: "Este PDF tiene 180 páginas escaneadas. Leerlas usa unas 12 consultas de tu clave de Gemini (unos 5 minutos). ¿Leerlas?". Las respuestas posibles son "Leerlas" y "Ahora no".
- Un PDF mixto (portada escaneada y el resto con texto) solo lee con OCR las páginas que lo necesitan.

| | A. Solo Gemini, por grupos de páginas | B. Solo un OCR gratuito (Tesseract) | C. Combinado (Tesseract primero, Gemini para las difíciles) |
|---|---|---|---|
| Calidad | La mejor: texto impreso, columnas, tablas, fórmulas y letra a mano legible | Buena en escaneos limpios de texto impreso; mala en fotos torcidas, letra a mano, fórmulas, tablas y columnas | Como A en las páginas difíciles; como B en las demás. Una página "segura" para Tesseract puede salir con errores que la confianza no detecta |
| Tiempo (libro de 300 páginas escaneadas) | Unas 20 llamadas de 15 páginas, de 10 a 30 s cada una: de 5 a 10 minutos, por partes | De 2 a 5 s por página en una función de Vercel (un solo núcleo): de 10 a 25 minutos, por partes | B más las llamadas de las difíciles |
| Cuota de Gemini | Cerca de 260 tokens por página de entrada más el texto de salida: unas 20 llamadas por libro, dentro del plan gratuito de una clave propia | Ninguna | Solo las páginas difíciles |
| Límites de Vercel | Cada llamada cabe en una parte de la indexación (`maxDuration` 300). Hay que guardar el PDF en Blob hasta terminar y separarlo en grupos de páginas con `pdf-lib` (JavaScript puro) | El paquete WASM (unos 10 MB) más el idioma español (de 4 a 15 MB). Además hay que convertir cada página en imagen: con `@napi-rs/canvas`, nativo, de unos 30 MB, o sacando la imagen que el PDF ya trae con pdf.js. Arranque en frío más lento | Lo de A más lo de B |
| Peso para el proyecto | `pdf-lib` (unos 1,5 MB, solo en el servidor) | De 15 a 45 MB en la función | El mayor de los tres |
| Teléfono | Nada cambia: el teléfono solo sube el archivo y ve el avance; sigue solo con el aviso de cada minuto (RB-57) | Igual en el servidor. Hacer el OCR en el navegador del teléfono gastaría batería y se detendría al bloquearlo | Igual que A y B |
| Complejidad | Baja: reusa la indexación por partes y la pregunta antes de gastar | Media: canvas o extracción de imágenes, idioma y limpieza del texto | Alta: dos caminos, un umbral de confianza que ajustar y dos preguntas posibles |

**Recomendación: A, con una mejora: Gemini solo para las páginas sin texto.**
- Es la de mejor calidad, la más liviana y la más sencilla de mantener. Con la clave propia de E20c, la cuota alcanza de sobra.
- Ninguna página de un PDF con texto gasta consultas.
- Topes:
  - hasta 300 páginas escaneadas por documento;
  - de 10 a 15 páginas por llamada;
  - el PDF sigue con el límite de 15 MB.
- Si la cuota de una clave se agota, se detiene y sigue al día siguiente sin perder lo leído, como los libros largos.

**Si el usuario prefiere C:** es viable, pero suma de 15 a 45 MB a la función, hace más lentas las primeras llamadas y la confianza de Tesseract no siempre avisa sus errores. Se podría agregar después de A, si la cuota resulta corta.

**Detalles de A:**
- Prompt de transcripción literal: "copia el texto de cada página, sin resumir ni corregir; marca `[ilegible]` lo que no se lea".
- Una página se marca como "leída con OCR".
- La cita dice "Libro.pdf · p. 45 (escaneada)".
- El PDF se guarda en Blob con un nombre al azar mientras se lee y se borra al terminar. Si la persona responde "Ahora no" o no responde en 24 horas, se borra con el aviso de cada minuto. El almacén es público: es un riesgo corto y conocido.
- Las etapas del commit 6 suman "Leer con OCR (12 de 20 grupos)".

### 2. Más tipos de documento

**Cómo se leería cada uno:**

| Tipo | Lectura | Librería | Estructura |
|---|---|---|---|
| Markdown (.md) | Texto UTF-8 | Ninguna (encabezados `#` a `###`, sin contar los bloques de código) | Secciones por encabezado |
| Texto (.txt) | Texto UTF-8 (con respaldo Latin-1 si no es UTF-8 válido) | Ninguna | Partes numeradas de unas 1.500 palabras, cortadas en un párrafo |
| Word (.docx) | Es un ZIP: `word/document.xml` con párrafos, tablas y listas | `fflate` (unos 30 KB) y lectura propia del XML. Alternativa: `mammoth` (unos 2 MB), más completa pero más pesada | Secciones por títulos: los estilos con nivel de esquema (`w:outlineLvl` en `styles.xml`, así sirve también "Título 1" en un Word en español) |
| PowerPoint (.pptx) | ZIP: `ppt/slides/slideN.xml` en el orden de `presentation.xml`, el texto de `a:t` y las notas del orador | `fflate` | Diapositivas con su título (el marcador `title` o `ctrTitle`; sin título: "Diapositiva 7") |
| PDF escaneado | OCR (sección 1) | `pdf-lib` | Páginas leídas con OCR, marcadas |
| Fotos (.jpg, .png) | OCR con Gemini, una imagen por llamada o varias juntas | Ninguna | Páginas leídas con OCR; varias fotos pueden ser un solo documento ("Apuntes de clase", 5 páginas) |

- Las imágenes dentro de un Word o un PowerPoint no se leen. Se puede agregar después con el mismo OCR.
- En el iPhone, al elegir con `accept="image/jpeg,image/png"`, Safari convierte las fotos HEIC a JPEG.

**Base de datos (la base es compartida con producción: nada se renombra ni se borra, solo se agrega):**
- **M26** (antes decía M24, que es de E20c):
  - `documentos.tipo`, con CHECK (`pdf`, `pdf_escaneado`, `docx`, `md`, `txt`, `pptx`, `imagen`) y por defecto `pdf`, así lo existente y el código de `master` siguen igual;
  - `documentos.unidad` (`pagina`, `diapositiva`, `seccion`, `parte`);
  - `fragmentos_pdf.ocr` (booleano, por defecto falso).
- **Mejor que crear "partes del documento" aparte:** se reusa el modelo de páginas que ya funciona. `pagina_inicio` y `pagina_fin` pasan a ser la "unidad" (la diapositiva, la sección o la parte, según el tipo). La tabla `capitulos` guarda los grupos (capítulos de un libro, títulos de nivel 1 de un Word con sus subsecciones) y suma una columna `tipo`. Así "Buscar en" por página o capítulo, los cuestionarios por alcance, el plan de lectura y las citas compactas (RB-36) sirven sin rehacerlos. Solo cambian las etiquetas: "p. 4", "diapositiva 7", "Unidad 2", "parte 3".
- El nombre `fragmentos_pdf` queda aunque guarde otros tipos (se aclara en el plan).
- **Respaldo:** como solo hay columnas nuevas en tablas que ya están en `tablas-respaldo.mjs`, el respaldo las incluye sin cambios. Se prueba restaurar en una copia.
- El tope de 30 MB por persona de E20c cuenta el texto guardado de cada tipo, como hoy.

**Pantallas:**
- **Fuentes:**
  - la zona de subida acepta los nuevos tipos;
  - cada documento lleva su sello con su color e ícono de `lucide-react`: PDF (`FileText`), Word (`FileType`), Markdown (`Hash`), Texto (`AlignLeft`), PowerPoint (`Presentation`), Escaneado (`ScanLine`) y Foto (`Image`), con colores de las categorías que pasen `contraste.test.ts`;
  - un filtro por tipo en una fila de píldoras, como las categorías de Tareas.
- **"Ver contenido"** (antes "Ver capítulos") muestra la estructura de cada tipo: capítulos y páginas, secciones, diapositivas con su título, partes o páginas escaneadas.
- **"Buscar en", cuestionarios y plan de lectura:** elegir una sección o una diapositiva igual que hoy un capítulo o una página.
- **Citas:** "Apuntes.docx · Unidad 2", "Clase3.pptx · diapositiva 7", "Notas.txt · parte 3", "Libro.pdf · p. 45 (escaneada)".

### 3. Orden propuesto (un commit por paso, con la prueba del usuario entre uno y otro)

1. **E20d-1:** M26 (con `db:respaldar` antes); Markdown y texto; sellos, filtro y "Ver contenido".
2. **E20d-2:** Word y PowerPoint.
3. **E20d-3:** PDF escaneados con OCR (detección, pregunta antes de gastar, lectura por partes, citas marcadas).
4. **E20d-4:** fotos con el mismo OCR.

**Pruebas:** reglas de cada lector con archivos pequeños de ejemplo en `tests/`; el OCR con respuestas simuladas de Gemini; un solo `npm run probar:ocr` con Gemini real y pocas páginas, ejecutado una vez.

---

## E21 · Aceptación de la ampliación

**Plan:** 12. **Requisito:** E20c.

```text
TAREA 1. Agregar a doc/ACEPTACION.md la tabla B-01 a B-105 (columnas como A-01 a A-15) y la nota de repetir A-01 a A-21 en la vista previa.
TAREA 2. Revisión final: sin botones muertos (recorrido de todas las pantallas), sin colores fuera de los tokens, sin textos en inglés, todas las rutas nuevas con exigirSesion y filtro por usuario, ninguna clave en el repositorio.
TAREA 3. Actualizar README (funciones, pantallas, scripts nuevos) y crear doc/checkpoints/AMPLIACION_COMPLETADA.md.
TAREA 4. Preparar (sin aplicar) la migración que quita el disparador de dueño por defecto (plan, 6.1): comprueba que no quedan filas sin usuario_id, borra el disparador y asignar_dueno_por_defecto (y nova_config si nada más la usa) y pasa usuario_id a NOT NULL. Se aplica solo al unir ampliacion con master, después de que master tenga el código nuevo; nunca antes, porque rompería el código de master en producción.
TAREA 5. Recordarle al usuario ejecutar B-01 a B-105 y A-01 a A-21 en la vista previa, en computador y teléfono. La unión de ampliacion con master solo se hace si el usuario la pide, e incluye revisar y aplicar la migración de la TAREA 4.
TAREA 6. (Recordatorios, E11c; plan 6.12, "Paso a producción") Al unir con master, y solo cuando producción ya tenga el código: NOVA_TICK_URL pasa a https://novaassistantjc.vercel.app/api/nova/recordatorios/tick (la dirección de producción cambió el 2026-11-25; el aviso sigue en la vista previa hasta aquí), se quita VERCEL_AUTOMATION_BYPASS_SECRET de .env.local, se ejecuta npm run db:configurar-tick (Vault queda con la dirección de producción y sin la omisión), se revoca la omisión en el proyecto de Vercel, se comprueba en net._http_response que las llamadas responden 200 y que VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y RECORDATORIOS_SECRETO están en Production. Se le recuerda al usuario reinstalar la app y volver a activar las notificaciones en cada dispositivo, ya en producción (las suscripciones son por sitio). Se agrega el cron diario de Vercel a GET /api/nova/salud con CRON_SECRET (riesgo de pausa de Supabase, plan 13).
TAREA 7. (Clave propia, E20c) Antes de unir: NOVA_LLAVE_CLAVES en Production con el mismo valor que en Preview (si no, las claves guardadas no se pueden leer). Después de unir y de aplicar la migración de la TAREA 4: abrir el registro con Google (activar el proveedor y el gancho en el proyecto de Supabase, agregar la dirección de producción como URL de retorno) y probar con una segunda cuenta no administradora en producción (B-87 a B-101).
```

**Commit:** `docs: aceptación de la ampliación`
