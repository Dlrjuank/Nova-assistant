# Prompts de la ampliación · Nova Assistant

Etapas E00 a E21 (más E02b, E02c, E05b, E06b y E20b, pedidas por el usuario) para ejecutar `doc/PLAN_AMPLIACION.md`, en orden de dependencias. Cada etapa es pequeña, se puede probar sola y termina en un commit en la rama `ampliacion`. Se ejecuta una etapa por vez y se espera la confirmación del usuario antes de la siguiente.

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

---

## E21 · Aceptación de la ampliación

**Plan:** 12. **Requisito:** E20b.

```text
TAREA 1. Agregar a doc/ACEPTACION.md la tabla B-01 a B-47 (columnas como A-01 a A-15) y la nota de repetir A-01 a A-21 en la vista previa.
TAREA 2. Revisión final: sin botones muertos (recorrido de todas las pantallas), sin colores fuera de los tokens, sin textos en inglés, todas las rutas nuevas con exigirSesion y filtro por usuario, ninguna clave en el repositorio.
TAREA 3. Actualizar README (funciones, pantallas, scripts nuevos) y crear doc/checkpoints/AMPLIACION_COMPLETADA.md.
TAREA 4. Preparar (sin aplicar) la migración que quita el disparador de dueño por defecto (plan, 6.1): comprueba que no quedan filas sin usuario_id, borra el disparador y asignar_dueno_por_defecto (y nova_config si nada más la usa) y pasa usuario_id a NOT NULL. Se aplica solo al unir ampliacion con master, después de que master tenga el código nuevo; nunca antes, porque rompería el código de master en producción.
TAREA 5. Recordarle al usuario ejecutar B-01 a B-47 y A-01 a A-21 en la vista previa, en computador y teléfono. La unión de ampliacion con master solo se hace si el usuario la pide, e incluye revisar y aplicar la migración de la TAREA 4.
```

**Commit:** `docs: aceptación de la ampliación`
