# Plan de ampliación · Nova Assistant

Ampliación pedida por el usuario sobre el MVP terminado (P00 a P11, aceptación A-01 a A-21 aprobada). Este documento complementa a `doc/PLAN_NOVA.md`: lo que no se dice aquí sigue igual que allí. Si hay conflicto, **este documento manda solo en lo nuevo**; los mensajes exactos y los casos A-01 a A-21 del plan original no cambian.

Los prompts de ejecución están en `doc/PROMPTS_AMPLIACION.md` (etapas E00 a E21).

## Índice

1. [Reglas generales](#1-reglas-generales)
2. [Alcance](#2-alcance)
3. [Diseño](#3-diseño)
4. [Navegación y rutas](#4-navegación-y-rutas)
5. [Pantallas](#5-pantallas)
6. [Modelo de datos](#6-modelo-de-datos)
7. [Reglas de cálculo](#7-reglas-de-cálculo)
8. [Reglas de negocio y mensajes exactos](#8-reglas-de-negocio-y-mensajes-exactos)
9. [El asistente en Semestre](#9-el-asistente-en-semestre)
10. [API](#10-api)
11. [Pruebas](#11-pruebas)
12. [Casos de aceptación B-01 a B-86](#12-casos-de-aceptación-b-01-a-b-86)
13. [Riesgos y decisiones](#13-riesgos-y-decisiones)

---

## 1. Reglas generales

| Regla | Detalle |
|---|---|
| Rama | Todo en `ampliacion`, creada desde `master`. Nunca se hace commit ni push a `master`. La unión con `master` la decide el usuario al final. |
| Vista previa | Cada push de `ampliacion` genera un despliegue de vista previa en Vercel; ahí se prueba en el teléfono. Producción (`master`) no cambia. |
| Una sola base | Producción y la vista previa usan el **mismo** proyecto de Supabase. Toda migración es **aditiva** (tablas nuevas, columnas opcionales, funciones nuevas). Nunca se renombra, borra ni cambia el tipo de algo que use el código de `master`. |
| Compatibilidad con `master` | Después de cada migración, el código de `master` debe seguir creando, completando y eliminando tareas, indexando y eliminando documentos, consultando, guardando historial, calculando el índice y buscando en Wikipedia igual que hoy. Se comprueba corriendo los scripts de `master` contra la base (sección 11.3). |
| No romper la aceptación | A-01 a A-21 y sus mensajes exactos siguen valiendo. Si una ruta cambia de lugar, la vieja redirige a la nueva. Única excepción aprobada por el usuario: A-13 cambia con RB-30 (E02b) y RB-32. |
| Antes de cada commit | `npm test`, `npm run build` y `eslint` sin errores. Nunca `.env.local`, `.env.respaldo.local` ni `doc/CORREO RESEND VERCEL CONNECT (1).md`. |
| Computador y teléfono | Toda pantalla funciona desde 360 px de ancho sin desplazamiento horizontal, y con teclado (foco visible). |
| Sin botones muertos | Ningún botón, enlace ni ítem de navegación lleva a algo que no exista todavía. Cada sección entra al menú en la etapa en que se construye. |
| El asistente es protagonista | Acceso al chat destacado en Inicio y en el centro de la barra inferior del teléfono. |
| Migraciones | Con `NOVAASSISTANT_POSTGRES_URL_NON_POOLING` y `npm run db:migrar`. Tablas nuevas con `usuario_id`, RLS activo sin políticas y permisos revocados a `anon` y `authenticated`, igual que las tablas de Nova. |
| Aislamiento por usuario | El servidor se conecta como dueño de la base y RLS no lo filtra. El aislamiento lo garantiza el código: toda consulta lleva `WHERE usuario_id = $usuario` con el id de la sesión, nunca uno del cuerpo de la petición. Las tablas hijas usan claves foráneas compuestas `(id, usuario_id)` como `mensajes_chat` (M4). |

## 2. Alcance

### 2.1 Incluido

| ID | Funcionalidad | Etapa |
|---|---|---|
| X0 | Dueño en tareas, documentos y fuentes web (`usuario_id`) | E01 |
| X0b | El Asistente responde con las tareas pendientes aunque no haya documentos (RB-30) | E02b |
| X0c | El Asistente conoce la fecha de hoy y responde preguntas por fechas sobre las tareas (RB-31) | E02c |
| X0d | Horario opcional de las tareas (hora de inicio y de fin), en 24 horas (RB-34) | E06b |
| X17b | Diseño final "darle vida a Nova" (versión completa): navegación con píldora animada, entrada escalonada, números y anillos animados, celebración al completar, estados vacíos amables, saludo según la hora, login animado, Inicio en mosaico, gráficos vistosos en Productividad, vidrio solo en pocos lugares, barra lateral plegable; solo presentación, con reducir movimiento respetado y librería justificada con su peso (texto completo del usuario en `PROMPTS_AMPLIACION.md`, E20b) | E20b |
| X1 | Rediseño: paleta cálida, modo claro y oscuro, íconos, encabezados, login | E02, E04 |
| X2 | Navegación: barra lateral (computador), barra inferior + "Más" + botón "+" (teléfono) | E03 |
| X3 | Categorías de tareas con color | E05 |
| X4 | Inicio: "Pregúntale a Nova", semana, progreso semanal, prioridades de hoy | E06 |
| X5 | Calendario mensual con tareas y fechas de Semestre | E07, E13 |
| X6 | Tareas con pestañas y agrupación por categoría | E08 |
| X17 | Editar tareas ya creadas: título, categoría, prioridad y fecha límite | E09 |
| X7 | Fuentes: Documentos y Web en una sección | E10 |
| X8 | Configuración: perfil, apariencia, académico, categorías, asistente, cerrar sesión | E05, E11 |
| X9 | Semestre · Materias y notas: calculadora de notas con componentes de evaluación (porcentaje y varias notas que se promedian), cortes opcionales, nota actual y "¿Cuánto necesito?" para aprobar o para una meta | E12, E13 |
| X10 | Semestre · Fallas | E14 |
| X11 | Productividad · Metas semanales | E15 |
| X12 | Semestre · Objetivos y "¿es alcanzable?" | E16 |
| X13 | Semestre · Temas del corte (manuales y propuestos desde el syllabus) | E17 |
| X14 | Semestre · Plan de estudio con el asistente, editable y con versiones | E18 |
| X15 | Semestre · Pasar pasos del plan a Tareas | E19 |
| X16 | Semestre · Estadísticas | E20 |
| X18 | Libros en PDF: páginas en cada fragmento y en cada cita, capítulos (índice interno o encabezados), indexación por partes para libros largos (pedido del usuario, 2026-11-07) | E10b |
| X19 | Libros en el Asistente: preguntar por página o por capítulo y "Explicar de otra manera" (Más simple, Con un ejemplo, Paso a paso, Resumen corto, Con una analogía) | E10c |
| X20 | Plan de lectura por capítulos que pasa a Tareas | E10d |
| X21 | App instalable (PWA): ícono, pantalla completa, nombre "Nova" y guía para agregarla a inicio | E11b |
| X22 | Recordatorios de tareas con notificaciones push (a la hora, 15 min, 1 hora o 1 día antes; sin horario, a una hora fija) | E11c |
| X23 | Resumen diario opcional por notificación y "Agregar a mi calendario" (.ics) | E11d |
| X24 | Cuestionarios de selección múltiple desde un documento, capítulo o rango de páginas, con puntaje de 0 a 5 y "Repetir solo las que fallé" (pedido del usuario, 2026-11-09) | E10e |
| X26 | Fuentes web guardadas: verlas por categoría y eliminarlas (pedido del usuario, 2026-11-09) | E10b2 |
| X27 | Fuentes web: botón "Guardar" en lugar de guardar siempre, y que el Asistente las consulte citándolas con su enlace (pedido del usuario, 2026-11-09) | E10c2 |
| X28 | Wikipedia en "Buscar en", con "Guardar fuente" (aprobado por el usuario, 2026-11-09) | E10c2 |
| X29 | "IA (conocimiento general)" en "Buscar en" y botón "Preguntarle a la IA" cuando no se encuentra en los documentos, con marca visible y sin mezclarse con los documentos (aprobado por el usuario, 2026-11-09) | E10c3 |
| X30 | Consulta sin conexión, solo lectura: Inicio, Tareas, Calendario y capítulos (aprobado por el usuario, 2026-11-09) | E11b |
| X25 | Historial de intentos por documento o capítulo y sugerencia de tarea para repasar | E10f |
| X31 | Tipos de pregunta en los cuestionarios: selección única, respuesta múltiple, verdadero o falso, completar, pregunta abierta y mixto (sugerido por un amigo del usuario y aprobado por el usuario, 2026-11-13) | E10g |
| X32 | Crear tareas sin conexión: se guardan en el dispositivo con la marca "Pendiente de enviar" y se envían solas, sin duplicarse, al volver la conexión con Nova abierta; completar, editar y eliminar siguen necesitando conexión (pedido del usuario, 2026-11-13) | E11e |

### 2.2 Fuera de alcance

- Rutinas (tareas recurrentes).
- Escala de notas distinta de 0,0 a 5,0.
- Que el chat del Asistente responda sobre notas, materias o metas (sigue respondiendo sobre PDF y tareas).
- Que las fuentes web alimenten al chat. *(Desde el 2026-11-09 entra en el alcance: E10c2, solo las guardadas y solo si se eligen en "Buscar en".)*
- Lista de conversaciones anteriores (la base ya lo permite desde M4; la pantalla no).
- Arrastrar y soltar tareas entre días.
- Notificaciones y recordatorios. *(Desde el 2026-11-07 entran en el alcance: E11b a E11d.)*
- Leer PDF escaneados (sin texto, haría falta OCR).
- Que un evento agregado con "Agregar a mi calendario" se actualice solo: es una copia (RB-46).
- **Ideas para más adelante, solo anotadas, sin planear** (pedido del usuario, 2026-11-07):
  - Publicar Nova en Google Play y en la App Store con Capacitor. Google cobra 25 USD una vez; Apple, 99 USD al año, y exige un Mac o compilar en la nube.
  - Recordatorios por mensaje de WhatsApp con la API de WhatsApp Business, que cobra por mensaje.
  - Respaldo de los recordatorios por correo con Resend (retirado de E11d el 2026-11-09). Enviar a cualquier destinatario exige un dominio verificado, que tiene costo.
  - **Límite de uso por persona:** cuando más personas usen Nova, la cuota de Gemini se comparte entre todos. Idea: un límite por usuario y por día, configurable (por ejemplo, 1 libro grande y 50 preguntas), con un mensaje claro al alcanzarlo, para que nadie gaste el cupo de todos.
  - **Gemini de pago para uso con más personas o en una universidad:** en el plan gratuito, Google usa lo enviado para mejorar sus productos, personas pueden leerlo y sus términos piden no enviar información sensible, confidencial o personal. En el de pago no usa los prompts ni las respuestas para mejorar sus productos.
  - **Crear o completar tareas sin conexión y sincronizar al volver** (anotado el 2026-11-09, sin planear): unas 2 o 3 etapas medianas (cola de cambios en IndexedDB, identificadores de cliente, reglas de conflicto, categorías y recordatorios sin conexión, pantallas que hoy dependen del servidor). En iPhone solo sincronizaría con la app abierta. *(El 2026-11-13 entra en el alcance solo **crear**: E11e, X32. Completar, editar y eliminar sin conexión siguen fuera.)*
  - **Búsqueda con Google integrada en Gemini** (descartada por ahora el 2026-11-09): no está disponible en el plan gratuito para los modelos que usa Nova; exige facturación con tarjeta, mostrar las sugerencias de búsqueda y cambiar RB-55. Si algún día se paga, se haría con una clave de un proyecto aparte y alerta de presupuesto.
- Un segundo proyecto de Supabase.

## 3. Diseño

Referencia: imagen de "FocoAI · Mi semana / Mis tareas" entregada por el usuario. Se toma la estructura (barra lateral, semana en columnas con casillas, tarjetas de progreso y prioridades, lista agrupada por categoría con contador y punto de color, pestañas en píldora, botón de acción principal arriba a la derecha), no el nombre ni los textos. La app se llama **Nova**.

### 3.1 Tokens (variables CSS en `src/app/globals.css`)

Un solo lugar para los colores. Los componentes usan solo tokens, nunca colores sueltos.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--color-fondo` | `#FAF6F0` (crema) | `#1A1613` | Fondo de la página |
| `--color-superficie` | `#FFFFFF` | `#24201C` | Tarjetas |
| `--color-superficie-2` | `#F3ECE3` | `#2E2924` | Barra lateral, pestañas inactivas, celdas |
| `--color-borde` | `#E8DED2` | `#3A332D` | Bordes |
| `--color-texto` | `#2B2420` | `#F2ECE6` | Texto principal |
| `--color-texto-suave` | `#6B5F56` | `#B8ADA3` | Texto secundario |
| `--color-acento` | `#B4471F` (terracota) | `#E07A52` | Único acento: botón principal, ítem activo, anillo, foco |
| `--color-acento-texto` | `#FFFFFF` | `#1A1613` | Texto sobre el acento |
| `--color-acento-suave` | `#F6E3D9` | `#3D2A21` | Fondo del ítem activo y de insignias de acento |
| `--color-exito`, `--color-aviso`, `--color-peligro` | verde, ámbar, rojo oscuros | sus versiones claras | Estados (aprobado, en riesgo, perdido) y prioridades |

Requisito comprobable: todo par texto/fondo de los tokens tiene contraste **≥ 4,5:1** en ambos modos (prueba automática, sección 11.1). Los valores de la tabla se ajustan en E02 si la prueba lo exige.

Las categorías no usan colores libres: se elige de una **paleta fija de 8 colores** (`terracota`, `ambar`, `oliva`, `verde`, `azul`, `violeta`, `rosa`, `gris`), cada uno con su versión clara y oscura que cumple contraste. Así ninguna elección del usuario rompe la legibilidad.

### 3.2 Componentes

- Tarjetas redondeadas (`rounded-2xl`) con sombra suave; pestañas en píldora; insignias de color con texto (prioridad, estado, categoría, nivel); íconos de `lucide-react` siempre acompañados de texto o con `aria-label`.
- `EncabezadoPantalla`: título, subtítulo y, si aplica, botón de acción principal a la derecha (en el teléfono, debajo del título).
- Foco visible en todo control (anillo del color de acento). Transiciones de 150 a 200 ms; desactivadas con `prefers-reduced-motion`.
- Modo **claro, oscuro o automático** (sigue al sistema). La preferencia se guarda por usuario (E11) y en el navegador; un script mínimo en el `<head>` aplica el tema antes de pintar para que no parpadee.
- Login, registro y recuperación de contraseña con el mismo estilo; su lógica no cambia.

## 4. Navegación y rutas

### 4.1 Secciones

| Sección | Ruta | Ícono (lucide) | Etapa en que entra al menú |
|---|---|---|---|
| Inicio | `/nova` | `House` | E03 (versión mínima), completa en E06 |
| Asistente | `/nova/asistente` | `MessageCircle` | E03 |
| Calendario | `/nova/calendario` | `CalendarDays` | E07 |
| Tareas | `/nova/tareas` | `ListChecks` | E03 |
| Fuentes | `/nova/fuentes` | `FileText` | E10 (antes, "Documentos" y "Web" siguen como hoy) |
| Productividad | `/nova/productividad` | `ChartColumn` | E03 |
| Semestre | `/nova/semestre` | `GraduationCap` | E12 |
| Configuración | `/nova/configuracion` | `Settings` | E11 (E05 la creó con Categorías; E05b movió las categorías a Tareas y la sacó del menú hasta E11) |

### 4.2 Computador (≥ 1024 px)

Barra lateral fija a la izquierda con la marca "Nova", las secciones disponibles, el correo del usuario y "Cerrar sesión". El ítem activo lleva fondo de acento suave y `aria-current="page"`.

### 4.3 Teléfono y tableta (< 1024 px)

- Barra inferior fija con 5 botones: **Inicio, Calendario, Asistente (al centro, destacado con el color de acento), Tareas, Más**. Respeta `env(safe-area-inset-bottom)`.
- **Más** abre una hoja inferior con el resto de secciones (Fuentes, Productividad, Semestre, Configuración) y "Cerrar sesión". Se cierra con Escape, con el botón "Cerrar" o tocando fuera; el foco queda atrapado mientras está abierta.
- Botón flotante **"+"** sobre la barra inferior (no en la pantalla del Asistente, para no tapar el campo de pregunta). Abre un menú con **"Nueva tarea"** (`/nova/tareas/nueva`) y **"Subir documento"** (Fuentes, pestaña Subir PDF).
- Mientras Calendario o Semestre no existan, su lugar en la barra inferior lo ocupa otra sección existente (regla "sin botones muertos"). En E03 el lugar de Calendario lo ocupa Documentos y la hoja "Más" tiene Web y Productividad.
- Si la sección actual está dentro de "Más", el botón "Más" se resalta y lleva `aria-current="true"` (no solo color).

### 4.4 Rutas que cambian

| Antes | Después | Cómo |
|---|---|---|
| `/nova` (Asistente) | `/nova` es Inicio; el chat pasa a `/nova/asistente` | A-01 sigue: `/nova` sin sesión → login. El login sigue llevando a `/nova`. |
| `/nova/documentos`, `/nova/documentos/nuevo` | `/nova/fuentes?pestana=pdf` | Redirección permanente (E10) |
| `/nova/web` | `/nova/fuentes?pestana=web` | Redirección permanente (E10); desde E10c2 abre "Fuentes guardadas" |

Las rutas de la API (`/api/nova/...`) que ya existen no cambian de nombre ni de contrato; solo se agregan rutas nuevas.

## 5. Pantallas

### 5.1 Inicio (`/nova`)

1. **"Pregúntale a Nova"**: bloque destacado arriba, con un campo de una línea y botón "Preguntar". Al enviar, lleva a `/nova/asistente` con la pregunta enviada (no solo prellenada). Valida RN-02 en vivo, igual que el chat.
2. **Mi semana** (desde 1280 px, como máximo 4 tareas por columna y "+N más" abre el día completo en su columna, con "Ver menos"; en cada día, las completadas van al final; pedido del usuario): lunes a domingo de la semana actual (Bogotá), con flechas para la semana anterior y siguiente y el rango ("3 – 9 de nov."). Desde 1280 px, 7 columnas (por debajo cada columna no alcanza para las insignias); en teléfono, tableta y laptops pequeñas, una fila de 7 días para elegir y la lista del día elegido. En las columnas, las insignias van en su propia línea y un nombre de categoría realmente largo se corta con "…" (completo en `title`); "Universidad" o "Programación" se leen enteros. El lápiz de editar va siempre al final de la línea de la prioridad (ajuste del usuario en E09). Cada tarea muestra casilla, título, insignia de categoría y prioridad. Las tareas se ubican por **fecha límite**.
3. Marcar la casilla de una tarea pendiente abre **el mismo diálogo de minutos** que en Tareas (componente `AccionesTarea`), porque el índice y las metas dependen de esos minutos. Cancelar no cambia nada. Una tarea completada no se puede desmarcar (como hoy).
4. **Progreso semanal**: anillo con el porcentaje de tareas completadas de la semana mostrada, y contadores de completadas, pendientes y total (sección 7.1).
5. **Prioridades de hoy**: tareas pendientes con fecha límite hoy, ordenadas por prioridad (Alta primero) y luego por título; debajo, "N tareas vencidas" con enlace a la vista "Vencidas" de Tareas (E08) si hay pendientes con fecha pasada. Botón "Agregar" → `/nova/tareas/nueva?fecha=<hoy>`.
6. (E06) La semana mostrada va en la URL (`/nova?semana=YYYY-MM-DD`, cualquier día de esa semana); "Esta semana" aparece al ver otra. El formulario de tarea acepta `?fecha=` válida (se adelantó de E07). Completar desde la casilla usa `FormularioMinutos`, el mismo formulario que Tareas (extraído de `AccionesTarea`), dentro de un `Dialogo`.

### 5.2 Asistente (`/nova/asistente`)

El chat actual con su historial. Si llega con una pregunta desde Inicio, la envía al cargar (una sola vez).

La vista sigue a la conversación (pedido del usuario, 2026-11-07): al abrir, se ve lo último; al enviar una pregunta, baja siempre hasta ella; al llegar la respuesta, baja hasta ella solo si el usuario sigue al final. Si subió a leer algo anterior, no lo mueve y aparece el botón "Ir al final". La zona visible descuenta la barra inferior del teléfono y el teclado (`visualViewport`); si el teclado se abre estando al final, el último mensaje sigue a la vista. Con "reducir movimiento", el desplazamiento es inmediato, sin animación.

Desde E02b (RB-30): sin documentos del usuario pero con al menos una tarea pendiente, el chat responde con las tareas y la pantalla muestra un aviso informativo con el enlace "Indexar un PDF": `Aún no hay documentos indexados: por ahora el asistente responde solo sobre tus tareas pendientes.`. Sin documentos ni tareas pendientes, se muestra el aviso de advertencia de siempre. El campo de pregunta nunca se bloquea.

### 5.3 Calendario (`/nova/calendario`)

- Vista mensual (lunes primero), con flechas de mes y botón "Hoy". Cada día muestra puntos del color de la categoría de sus tareas (máximo 3 puntos y "+N"), y un ícono distinto para fechas de Semestre (cortes y notas con fecha, por ejemplo un parcial) a partir de E13. Leyenda debajo.
- Tocar un día muestra debajo (teléfono) o al lado (computador) la lista de ese día: tareas (con completar, mismo diálogo) y eventos de Semestre (enlazan a la materia), y el botón **"Agregar tarea"** → `/nova/tareas/nueva?fecha=<día>`.
- El formulario de tarea acepta `?fecha=YYYY-MM-DD` válida y la pone en el campo (con la máscara); una fecha inválida se ignora.
- **Decisiones del usuario (E07, 2026-11-07):**
  - Los días muestran los puntos de color (máximo 3 y "+N").
  - En el computador, si cabe, cada día muestra el título corto con su hora: desde 1280 px, máximo 2 títulos y "+N más". Una vencida va en rojo y una completada tachada.
  - La lista del día ordena primero las tareas con horario, por hora; luego las demás, por prioridad; las completadas al final (el mismo orden de Mi semana).
  - Las pendientes vencidas llevan la insignia sutil "Vencida".
  - El botón dice "Agregar".
  - A 390 px el mes se lee sin letra diminuta: mínimo 12 px y celdas de 44 × 56 px.
  - Claro y oscuro; con "reducir movimiento", sin transiciones.
- **Ubicación de la lista del día:** debajo del mes hasta 1536 px y al lado desde 1536 px. Al lado, a 1280 px, las celdas quedaban de ~75 px y los títulos no se leían. Al elegir un día, si su lista no se ve entera, la página baja ya con la lista nueva dibujada (sin animación con "reducir movimiento"). En el computador la deja arriba de la pantalla, o lo más arriba que permita el final de la página; en el teléfono baja solo lo necesario, para no esconder el mes en cada toque. Si la lista ya se ve entera, no se mueve (ajuste pedido por el usuario).
- **El mes va en la URL** (`?mes=YYYY-MM`; si es inválido, se usa el mes actual).
  - En el mes actual, "Hoy" elige el día de hoy sin recargar.
  - En otro mes, "Hoy" vuelve al mes actual.
  - La cuadrícula tiene semanas completas (4 a 6) y muestra también las tareas de los días vecinos.
- `GET /api/nova/calendario` devuelve `eventos: {}` hasta E13: sin datos falsos.

### 5.4 Tareas (`/nova/tareas`)

- **Categorías dentro de Tareas (E05b, pedido del usuario):** arriba, una fila de categorías con su punto de color: "Todas", "General", las del usuario en orden alfabético y "+ Nueva". En el teléfono se desliza de lado en una sola fila (40 px de alto); desde 1024 px se acomoda en varias líneas si hace falta. Tocar una categoría filtra las tareas (`?categoria=`, sin distinguir mayúsculas, combinable con el estado). "+ Nueva" abre un diálogo (hoja inferior en el teléfono, recuadro centrado en el computador) con nombre y color, sin salir de Tareas. El menú de una categoría se abre con "⋯" (en la categoría elegida), dejándola presionada medio segundo o con clic derecho: "Renombrar", "Cambiar color" y "Eliminar" (con confirmación: sus tareas pasan a General). General dice "Por defecto" y solo ofrece "Cambiar color". Al renombrar la categoría filtrada, el filtro sigue con el nombre nuevo; al eliminarla, vuelve a "Todas".
- Pestañas en píldora: **Todas**, **Hoy** (fecha límite hoy, pendientes y completadas), **Importantes** (prioridad Alta y pendientes), **Completadas**.
  - La pestaña va en la URL (`?vista=hoy`; "Todas" no lleva parámetro).
  - Se combinan con la fila de categorías: cambiar de categoría conserva la pestaña y cambiar de pestaña conserva la categoría.
  - **Vista "Vencidas"** (`?vista=vencidas`, decisión del usuario del 2026-11-07): las pendientes con fecha límite antes de hoy. Es el destino de "N tareas vencidas" en Inicio. Su píldora solo aparece, activa, mientras se está en ella; las 4 pestañas acordadas no cambian. Los enlaces viejos `?estado=Pendiente` llevan a esta vista y `?estado=Completada` a "Completadas".
  - En el teléfono las píldoras van en una sola fila; si no caben, se deslizan de lado y la activa queda a la vista.
- Agrupación por categoría: encabezado con punto de color, nombre y contador **completadas/total** del grupo dentro de la pestaña (por ejemplo "Universidad 1/3").
  - Orden de los grupos: General primero y luego alfabético, como la fila de categorías.
  - Dentro de cada grupo: las tareas con casilla, título, fecha, prioridad y acciones (completar, eliminar) como hoy, con las completadas al final.
  - Con una categoría elegida en la fila, queda un solo grupo.
  - En el computador, cada grupo es una tabla sin la columna "Categoría", con anchos fijos desde 1280 px para que las columnas queden alineadas entre grupos. En el teléfono, tarjetas.
  - **"Vencida"** (insignia roja suave): en las pendientes con fecha límite pasada, en Tareas y en Mi semana (además del Calendario, E07).
- Botón principal "Nueva tarea". En E08 el campo de categoría (también al editar, E09) es una lista con las categorías del usuario y su color, que se filtra al escribir y ofrece `Crear "X"` si no existe; la categoría nueva se crea al guardar la tarea (RB-33), no al escribir. Detalles de E08:
  - Patrón combobox de ARIA: flechas, Enter elige sin enviar el formulario, Escape cierra.
  - Al abrir se ven todas las categorías; la lista se filtra al escribir.
  - ‘Crear “X”’ aparece solo si no hay una categoría igual sin distinguir mayúsculas ni espacios.
  - Debajo, el aviso `Se creará la categoría «X» al guardar la tarea.`.
  - Escribir " universidad " sin elegir guarda "Universidad" (RB-33).
- **Editar** (E09): cada tarea pendiente tiene la acción "Editar" en Tareas, en Inicio y en la lista del día del Calendario. Lleva a `/nova/tareas/[id]/editar`, con el mismo formulario de crear (componente `FormularioTarea`) ya lleno con título, categoría, prioridad, fecha límite y horario (RB-34). Mismas validaciones y mensajes que al crear (RN-01, RN-03, RN-04, RN-07 y la máscara AAAA-MM-DD, con el aviso de fecha pasada). "Guardar cambios" vuelve a la pantalla de origen (`?volver=`, solo rutas internas de Nova; desde el Calendario, al mismo día con `?dia=`); "Cancelar" vuelve sin cambiar nada. Las tareas completadas no se editan (RB-29).

### 5.5 Fuentes (`/nova/fuentes`)

Pestañas **Subir PDF** (subida e índice de documentos actuales, con eliminar) y **Buscar en la web** (búsqueda en Wikipedia actual), con `?pestana=pdf` (por defecto) o `?pestana=web`. El formulario y la lista "Tus documentos" están en la misma pantalla: al indexar, la lista se actualiza sin salir. **Desde E10c2 las pestañas son Subir PDF y Fuentes guardadas:** la búsqueda en Wikipedia pasa al Asistente ("Buscar en", RB-58), no guarda nada por sí sola y su resultado trae el botón **"Guardar fuente"**; la categoría se usa al guardar (RB-55). `?pestana=web` abre Fuentes guardadas. **Fuentes guardadas** (E10b2, RB-54): por categoría con su cupo ("General 3/20"), cada una con el nombre del artículo enlazado a Wikipedia, el resumen, la fecha y "Eliminar" con confirmación. A partir de E13, al subir un PDF se puede elegir como categoría una **materia** de Semestre (se guarda en `documentos.materia_id`); la lista muestra la materia.

### 5.6 Productividad (`/nova/productividad`)

El índice diario actual sin cambios, y debajo **Metas semanales**: lista de metas con barra de progreso de la semana actual ("7 de 10 tareas", "3 h 20 min de 5 h"), botón "Nueva meta" y eliminar con confirmación.

### 5.7 Semestre (`/nova/semestre`)

Pestañas **Materias y notas**, **Objetivos y plan**, **Estadísticas** (cada una aparece en su etapa).

- **Materias y notas** (calculadora de notas; definida por el usuario el 2026-11-07): lista de materias en tarjetas (nombre, créditos, **nota actual** con insignia Aprueba / En riesgo / No alcanza, fallas). Arriba, el **promedio del semestre** ponderado por créditos. Al abrir una materia:
  - **Componentes de evaluación** con su porcentaje, definidos por el usuario (por ejemplo, Parcial 40 %, Talleres 20 %, Quizzes 20 %, Actividades 20 %). Deben sumar 100 %; si no, se ve el aviso RB-08, que no impide guardar.
  - En cada componente, sus **notas** (nombre y fecha opcionales; nota o "sin nota"), que **se promedian por igual**. Por ejemplo, 5 quizzes valen juntos el 20 % (4 % cada uno). Una nota registrada "sin nota" cuenta como pendiente. Ayuda en pantalla: `Agrega también las notas que aún no tienes (sin nota) para que cuenten como pendientes.`
  - **Cortes (opcional):** "Dividir en cortes" reparte la materia en cortes con porcentaje (por ejemplo 30 % + 30 % + 40 %) y fecha opcional. Cada corte tiene sus propios componentes. Sin cortes, los componentes son de la materia.
  - **Calculadora:**
    - La **nota actual**, solo con lo calificado (lo que falta no cuenta como 0).
    - Lo **asegurado** (lo que ya se ganó aunque lo que falta saliera 0).
    - Con cortes, la nota de cada corte.
    - **"¿Cuánto necesito?"** en lo que falta, para aprobar o para una **nota meta** que el usuario escribe ahí mismo (RB-18; no se guarda). Por defecto se usa la nota para aprobar, o la meta guardada de E16 si existe. Dice si ya es imposible (con la nota máxima alcanzable) o si ya está asegurado (RB-12).
- **Objetivos y plan**: por materia y corte, la meta, si es alcanzable, los temas del corte y el plan de estudio con sus versiones.
- **Estadísticas**: evolución de notas por corte (una materia sin cortes muestra solo su nota actual), comparación entre materias y materias en riesgo.

### 5.8 Configuración (`/nova/configuracion`)

Bloques: **Perfil** (nombre editable, correo de solo lectura, cambiar contraseña), **Apariencia** (claro, oscuro, automático; formato de hora de 24 o 12 horas, 24 por defecto, pedido del usuario en E06b), **Académico** (escala 0,0 a 5,0 de solo lectura, nota para aprobar, redondeo truncar/redondear, cortes por defecto), **Asistente** (borrar todo el historial, aviso de Gemini) y **Cerrar sesión**.

### 5.9 Libros en PDF (E10b a E10d, pedido del usuario del 2026-11-07)

- **Páginas (E10b):** al indexar, el texto se extrae página por página. Cada fragmento guarda su página o su rango (por ejemplo 45–46) y toda cita lo muestra: `libro.pdf · p. 45` o `libro.pdf · pp. 45–46` (RB-36). Se usa el número impreso en el libro (las etiquetas de página del PDF) cuando existe; si no, el número de página del PDF.
- **Capítulos (E10b):** se toman del índice interno del PDF. Si no tiene índice, de los encabezados al comienzo de una página ("Capítulo 3", "Unidad 2", "Tema 4", "Chapter 5"). En Fuentes, cada documento indexado con páginas tiene "Ver capítulos" (`/nova/fuentes/[id]/capitulos`): la lista con su título y sus páginas, o el mensaje de RB-37 si no hay (RB-37).
- **Libros largos (E10b):** la indexación se hace por partes y se puede reanudar. Cada llamada del navegador procesa una parte, así el porcentaje sube en pantalla. Solo avanza con Fuentes abierta (aviso `Deja esta pantalla abierta hasta que termine.`); si se sale o se bloquea el teléfono, se detiene y sigue al volver, sin perder lo avanzado. **Desde E11c** ya no depende de la pantalla: el aviso de cada minuto termina la indexación en segundo plano (RB-57), y la tarjeta dice `Puedes cerrar esta pantalla: seguirá sola.` Hasta 15 MB (RN-01 no cambia) y 800 páginas (RB-38).
- **Preguntar por página o capítulo (E10c):** en el Asistente, "¿Qué dice la página 45?", "Resume el capítulo 3" o "Explícame el capítulo de fotosíntesis". Se responde con el texto de esa página o de ese capítulo, no con una búsqueda, y siempre se cita la página (RB-39, RB-40). Un selector "Buscar en" encima del campo permite elegir "Todos los documentos" o un documento; desde E10c2, también "Fuentes web" y "Wikipedia"; desde E10c3, "IA (conocimiento general)".
- **Explicar de otra manera (E10c):** debajo de cada respuesta que cita documentos, las opciones **Más simple**, **Con un ejemplo**, **Paso a paso**, **Resumen corto** y **Con una analogía**. Usan los mismos fragmentos de esa respuesta, sin buscar otra vez, y conservan las citas (RB-41).
- **IA general (E10c3):** solo cuando el usuario la elige en "Buscar en" o toca **"Preguntarle a la IA"** bajo un "No encontré". La respuesta lleva siempre la marca visible `Respuesta general de la IA, sin fuentes. Compruébala si es importante.`, no tiene citas ni "Explicar de otra manera", y el modelo no recibe documentos ni tareas (RB-59 a RB-61).
- **Plan de lectura (E10d):** desde "Ver capítulos", elegir capítulos, fecha de inicio y fecha final (o capítulos por semana). Se reparten en los días disponibles y se ve la lista "Leer cap. 3: Título (pp. 45–67)" con su fecha antes de confirmar. Al confirmar, se crea una tarea por capítulo (categoría elegida, RB-33; prioridad 2). Un capítulo que ya está en Tareas se marca y no se repite (RB-42).

### 5.10 Recordatorios y app instalable (E11b a E11d, pedido del usuario del 2026-11-07)

- **App instalable (E11b):**
  - Manifiesto con nombre "Nova", ícono y pantalla completa sin la barra del navegador (`display: standalone`), y un service worker para notificaciones y para la consulta sin conexión.
  - **Sin conexión, solo lectura** (decisión del usuario del 2026-11-09, que reemplaza la regla anterior de no guardar datos privados): Inicio, Tareas, Calendario del mes actual y capítulos muestran la última copia, con el aviso `Sin conexión · datos de las {HH:MM}`. Asistente, indexar PDF, cuestionarios, búsqueda web y crear, completar, editar o eliminar quedan desactivados (RB-62). La copia queda en el dispositivo y se borra según RB-63. En iPhone, el sistema puede borrarla si la app no se usa por un tiempo.
  - En Configuración → "Instalar Nova", una guía sencilla:
    - iPhone: Safari › Compartir › Agregar a inicio.
    - Android: menú › Instalar app, o el botón "Instalar" cuando Chrome lo ofrece.
  - La guía aparece también donde haga falta, por ejemplo al activar notificaciones en un iPhone que aún no la instaló.
  - En el iPhone, la app instalada tiene su propia sesión: la primera vez hay que iniciar sesión dentro de ella.
- **Recordatorio de una tarea (E11c):** campo "Recordatorio" en el formulario de crear y editar (RB-43).
  - Con horario: "A la hora", "15 min antes", "1 hora antes" y "1 día antes" (de la hora de inicio).
  - Sin horario: "El mismo día" y "El día anterior", a la hora fija de Configuración (8:00 por defecto).
  - Las completadas no avisan.
- **Notificación (E11c):**
  - Título "Nova" y texto como `En 15 min: Clase (10:00 – 11:00)` (RB-44). Se ve en la pantalla de bloqueo, como banner y en el centro de notificaciones, como las de cualquier app.
  - El numerito del ícono cuenta las notificaciones sin abrir (Badging API).
  - El sonido es el del sistema: la web no puede elegir un sonido propio. En el iPhone, que suene depende de iOS y de sus ajustes, y se comprueba en el teléfono del usuario en E11c.
  - Al tocarla, abre Nova en Tareas con esa tarea resaltada (`/nova/tareas?tarea=<id>`).
- **Permiso (E11c):** nunca al abrir la app. Se pide al tocar "Activar notificaciones", que aparece al elegir el primer recordatorio y en Configuración → Notificaciones (RB-45). Configuración → Notificaciones tiene, además:
  - "Enviar una de prueba";
  - la hora fija para tareas sin horario;
  - el resumen diario;
- **Sin notificaciones activas:** no hay respaldo por correo (decisión del usuario, 2026-11-09). El campo "Recordatorio" lo advierte y ofrece activarlas o usar "Agregar a mi calendario".
- **Extras (E11d):**
  - Resumen diario opcional por notificación, por la mañana: "Hoy: 3 tareas · 1 vencida" (RB-46). Configuración → Notificaciones → "Resumen diario" (casilla y hora, 7:00 por defecto, apagado al empezar). Cuenta las pendientes con fecha de hoy y las vencidas; al tocarlo abre Inicio. Se decide una vez al día, a la hora elegida: sin tareas, sin dispositivos o con más de 30 min de atraso no se manda y queda anotado en `envios`.
  - Botón "Agregar a mi calendario" en cada tarea pendiente, que descarga un `.ics` con la alarma del recordatorio para que la ponga el propio teléfono (RB-47). En Tareas: con texto en las tarjetas del teléfono y como ícono en la tabla del computador (ahí "Eliminar" también pasa a ícono para que las acciones sigan en una línea). Al tocarlo aparece el aviso de que es una copia. Sin horario, el evento es de todo el día y la alarma va a la hora fija de Configuración. Sin notificaciones activas, el formulario lo sugiere (`También puedes guardarla y usar «Agregar a mi calendario» en Tareas, para que te avise el calendario del teléfono.`).

### 5.11 Cuestionarios (E10e y E10f, pedido del usuario del 2026-11-09)

- **Crear:** en Fuentes, en cada documento con páginas y en "Ver capítulos", el botón "Crear cuestionario". Se elige el alcance (documento completo, un capítulo o un rango de páginas), cuántas preguntas (5, 10 o 20) y la dificultad (fácil, media o difícil).
- **Responder (`/nova/cuestionarios/[id]`):**
  - Una pregunta por pantalla, con "Pregunta 3 de 10" y 4 opciones.
  - Cada opción es una fila de todo el ancho, de al menos 56 px de alto y letra de 16 px, fácil de tocar en el teléfono.
  - Al elegir, la respuesta queda fija. Se marca si acertaste, con ícono y texto (no solo con color), la opción correcta, una explicación corta y la cita de la página (`libro.pdf · p. 45`).
  - Cada respuesta se guarda al momento: si se cierra la pantalla, el intento sigue donde iba.
  - La respuesta correcta no llega al navegador hasta que se responde.
- **Al final:** el puntaje de 0 a 5, los aciertos, las preguntas falladas con su explicación y los botones "Repetir solo las que fallé" y "Hacer de nuevo". Ninguno de los dos llama a Gemini: usan las mismas preguntas.
- **Historial (E10f, `/nova/cuestionarios`):** intentos por documento y por capítulo, con fecha, dificultad y puntaje, y si mejoraste respecto al intento anterior del mismo cuestionario. Los repasos de falladas se marcan "Repaso" y no cuentan para esa comparación. Se llega desde Fuentes y desde "Ver capítulos" (este, filtrado por el documento), pedido del usuario del 2026-11-12.
- **Sugerencia de repaso (E10f):** si en un capítulo fallaste 2 preguntas o más, el resultado ofrece crear la tarea "Repasar cap. 3: Título (pp. 45–67)". Se confirma en un diálogo; nunca se crea sola.
- **El puntaje no afecta las notas de Semestre.**

### 5.12 Tipos de pregunta (E10g, pedido del usuario del 2026-11-13)

Se hace después de E11d. Al crear un cuestionario se elige **Tipo de preguntas**:

| Tipo | Cómo se responde | Cómo se califica |
|---|---|---|
| **Selección única** | 4 opciones (A a D) y una correcta, como en E10e. Se responde al tocar | 1 o 0 |
| **Respuesta múltiple** | 4 opciones, de las que 2 o 3 son correctas, y la pregunta dice cuántas: `Hay {k} respuestas correctas.` Se marcan las casillas y se toca "Enviar respuesta" | Puntaje parcial (7.12): cada correcta marcada suma, cada incorrecta marcada resta y la pregunta nunca baja de 0 |
| **Verdadero o falso** | Una afirmación con los botones "Verdadero" y "Falso" | 1 o 0. Si es falsa, la explicación dice qué es lo correcto según la cita |
| **Completar** | Una frase tomada de la cita con un espacio en blanco (`_____`). Se escribe lo que falta y se toca "Enviar respuesta" | 1 o 0. Se acepta sin importar mayúsculas, tildes ni espacios de más (7.13) |
| **Pregunta abierta** | Se escribe la respuesta y se toca "Enviar respuesta". Nova muestra la respuesta modelo con la cita y la página, y se marca "La tuve bien", "A medias" o "Mal" | 1, 0,5 o 0, según lo que marca el usuario. No se llama a Gemini para calificar |
| **Mixto** (por defecto) | Preguntas de los 5 tipos, intercaladas | Cada una según su tipo |

- **Todos los tipos conservan** lo de E10e y E10f:
  - la cita, la página y la explicación al responder;
  - la respuesta fija una vez enviada; en la abierta, también la autoevaluación;
  - "Repetir solo las que fallé" (cuenta como fallada toda pregunta con menos de 1 punto: una abierta "A medias" o una múltiple con puntaje parcial);
  - el historial de E10f, que muestra también el tipo del cuestionario;
  - la tarea de repaso, que cuenta las falladas de la misma forma.
- **Nada se adelanta al navegador:** antes de responder, no llega ninguna respuesta correcta, la palabra que falta ni la respuesta modelo, como en RB-50. Sí llega cuántas son correctas en una múltiple, porque la pregunta lo dice.
- **En una abierta**, la respuesta queda guardada al enviarla. Si se cierra la pantalla antes de calificarse, al volver se ven la respuesta modelo y los tres botones. El intento termina cuando todas las preguntas tienen respuesta y todas las abiertas están calificadas.
- **Teléfono:**
  - Verdadero o falso usa dos botones grandes.
  - La múltiple usa casillas de todo el ancho, de 56 px de alto como las opciones de E10e.
  - Completar y abierta usan un campo de texto; la abierta, uno de varias líneas.
- **Los cuestionarios que ya existen** son de selección única y siguen funcionando igual.
- **Costo:** igual que E10e, a lo sumo 2 llamadas a Gemini por cuestionario, y ninguna para calificar (9.7).

### 5.13 Crear tareas sin conexión (E11e, pedido del usuario del 2026-11-13)

Se hace después de E11d. **Solo crear:** completar, editar y eliminar siguen necesitando conexión (RB-62).

- **Dónde se crea:** "Registrar tarea", el botón "+" y "Nueva tarea" de Inicio y del Calendario abren el formulario también sin conexión. Su pantalla se guarda como las de RB-62 (su copia lleva las categorías del usuario). Mismas reglas y mensajes que con conexión (RN-04 a RN-08, RB-33, RB-34, RB-43); el recordatorio se puede elegir.
- **Al guardar sin conexión** (o si el pedido falla por la red, `esFallaDeRed`): la tarea queda en el dispositivo (IndexedDB), a nombre del usuario y con un identificador propio (`id_cliente`), y se vuelve a la pantalla anterior con `Guardada en este dispositivo. Se enviará cuando vuelva la conexión.` (RB-70).
- **Cómo se ve:** aparece en Tareas (en su categoría), en Mi semana y Prioridades de hoy de Inicio y en el Calendario (en su día), con la insignia `Pendiente de enviar` y sin casilla para completarla. Solo tiene "Descartar", con confirmación (RB-71). Tareas muestra arriba `{n} tareas pendientes de enviar` mientras haya.
- **Al volver la conexión con Nova abierta** (o al abrirla con conexión): se envían solas, en el orden en que se crearon, una pestaña a la vez, y el servidor nunca las duplica, aunque se reintente o haya dos pestañas abiertas (RB-72, 7.14). Al terminar: `Se enviaron {n} tareas que creaste sin conexión.` y las pantallas se actualizan. En el iPhone solo se envían con la app abierta (iOS no tiene envío en segundo plano para la web).
- **Recordatorio:** lo calcula el servidor cuando recibe la tarea (7.10), nunca antes. Si su momento pasó mientras estaba sin conexión, la tarea se guarda igual y se avisa (RB-73).
- **Si el servidor la rechaza** (por ejemplo, una categoría o una fecha que ya no es válida): queda en el dispositivo como `No se pudo enviar`, con el mensaje exacto del servidor, y los botones "Corregir" (abre el formulario lleno; al guardar se vuelve a enviar) y "Descartar" (RB-74).
- **Cerrar sesión con tareas sin enviar:** antes de cerrar, se avisa cuántas hay; si se confirma, se borran del dispositivo junto con la copia de RB-63. Las tareas pendientes de otro usuario nunca se envían con la sesión de este (RB-75).
- **Límite:** 50 tareas pendientes por dispositivo.

## 6. Modelo de datos

Migraciones nuevas M5 a M13 en `supabase/migrations/`, numeradas después de `20261003136000`. Todas aditivas.

### 6.1 M5 · Dueño en las tablas existentes (E01)

```sql
-- Configuración de la instancia: quién es el dueño de lo que inserte el código de master.
CREATE TABLE IF NOT EXISTS nova_config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
-- valor de 'dueno_por_defecto' = id en auth.users del correo incorporado en src/modules/auth/admin.ts

ALTER TABLE tareas_personales ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE documentos        ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE fuentes_web       ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;

-- Lo existente pasa al dueño por defecto.
UPDATE ... SET usuario_id = (SELECT valor::uuid FROM nova_config WHERE clave = 'dueno_por_defecto') WHERE usuario_id IS NULL;

-- Compatibilidad con master: sus INSERT no envían usuario_id; el disparador lo completa.
CREATE FUNCTION asignar_dueno_por_defecto() RETURNS trigger ... -- si NEW.usuario_id IS NULL, toma nova_config
CREATE TRIGGER ... BEFORE INSERT ON tareas_personales / documentos / fuentes_web FOR EACH ROW ...

CREATE INDEX ... (usuario_id) en las tres tablas;

-- Búsqueda por usuario (y opcionalmente por materia, desde M8). buscar_fragmentos se conserva para master.
CREATE FUNCTION buscar_fragmentos_usuario(consulta vector(768), limite int, usuario UUID) ...
```

- La columna queda **nullable**: si faltara `nova_config`, las inserciones de `master` no fallan. El código nuevo siempre envía `usuario_id`.
- `buscar_fragmentos_usuario` es plpgsql y fija `hnsw.iterative_scan = strict_order` con `set_config(..., true)` (solo dura la transacción) para que el filtro por dueño no devuelva menos filas de las pedidas. Supabase no permite ponerlo como cláusula `SET` de la función.
- RLS ya está activo en esas tablas (M2); no se agregan políticas.
- `fragmentos_pdf` no necesita columna: su dueño es el de su documento.
- El correo del dueño por defecto se lee en E01 de `src/modules/auth/admin.ts`; la migración lo busca en `auth.users` y falla con un mensaje claro si no existe (sin dejar la base a medias, porque `db:migrar` usa una transacción).
- **Nota: el disparador es temporal.** Solo existe porque el código de `master` en producción inserta sin `usuario_id`. Al unir `ampliacion` con `master` se revisa y se quita: una migración final borra el disparador y la función `asignar_dueno_por_defecto` (y `nova_config` si nada más la usa), tras comprobar que no quedan filas sin dueño; entonces `usuario_id` puede pasar a `NOT NULL`. Mientras el disparador exista, cualquier fila sin dueño queda a nombre de la cuenta del usuario. Es una tarea de la etapa E21.

### 6.2 M6 · Categorías (E05)

| Tabla | Columnas | Restricciones |
|---|---|---|
| `categorias` | `id` UUID, `usuario_id`, `nombre` VARCHAR(80), `color` TEXT, `creada_en` | `UNIQUE (usuario_id, lower(nombre))` (índice único), `color` en la paleta fija (CHECK), nombre recortado no vacío |

- Las tareas conservan `tareas_personales.categoria` como texto; el color se busca por nombre (sin distinguir mayúsculas). Una categoría usada en tareas pero no registrada se muestra en gris.
- La migración siembra, por cada usuario con tareas, una categoría por cada nombre distinto ya usado (escrito como la primera vez), con colores de la paleta en orden sin gris; "General" siempre existe, es gris y se crea sola la primera vez que se necesita.
- General no se renombra ni se elimina; sí se le cambia el color. Una categoría nueva sin color toma el siguiente libre de la paleta (sin gris; si se usaron todos, vuelve a empezar).
- Renombrar una categoría actualiza también `categoria` en las tareas de ese usuario, en la misma transacción. Eliminarla pide confirmación y pasa sus tareas a "General".

### 6.3 M7 · Preferencias (E11)

| Tabla | Columnas | Restricciones |
|---|---|---|
| `preferencias_usuario` | `usuario_id` (PK), `tema` (`claro`/`oscuro`/`automatico`), `formato_hora` (`24`/`12`, default `24`; agregado en E11 por el pedido de E06b), `nota_aprobar` NUMERIC(3,2) default 3.00, `redondeo` (`truncar`/`redondear`) default `truncar`, `cortes_defecto` INTEGER[] default `{3000,3000,4000}` (centésimas de punto porcentual), `actualizado_en` | `nota_aprobar` entre 0 y 5; cada corte > 0 y suma 10000 |

Sin fila, se usan los valores por defecto. El nombre del perfil vive en `public.users.full_name` (ya existe). `nota_aprobar` es la nota mínima para aprobar de todas las materias (3,0 por defecto). `cortes_defecto` es solo la plantilla que se propone cuando una materia se divide en cortes (desde 2026-11-07 los cortes son opcionales).

### 6.4 M8 · Semestre (E12)

Modelo de la calculadora de notas (definido por el usuario el 2026-11-07): materia → cortes (opcionales) → componentes de evaluación → notas.

| Tabla | Columnas | Restricciones |
|---|---|---|
| `materias` | `id`, `usuario_id`, `nombre` VARCHAR(80), `creditos` SMALLINT, `docente` VARCHAR(120) NULL, `usa_cortes` BOOLEAN NOT NULL DEFAULT false, `creada_en` | `UNIQUE (usuario_id, lower(nombre))`; créditos 1 a 10; `UNIQUE (id, usuario_id)` |
| `cortes` | `id`, `materia_id`, `usuario_id`, `orden` SMALLINT, `nombre` VARCHAR(40), `porcentaje` INTEGER (centésimas: 3000 = 30 %), `fecha` DATE NULL | FK compuesta `(materia_id, usuario_id)` → `materias`, `ON DELETE CASCADE`; porcentaje 1 a 10000; `UNIQUE (materia_id, orden)`; `UNIQUE (id, usuario_id)` |
| `componentes` | `id`, `corte_id`, `usuario_id`, `orden` SMALLINT, `nombre` VARCHAR(80), `porcentaje` INTEGER (centésimas, dentro de su corte) | FK compuesta `(corte_id, usuario_id)` → `cortes`, `ON DELETE CASCADE`; porcentaje 1 a 10000; `UNIQUE (corte_id, lower(nombre))`; `UNIQUE (id, usuario_id)` |
| `notas` | `id`, `componente_id`, `usuario_id`, `orden` SMALLINT, `nombre` VARCHAR(120) NULL, `nota` SMALLINT NULL (centésimas: 375 = 3,75), `fecha` DATE NULL | FK compuesta `(componente_id, usuario_id)` → `componentes`, `ON DELETE CASCADE`; nota 0 a 500 o NULL ("sin nota", pendiente) |
| `documentos` (columna nueva) | `materia_id` UUID NULL | FK → `materias (id)` `ON DELETE SET NULL` |

- Notas y porcentajes se guardan como **enteros en centésimas** para calcular sin errores de coma flotante (sección 7).
- **Materia sin cortes** (`usa_cortes = false`, el valor por defecto): tiene internamente **un único corte de 100 %** que la pantalla no muestra. Sus componentes cuelgan de ese corte. Así, metas, temas y plan de estudio (E16 a E19) funcionan igual con cortes o sin ellos. La fecha de ese corte se muestra como "Fecha final de la materia".
- **Dividir en cortes:** el corte único pasa a ser el Corte 1, conserva sus componentes y toma el primer porcentaje de `cortes_defecto`. Se agregan los demás cortes de la plantilla ("Corte 2", "Corte 3"), sin componentes. **Quitar los cortes** solo se permite con un único corte (RB-35); ese corte vuelve a 100 % y queda oculto.
- Al crear una materia se crea su corte único y una categoría de tareas con el mismo nombre, si no existe.
- Las sumas de porcentajes (cortes de una materia; componentes de un corte) **no impiden guardar**: si no son 100 %, la pantalla muestra el aviso (RB-07, RB-08) y la calculadora no da estado ni "¿Cuánto necesito?" (sección 7.4). Por eso no hay CHECK de suma.
- `buscar_fragmentos_usuario` gana un parámetro opcional `materia UUID DEFAULT NULL` (nueva función con otro nombre si cambiar la firma afectara algo; nunca se toca `buscar_fragmentos`).

### 6.5 M9 · Fallas (E14)

Columnas nuevas en `materias`: `fallas_limite` SMALLINT NULL (≥ 0; NULL = sin límite registrado) y `fallas_registradas` SMALLINT NOT NULL DEFAULT 0 (≥ 0).

### 6.6 M10 · Metas semanales (E15)

| Tabla | Columnas | Restricciones |
|---|---|---|
| `metas_semanales` | `id`, `usuario_id`, `tipo` (`tareas`/`minutos`), `categoria` VARCHAR(80) NULL (NULL = global), `objetivo` INTEGER, `creada_en` | `objetivo` > 0 (tareas) o > 0 minutos; `UNIQUE (usuario_id, tipo, lower(coalesce(categoria,'')))` |

Las metas son permanentes: aplican a cada semana hasta que se eliminan. El progreso no se guarda; se calcula (sección 7.6).

### 6.7 M11 · Metas de nota (E16)

| Tabla | Columnas | Restricciones |
|---|---|---|
| `metas_nota` | `id`, `usuario_id`, `materia_id`, `corte_id` NULL (NULL = meta de la materia), `meta` SMALLINT (centésimas) | FK compuestas al dueño; meta 1 a 500; `UNIQUE (materia_id, corte_id)` con `NULLS NOT DISTINCT` |

### 6.8 M12 · Temas (E17)

| Tabla | Columnas | Restricciones |
|---|---|---|
| `temas` | `id`, `usuario_id`, `corte_id`, `nombre` VARCHAR(200), `origen` (`manual`/`asistente`), `estado` (`propuesto`/`confirmado`), `fuente` TEXT NULL (etiqueta del fragmento del syllabus, p. ej. "syllabus.pdf · fragmento 2"), `creado_en` | FK compuesta a `cortes`; `UNIQUE (corte_id, lower(nombre))` |

Un tema manual nace `confirmado`; uno del asistente nace `propuesto` y el usuario lo confirma o lo descarta (descartar lo borra).

### 6.9 M13 · Plan de estudio (E18, E19)

| Tabla | Columnas | Restricciones |
|---|---|---|
| `planes_estudio` | `id`, `usuario_id`, `corte_id`, `creado_en` | `UNIQUE (corte_id)`; FK compuesta |
| `versiones_plan` | `id`, `plan_id`, `usuario_id`, `numero` INTEGER, `origen` (`asistente`/`manual`/`restaurada`), `contenido` JSONB, `huella` JSONB, `creada_en` | `UNIQUE (plan_id, numero)`; `contenido` cumple el esquema de la sección 9.3 (validado en el servidor) |
| `pasos_en_tareas` | `plan_id`, `paso_id` UUID, `tarea_id`, `usuario_id` | PK `(plan_id, paso_id)`; `tarea_id` → `tareas_personales` `ON DELETE CASCADE` |

La versión vigente es la de mayor `numero`. Nunca se modifica una versión: editar o restaurar crea una nueva.

### 6.10 M14 · Horario de tareas (E06b)

Columnas nuevas en `tareas_personales`: `hora_inicio TIME NULL` y `hora_fin TIME NULL`, con `CHECK (hora_fin IS NULL OR (hora_inicio IS NOT NULL AND hora_fin > hora_inicio))` (`tareas_horario_valido`). Solo aditiva: los INSERT del código de `master` las dejan en NULL.

### 6.11 M15 · Libros (E10b)

| Tabla | Columnas | Restricciones |
|---|---|---|
| `documentos` (columnas nuevas) | `paginas` SMALLINT NULL, `progreso` SMALLINT NULL (0 a 100 mientras se indexa por partes), `por_indexar` JSONB NULL (las partes que faltan, para reanudar), `indexando_hasta` TIMESTAMPTZ NULL (evita que dos pantallas indexen lo mismo) | `paginas` 1 a 800; `UNIQUE (id, usuario_id)` |
| `fragmentos_pdf` (columnas nuevas) | `pagina_inicio` SMALLINT NULL, `pagina_fin` SMALLINT NULL, `etiqueta_paginas` TEXT NULL (lo que se muestra: "45" o "45–46", con el número impreso si existe) | `pagina_fin >= pagina_inicio` |
| `capitulos` | `id`, `documento_id`, `usuario_id`, `orden` SMALLINT, `nivel` SMALLINT (1 capítulo, 2 sección), `titulo` VARCHAR(200), `pagina_inicio`, `pagina_fin`, `etiqueta_paginas` TEXT, `tarea_id` UUID NULL | FK compuesta al dueño, `ON DELETE CASCADE` con el documento; `tarea_id` → `tareas_personales` `ON DELETE SET NULL` (RB-42); `UNIQUE (documento_id, orden)` |

- Solo aditiva: los documentos ya indexados (y los que indexe `master`) quedan con páginas en NULL. La pantalla dice `Vuelve a indexar este documento para ver páginas y capítulos.`
- `buscar_fragmentos_usuario` devuelve también `etiqueta_paginas` (nueva función si cambiar la firma afectara algo; nunca se toca `buscar_fragmentos`).

### 6.12 M16 · Recordatorios (E11c, E11d)

| Tabla | Columnas | Restricciones |
|---|---|---|
| `tareas_personales` (columnas nuevas) | `recordatorio` TEXT NULL (`a_la_hora`, `15_min`, `1_hora`, `1_dia`; sin horario solo `a_la_hora` = el mismo día y `1_dia`), `recordatorio_en` TIMESTAMPTZ NULL (calculado en el servidor), `recordatorio_estado` TEXT NULL (`pendiente`, `enviado`, `omitido`) | CHECK de los valores; índice parcial sobre `recordatorio_en` donde `recordatorio_estado = 'pendiente'` |
| `suscripciones_push` | `id`, `usuario_id`, `endpoint` TEXT, `p256dh` TEXT, `auth` TEXT, `dispositivo` TEXT, `creada_en`, `ultimo_error` TEXT NULL | `UNIQUE (endpoint)`; RLS por dueño |
| `preferencias_usuario` (columnas nuevas, M7) | `hora_recordatorio` TIME default 08:00, `resumen_diario` BOOLEAN default false, `hora_resumen` TIME default 07:00 | — |
| `envios` | `id`, `usuario_id`, `tarea_id` NULL, `tipo` (`recordatorio`/`resumen`/`prueba`), `fecha` DATE, `resultado` TEXT, `creado_en` | `UNIQUE (usuario_id, tipo, fecha)` solo para `resumen` (índice parcial): un resumen por día |

- **Programación de los envíos:**
  - `pg_cron` y `pg_net` de Supabase llaman cada minuto a `POST /api/nova/recordatorios/tick`, con un secreto guardado en Supabase Vault (`RECORDATORIOS_SECRETO` en Vercel).
  - Se eligió así porque Vercel Hobby solo permite tareas programadas una vez al día y con hasta una hora de imprecisión. Cada minuto exige Vercel Pro (20 USD al mes).
  - Hasta E21, la llamada va a la vista previa con el encabezado de omisión de la protección de Vercel (`x-vercel-protection-bypass`). En E21 pasa a producción.
  - **Paso a producción (E21, TAREA 6), confirmado con el usuario el 2026-11-13:** cuando `master` ya tenga el código de E11c, `NOVA_TICK_URL` pasa a `https://nova-assistantsm-kappa.vercel.app/api/nova/recordatorios/tick`, se quita `VERCEL_AUTOMATION_BYPASS_SECRET` de `.env.local` y se ejecuta `npm run db:configurar-tick`: Vault queda con la dirección de producción y sin la omisión (el script la borra si la variable no está). Después se revoca la omisión en el proyecto de Vercel y se comprueba en `net._http_response` que las llamadas responden 200. Nunca antes de que producción tenga la ruta: si no, cada minuto respondería 404.
  - Las suscripciones push son por sitio: las activadas en la vista previa no sirven en producción. Tras el paso, el usuario vuelve a tocar "Activar notificaciones" en cada dispositivo, ya en producción (y reinstala la app desde producción).
- Solo aditiva: los INSERT de `master` dejan `recordatorio` en NULL.
- El tick hace una consulta real a la base cada minuto desde la aplicación, y eso cuenta como actividad para la pausa de Supabase (sección 13).

### 6.13 M17 · Cuestionarios (E10e, E10f)

| Tabla | Columnas | Restricciones |
|---|---|---|
| `cuestionarios` | `id`, `usuario_id`, `documento_id`, `capitulo_id` NULL, `pagina_desde` NULL, `pagina_hasta` NULL, `alcance` (`documento`/`capitulo`/`paginas`), `dificultad` (`facil`/`media`/`dificil`), `pedidas` SMALLINT (5, 10 o 20), `creado_en` | FK compuesta al dueño; `documento_id` `ON DELETE CASCADE`; `capitulo_id` `ON DELETE SET NULL`; `UNIQUE (id, usuario_id)` |
| `preguntas_cuestionario` | `id`, `cuestionario_id`, `usuario_id`, `orden`, `enunciado` VARCHAR(400), `opciones` JSONB (4 textos), `correcta` SMALLINT, `explicacion` VARCHAR(400), `cita_textual` TEXT, `etiqueta_paginas` TEXT, `capitulo_id` NULL | FK compuesta, `ON DELETE CASCADE`; `correcta` 0 a 3; `UNIQUE (id, usuario_id)`; `UNIQUE (cuestionario_id, orden)` |
| `intentos_cuestionario` | `id`, `cuestionario_id`, `usuario_id`, `preguntas` UUID[], `repaso_de` UUID NULL (el intento del que salen las falladas), `aciertos` SMALLINT NULL, `total` SMALLINT, `puntaje` SMALLINT NULL (centésimas, 0 a 500), `iniciado_en`, `terminado_en` NULL | FK compuesta, `ON DELETE CASCADE`; `UNIQUE (id, usuario_id)` |
| `respuestas_intento` | `intento_id`, `pregunta_id`, `usuario_id`, `elegida` SMALLINT, `acierto` BOOLEAN, `respondida_en` | PK `(intento_id, pregunta_id)`: una respuesta no se cambia |

- Solo aditiva y con RLS por dueño: `master` no la usa.
- Al eliminar un documento se borran sus cuestionarios e intentos; la confirmación de RN-22 lo dice.

### 6.14 M18 · Fuentes web en el Asistente (E10c2)

Columna nueva en `fuentes_web`: `vector vector(768) NULL`, con el embedding de su resumen. Función nueva `buscar_fuentes_web_usuario(consulta, limite, usuario)`, que solo mira las fuentes del usuario con vector. Solo aditiva: `master` no usa la columna y sus INSERT la dejan en NULL. Una fuente guardada antes de E10c2 se vectoriza la primera vez que se busca en "Fuentes web".

### 6.15 M19 · Contexto de las respuestas (E10c)

Columna nueva en `mensajes_chat`: `contexto JSONB NULL`, con `{ fragmentos: uuid[], continuacion?: { documentoId, orden, desde } }`. Guarda qué fragmentos usó cada respuesta, para "Explicar de otra manera" (RB-41) y para seguir un capítulo por partes (RB-40). No sale al navegador. Solo aditiva: los INSERT de `master` la dejan en NULL.

### 6.16 M20 · Dónde empieza cada página (E10c)

Columna nueva en `documentos`: `inicio_paginas INTEGER[] NULL`, la palabra en que empieza cada página. Como un fragmento cruza páginas, sirve para responder por página solo con el texto de esa página (RB-39). Solo aditiva: un documento indexado antes queda en NULL, limita la cita a la página y avisa que puede incluir texto de las vecinas.

### 6.17 M21 · Origen de los mensajes (E10c2)

Columna nueva en `mensajes_chat`: `origen TEXT NULL`, con `CHECK (origen IN ('web', 'wikipedia', 'ia'))`. NULL significa documentos y tareas, como todo lo anterior. Sirve para que el modelo reciba solo el historial del mismo origen (RB-61) y para mostrar la marca al recargar. Solo aditiva: los INSERT de `master` la dejan en NULL. Hasta E21, `master` no conoce la columna y mostraría esos mensajes como normales si se abre la misma conversación en producción.

### 6.18 M22 · Tipos de pregunta (E10g)

Antes de migrar: `npm run db:respaldar`. Las tablas de M17 ya están en la lista de respaldo y no hay tablas nuevas.

| Tabla | Cambio | Restricciones |
|---|---|---|
| `cuestionarios` | Columna nueva `tipo` TEXT NOT NULL DEFAULT `unica` | `tipo` en (`unica`, `multiple`, `vf`, `completar`, `abierta`, `mixto`) |
| `preguntas_cuestionario` | Columnas nuevas: `tipo` TEXT NOT NULL DEFAULT `unica`, `correctas` SMALLINT[] NULL (múltiple), `verdadero` BOOLEAN NULL (verdadero o falso) y `respuesta_texto` TEXT NULL (completar: lo que falta; abierta: la respuesta modelo). `opciones` y `correcta` pasan a admitir NULL | Un CHECK por tipo: `unica` con 4 opciones y `correcta` de 0 a 3; `multiple` con 4 opciones y de 2 a 3 `correctas` distintas de 0 a 3; `vf` con `verdadero`; `completar` con `respuesta_texto` de 1 a 40 caracteres; `abierta` con `respuesta_texto` de 20 a 400 caracteres |
| `respuestas_intento` | Columnas nuevas: `elegidas` SMALLINT[] NULL (múltiple), `texto` TEXT NULL (completar y abierta, hasta 1000 caracteres), `autoevaluacion` TEXT NULL (`bien`, `medias`, `mal`) y `puntos` SMALLINT NULL (centésimas de punto de la pregunta, de 0 a 100). `elegida` y `acierto` pasan a admitir NULL | `puntos` de 0 a 100; `acierto` = (`puntos` = 100) cuando hay puntos; en una abierta, `puntos` y `acierto` quedan en NULL hasta la autoevaluación |

- Solo agrega columnas y relaja restricciones:
  - `CHECK` de 4 opciones: se reemplaza por el CHECK por tipo, que las filas existentes ya cumplen.
  - `NOT NULL` de `opciones`, `correcta`, `elegida` y `acierto`: se quita.
  - No se borra ni se cambia ningún dato.
- Las filas existentes quedan con `tipo = 'unica'`, y sus respuestas reciben `puntos` = 100 o 0 según `acierto` en la misma migración, para que el puntaje se calcule igual. `master` no usa estas tablas.

### 6.19 M23 · Tareas creadas sin conexión (E11e)

Antes de migrar: `npm run db:respaldar`. No hay tablas nuevas.

| Tabla | Cambio | Restricciones |
|---|---|---|
| `tareas_personales` | Columna nueva `id_cliente` UUID NULL: el identificador que el dispositivo le dio a una tarea creada sin conexión | Índice único parcial `(usuario_id, id_cliente)` donde `id_cliente IS NOT NULL` |

- Solo aditiva: las tareas creadas con conexión y las de `master` quedan con `id_cliente` en NULL.
- Lo pendiente vive en el dispositivo (IndexedDB), no en la base: la base solo recibe la tarea cuando se envía.

## 7. Reglas de cálculo

Todas en funciones puras de `src/lib/reglas/` (sin red, sin base, sin reloj salvo `fechas.ts`), probadas con Vitest. Notas en centésimas (0 a 500), porcentajes en centésimas de punto (0 a 10000). Los productos se calculan con enteros; la división final y el redondeo, con aritmética exacta sobre esos enteros.

### 7.1 Semana (Inicio y metas)

- Semana = lunes a domingo, en la zona `America/Bogota`. `semanaDe(fecha)` devuelve el lunes y el domingo.
- Progreso semanal de Inicio, sobre las tareas del usuario con **fecha límite** dentro de la semana mostrada: total, completadas, pendientes = total − completadas, porcentaje = completadas / total (0 % si total = 0, sin dividir por cero), mostrado sin decimales y truncado.

### 7.2 Nota mostrada (redondeo configurable)

`mostrar(x)`, con x la nota exacta:
- **Truncar** (por defecto): el decimal de abajo. 2,96 → 2,9; 3,04 → 3,0.
- **Redondear**: a un decimal, la mitad hacia arriba. 2,95 → 3,0; 2,94 → 2,9.

**Aprobar se decide con el valor mostrado**: aprueba si `mostrar(nota) ≥ nota_aprobar`. Nunca puede verse "3,0" y decir que no aprueba. Esta misma regla se usa en "¿Cuánto necesito?", metas, estadísticas y riesgo.

### 7.3 Peso de cada nota

Un componente de porcentaje `p` (dentro de su corte) con `N` notas registradas (calificadas o "sin nota"):

- Cada nota pesa `p / N` dentro del corte. En la materia pesa `P × p / N`, con `P` el porcentaje del corte; sin cortes, `P` = 100 %.
- Un componente **sin notas registradas** queda pendiente completo.
- Los pesos `p / N` no siempre son exactos (20 % / 3). Se calculan como **fracciones de enteros** (numerador y denominador), sin decimales intermedios; solo el resultado final se redondea.

Ejemplo: Quizzes 20 % con 5 notas registradas, cada una de 4 %. Con 2 calificadas, hay 8 % calificado y 12 % pendiente.

### 7.4 Nota actual, asegurado y estado (de la materia o de un corte)

Con `w_j` el peso de cada nota calificada `n_j`:

- **Nota actual** = Σ (n_j × w_j) / Σ w_j: el promedio ponderado de lo calificado. Lo que falta **no cuenta como 0**. Sin nada calificado: RB-13.
- **Asegurado** `A` = Σ (n_j × w_j) / 100 %: lo que ya se ganó aunque lo que falta saliera 0. Se muestra como "Asegurado: 2,5 de 5,0".
- **Peso pendiente** `W` = 100 % − Σ w_j: todo lo no calificado, incluidos los componentes sin notas.
- Si `W` = 0, la nota actual es la **definitiva**.
- **Nota de cada corte:** la nota actual de ese corte, con sus componentes.
- **Estado:**
  - Con `W` = 0: "Aprobada" o "Reprobada", según `mostrar(definitiva)`.
  - Con `W` > 0: "Aprueba" (la nota actual aprueba), "En riesgo" (no aprueba, pero aprobar aún es posible) o "No alcanza" (aprobar ya no es posible, sección 7.5).
- **Porcentajes que no suman 100 %** (los cortes, o los componentes de algún corte): se muestra la nota actual con el aviso RB-07 o RB-08, pero no el estado ni "¿Cuánto necesito?", porque lo pendiente no está bien definido.

**Ejemplo hecho a mano** (S-12, B-28 y `probar:semestre`; truncar; aprobar con 3,0):

- Materia sin cortes: Parcial 40 % (3,5), Talleres 20 % (4,0 y 4,4), Quizzes 20 % (5 registrados: 3,0, 5,0 y 3 sin nota) y Actividades 20 % (sin notas).
- Pesos calificados: 40 + 20 + 8 = 68 %, así que `W` = 32 %.
- Puntos: 3,5 × 40 + 4,2 × 20 + 3,0 × 4 + 5,0 × 4 = 256.
- Nota actual = 256 / 68 = 3,76…, se muestra **3,7**.
- Asegurado = 2,56, se muestra **2,5**.

### 7.5 "¿Cuánto necesito?"

Para un objetivo `O` (la nota para aprobar de Configuración, la nota meta escrita en la calculadora o una meta guardada de E16), con lo asegurado `A` y el peso pendiente `W` de la materia (o del corte, para metas de corte). La nota `x` es la misma en cada nota pendiente:

- Se busca la nota uniforme `x` en todo lo pendiente tal que `mostrar(A + x × W / 100 %) ≥ O`. Como `mostrar` trunca o redondea, el umbral exacto es `O` (truncar) u `O − 0,05` (redondear).
- `x = (umbral − A) × 100 % / W`, **redondeada hacia arriba a la centésima** y mostrada con un decimal **hacia arriba** (para que alcanzarla garantice el objetivo).
- Si `x ≤ 0`: "Ya aseguraste {O}." Si `x > 5,0`: no es posible; se muestra la **nota máxima alcanzable** = `mostrar(A + 5,0 × W / 100 %)`. Si W = 0, no hay nada pendiente: se informa la definitiva.
- **Con el ejemplo de 7.4:**
  - Para 3,0: x = (3,00 − 2,56) / 0,32 = 1,375, se muestra **1,4**.
  - Para la meta 4,0: x = 4,5.
  - Para la meta 4,5: no es posible; lo máximo es 2,56 + 5,0 × 0,32 = 4,16, se muestra **4,1**.

### 7.6 Promedio del semestre

- **Promedio actual** = Σ (nota actual × créditos) / Σ créditos, sobre las materias con al menos una nota.
- **Promedio asegurado** = Σ (asegurado × créditos) / Σ créditos, sobre todas las materias.
- Ambos con precisión completa y mostrados con `mostrar`.

### 7.7 Fallas

`faltan = fallas_limite − fallas_registradas`. Con `faltan ≤ 0`: "Perdida por fallas". Con `1 ≤ faltan ≤ 2`: alerta. Sin límite registrado: no se calcula. Una materia perdida por fallas está "en riesgo" aunque sus notas aprueben.

### 7.8 Metas semanales (Productividad)

Sobre las tareas del usuario **completadas con `fecha_cierre` dentro de la semana actual** (lunes a domingo, Bogotá) y, si la meta tiene categoría, de esa categoría (sin distinguir mayúsculas):
- Tipo `tareas`: progreso = número de tareas.
- Tipo `minutos`: progreso = suma de `minutos_invertidos` (se configura en horas y minutos; se guarda en minutos).
- Porcentaje = min(progreso / objetivo, 100 %), truncado; "Cumplida" al llegar a 100 %.

Nota: el índice diario usa la **fecha límite**; las metas usan la **fecha de cierre** (cuándo se trabajó). Se explica en pantalla.

### 7.9 "¿Es alcanzable?" (metas de nota)

Con la regla 7.5 y la meta como objetivo: "Alcanzable: necesitas {x} en lo que falta", "Ya la aseguraste" o "No alcanzable: lo máximo posible es {y}". Para una meta de corte se usa el peso pendiente del corte.

### 7.10 Hora de un recordatorio (E11c)

En la zona `America/Bogota`, con la fecha límite `F`, la hora de inicio `H` (si hay) y la hora fija `R` de Configuración (8:00 por defecto):

| Recordatorio | Con horario | Sin horario |
|---|---|---|
| `a_la_hora` | F + H | F + R ("El mismo día") |
| `15_min` | F + H − 15 min | — |
| `1_hora` | F + H − 1 h | — |
| `1_dia` | F + H − 1 día | F − 1 día + R ("El día anterior") |

- Cruza bien la medianoche, el fin de mes y el fin de año (por ejemplo, 15 min antes de las 00:10 es 23:55 del día anterior).
- Se recalcula al crear, al editar (E09) y al cambiar la hora fija. Al completar o eliminar la tarea, se cancela.
- Si al guardar la hora ya pasó, la tarea se guarda con el aviso de RB-43 y queda `omitido`.
- **Envío** (cada minuto): se toman los `pendiente` con `recordatorio_en` entre ahora − 30 min y ahora, con `FOR UPDATE SKIP LOCKED`, y se marcan `enviado` en la misma transacción. Así una tarea nunca avisa dos veces. Los que se atrasaron más de 30 minutos (por ejemplo, si la base estuvo pausada) pasan a `omitido`.

### 7.11 Puntaje de un cuestionario (E10e)

`puntaje = aciertos × 500 / total`, en centésimas y truncado, y se muestra con un decimal truncado (7 de 10 → 3,5; 2 de 3 → 3,3; 20 de 20 → 5,0). No usa el redondeo académico de Configuración porque no es una nota de Semestre. Un repaso se califica sobre sus propias preguntas.

### 7.12 Puntos de una pregunta y puntaje con tipos (E10g)

- **Puntos de cada pregunta**, en centésimas de 0 a 100:
  - Única, verdadero o falso y completar: 100 o 0.
  - Abierta: "La tuve bien" 100, "A medias" 50 y "Mal" 0.
  - Múltiple, con `k` correctas, `b` correctas marcadas y `m` incorrectas marcadas: `max(0, trunc(100 × (b − m) / k))`. Ejemplos con k = 2: las 2 bien sin errores → 100; 1 bien → 50; las 2 bien y 1 mal → 50; 1 bien y 1 mal → 0. Con k = 3: 2 bien → 66; las 3 bien y 1 mal → 66.
- **Puntaje del intento** (reemplaza la fórmula de 7.11 sin cambiar sus resultados en selección única): `trunc(Σ puntos × 5 / total)`, en centésimas de 0 a 500, y se muestra con un decimal truncado como en 7.11.
- **Lo que se guarda en el intento:** `aciertos` cuenta las preguntas con 100 puntos. La pantalla de resultado dice `{a} de {n} bien` y, si hay parciales, `{p} a medias`.
- **Fallada:** toda pregunta con menos de 100 puntos.

### 7.13 Comparar una respuesta de completar (E10g)

Se comparan la respuesta escrita y `respuesta_texto` después de normalizarlas:
- se pasan a minúsculas;
- se quitan las tildes y la diéresis (á, é, í, ó, ú, ü → a, e, i, o, u), pero la ñ se conserva;
- se quitan los signos de puntuación del principio y del final;
- los espacios seguidos se dejan en uno.

Son iguales si coinciden después de normalizar. "  FOTOSINTESIS " acierta "fotosíntesis"; "fotosintesis." también; "fotosíntesis y respiración" no.

### 7.14 Enviar las tareas creadas sin conexión (E11e)

- **Identificador:** al guardar sin conexión, el dispositivo le da a la tarea un `id_cliente` (UUID). Ese mismo identificador viaja en cada reintento y al "Corregir".
- **En el servidor:** `POST /api/nova/tareas` con `idCliente` inserta con `ON CONFLICT (usuario_id, id_cliente) DO NOTHING`; si ya existía, responde con la tarea guardada, sin crear otra ni repetir la categoría nueva ni el recordatorio. Así, un reintento después de un corte, o dos pestañas que envían a la vez, nunca duplican.
- **En el dispositivo:** una sola pestaña envía a la vez (Web Locks, `navigator.locks`); las demás esperan y luego ven la lista vacía. Se envía al volver la conexión (`online`), al abrir Nova con conexión y cada 30 s mientras queden pendientes.
- **Resultado de cada envío:**
  - 200 o 201: se borra del dispositivo.
  - 4xx de validación (422, 400): queda `No se pudo enviar` con el mensaje del servidor y no se reintenta sola.
  - 401 o 403: se detiene sin borrar nada; se reintenta cuando vuelva a haber sesión del mismo usuario.
  - Red o 5xx: queda pendiente y se reintenta.
- **Cuál usuario:** cada tarea pendiente guarda el id del usuario que la creó y solo se envía con esa sesión.

## 8. Reglas de negocio y mensajes exactos

Los mensajes se usan **textualmente** en la interfaz y en la API. Los de `PLAN_NOVA.md` (sección 5.1 y 12.2) no cambian.

| ID | Regla | Mensaje exacto |
|---|---|---|
| RB-01 | Toda lectura y escritura se limita al usuario de la sesión | (404 genérico del recurso si no es suyo) |
| RB-02 | Nombre de categoría: recortado, 1 a 80 caracteres, único por usuario sin distinguir mayúsculas | `Ya existe una categoría con ese nombre.` |
| RB-03 | Color de categoría: uno de la paleta fija | `Elige un color de la lista.` |
| RB-04 | Eliminar categoría: sus tareas pasan a "General"; "General" no se elimina ni se renombra | `La categoría General no se puede eliminar.` / `La categoría General no se puede renombrar.` |
| RB-02b | (E05) Nombre de categoría vacío o de más de 80 caracteres | `Escribe un nombre de 1 a 80 caracteres.` (`NOMBRE_CATEGORIA_INVALIDO`, 422) |
| RB-05 | Nombre de materia único por usuario | `Ya existe una materia con ese nombre.` |
| RB-06 | Créditos enteros de 1 a 10 | `Los créditos deben ser un número entero entre 1 y 10.` |
| RB-07 | Los cortes de una materia deben sumar 100 %. Si no, es un aviso que no impide guardar (decisión del usuario, 2026-11-07; sección 7.4) | `Los porcentajes de los cortes suman {n} %; deben sumar 100 %.` |
| RB-08 | Los componentes de un corte (o de la materia sin cortes) deben sumar 100 %. Si no, es un aviso que no impide guardar | `Los porcentajes de los componentes suman {n} %; deben sumar 100 %.` (con cortes: `Los porcentajes de los componentes de {corte} suman {n} %; deben sumar 100 %.`) |
| RB-09 | Nota entre 0,0 y 5,0, con hasta dos decimales | `La nota debe estar entre 0,0 y 5,0.` |
| RB-10 | Porcentaje mayor que 0 y hasta 100, con hasta dos decimales | `El porcentaje debe ser mayor que 0 y como máximo 100.` |
| RB-11 | Nota para aprobar entre 0,0 y 5,0 | `La nota para aprobar debe estar entre 0,0 y 5,0.` |
| RB-12 | "¿Cuánto necesito?" (regla 7.5) | `Necesitas al menos {x} en lo que falta para llegar a {O}.` / `Ya aseguraste {O}.` / `Con lo que falta no es posible llegar a {O}. Lo máximo que puedes alcanzar es {y}.` |
| RB-13 | Sin notas | `Aún no hay notas registradas.` |
| RB-14 | Fallas (regla 7.7) | `Te quedan {n} fallas antes de perder la materia.` (con 1: `Te queda 1 falla antes de perder la materia.`) / `Perdiste la materia por fallas ({r} de {l}).` |
| RB-15 | Fallas: enteros ≥ 0 | `Las fallas deben ser un número entero mayor o igual a 0.` |
| RB-16 | Meta semanal: objetivo entero > 0 | `El objetivo debe ser un número entero mayor que 0.` |
| RB-17 | Meta semanal duplicada (mismo tipo y categoría) | `Ya tienes una meta igual.` |
| RB-18 | Meta de nota entre 0,1 y 5,0 | `La meta debe estar entre 0,1 y 5,0.` |
| RB-19 | Generar temas o plan requiere un corte con fecha futura | `Pon una fecha futura al corte para generar el plan.` |
| RB-20 | Generar el plan requiere al menos un tema confirmado | `Primero confirma al menos un tema del corte.` |
| RB-21 | Proponer temas requiere un PDF de la materia | `Sube un PDF de esta materia (por ejemplo, el syllabus) para proponer temas.` |
| RB-22 | El plan del asistente solo usa temas confirmados y cita solo PDF de la materia (sección 9.3); si no cumple, se descarta | `El plan generado no cumplía las reglas y se descartó. Intente de nuevo.` |
| RB-23 | Aviso de cambios (huella, sección 9.4); el plan nunca cambia solo | `Hay cambios desde la última versión del plan: {lista}. ¿Quieres actualizarlo?` |
| RB-24 | Un paso del plan pasa a Tareas una sola vez, con confirmación | `Este paso ya está en Tareas.` |
| RB-25 | Borrar el historial del asistente: definitivo, con confirmación | Confirmación: `Se borrará todo tu historial con el asistente. No se puede deshacer.` Resultado: `Se borró tu historial con el asistente.` |
| RB-26 | Nombre de perfil: recortado, 1 a 80 caracteres | `Escribe tu nombre.` |
| RB-27 | Tema de apariencia: claro, oscuro o automático | — |
| RB-28 | Cambiar contraseña: usa la ruta existente `/api/auth/password` y sus mensajes | (los de esa ruta) |
| RB-30 | Reemplaza a RN-15 en la ampliación (E02b). Con documentos del usuario, la consulta funciona como siempre (vector, 4 fragmentos y tareas solo si la pregunta las menciona, RN-12). Sin documentos pero con al menos una tarea pendiente, responde con las tareas pendientes: sin calcular el vector, sin filtro por palabras y como máximo las 50 de fecha límite más próxima (las vencidas primero, `TAREAS_CONTEXTO_MAX`); si la pregunta es de algo que solo estaría en un PDF, responde el mensaje exacto de siempre. Sin documentos ni tareas pendientes, `SIN_DOCUMENTOS`. Las 50 más próximas también limitan lo que se envía cuando hay documentos | `No encontré esto en tus documentos` y `Aún no hay documentos indexados. Indexe un PDF antes de preguntar.` (sin cambios). Aviso informativo nuevo: `Aún no hay documentos indexados: por ahora el asistente responde solo sobre tus tareas pendientes.` |
| RB-31 | (E02c) El contexto del Asistente empieza con la línea HOY: fecha de hoy, mañana y la semana actual (lunes a domingo), calculadas con la zona `America/Bogota` explícita, nunca con la hora del servidor (`lineaHoy`). Cada tarea lleva su fecha límite también como AAAA-MM-DD. Las preguntas de fechas sobre tareas (hoy, mañana, esta semana, qué vence primero) se responden con las tareas; si hay pendientes pero ninguna cae en el periodo, el modelo responde "No tienes tareas para {periodo}." y menciona la pendiente más próxima (y las vencidas, si hay). Las palabras semana, mañana (y manana), hoy y vencid se suman a las de RN-12 | `No tienes tareas para {periodo}.` (lo escribe el modelo siguiendo el System Prompt, no el servidor; se verifica con `probar:rag`, paso 12). Los mensajes exactos existentes no cambian |
| RB-32 | (Ajuste pedido por el usuario el 2026-11-07; reemplaza a RN-15 y al último caso de RB-30.) La pregunta nunca se bloquea por falta de documentos. El contexto lleva `DOCUMENTOS: el usuario aún no tiene documentos indexados.` cuando no hay documentos y `TAREAS PENDIENTES: ninguna.` cuando se consultaron las tareas y no hay pendientes. Pregunta sobre tareas sin pendientes → respuesta exacta; pregunta que necesita documentos sin tenerlos → respuesta exacta que lo explica (el servidor impone ambos textos y no muestra fuentes). Con documentos, "No encontré esto en tus documentos" sigue igual. La pantalla solo muestra avisos informativos (ninguno bloquea) | `No tienes tareas pendientes.` · `Aún no tienes documentos indexados, así que no puedo responder sobre documentos. Indexa un PDF para preguntar sobre él.` · Aviso sin documentos ni tareas: `Aún no tienes documentos indexados ni tareas pendientes. Puedes preguntar igual; para que el asistente responda sobre tus documentos, indexa un PDF.` |
| RB-33 | (E05b, pedido del usuario) La categoría de una tarea se resuelve en el servidor (`resolverCategoria`, dentro de la transacción de quien crea la tarea: formulario, E19 y cualquier forma futura, como el chat si se agregara): se recortan y unen los espacios y se compara sin mayúsculas; si existe, se usa su nombre guardado (" universidad " → "Universidad"); si no, se crea con el siguiente color libre; vacía → General. Nombres de 1 a 80 caracteres (aprobado por el usuario) | `Escribe un nombre de 1 a 80 caracteres.` |
| RB-34 | (E06b, pedido del usuario) Horario opcional de una tarea: hora de inicio y de fin en 24 horas (`HH:MM`). Puede haber solo inicio, nunca solo fin; el fin es posterior al inicio dentro del mismo día; no se valida que dos tareas se crucen. Se muestra como "8:00 – 9:30" (o "8:00") en Mi semana, Prioridades de hoy, Tareas y Calendario. En cada día, primero las tareas con hora (por hora de inicio) y después las demás (por prioridad y título); Prioridades de hoy mantiene su orden por prioridad. El Asistente recibe el horario de cada tarea. El formulario usa el selector de hora del navegador (su apariencia depende del teléfono; lo guardado y lo mostrado en la app es de 24 horas). E11 agregará la opción de ver 12 horas | `La hora debe tener formato HH:MM de 24 horas.` · `La hora de fin necesita una hora de inicio.` · `La hora de fin debe ser después de la de inicio.` (`HORA_INVALIDA`, `HORA_FIN_SIN_INICIO`, `HORA_FIN_ANTES`, 422) |
| RB-35 | (E12) Quitar los cortes de una materia solo se permite cuando queda uno (sección 6.4) | `Para quitar los cortes, deja solo uno.` |
| RB-36 | (E10b) Cada fragmento de un documento indexado desde E10b guarda su página o rango, y toda cita lo muestra. Número impreso si el PDF lo tiene; si no, el del PDF | En "Fuentes": `libro.pdf · p. 45` o `libro.pdf · pp. 45–46`. Dentro del texto (ajuste del usuario, 2026-11-09), corta y con las páginas seguidas unidas por párrafo: `[p. 45]`, `[pp. 45–46]`; con varios documentos en la respuesta, cada cita conserva su nombre. Al unir o quitar citas se limpian los separadores que queden; si todos los puntos seguidos de una lista tienen la misma cita, queda una sola al final. Documento anterior: `Vuelve a indexar este documento para ver páginas y capítulos.` |
| RB-37 | (E10b) Capítulos del índice interno del PDF; si no tiene, de encabezados al comienzo de página; si no hay ninguno, no se inventan | `No encontré capítulos en este PDF. Puedes preguntar por página.` |
| RB-38 | (E10b) Libro de hasta 800 páginas (y 15 MB, RN-01); se indexa por partes y se puede reanudar; mientras tanto no entra en las búsquedas | `El PDF tiene {n} páginas; el máximo es 800.` · Estado: `Indexando… {p} %` |
| RB-39 | (E10c) Pregunta por página ("página 45", "pág. 45", "p. 45"): se responde solo con el texto de esa página, sin búsqueda vectorial, y la cita no sale de ella. Con varios documentos con páginas y ninguno elegido en "Buscar en", se pregunta cuál | `Ese documento tiene {n} páginas.` · `¿En qué documento? Elígelo en "Buscar en".` |
| RB-39b | (E10c, ajuste del usuario) Sin respuesta con un documento elegido en "Buscar en" | `No encontré esto en «{documento}». Prueba con "Todos los documentos" en "Buscar en".` |
| RB-40 | (E10c) Pregunta por capítulo (por número o por título): todos los fragmentos del capítulo, hasta 60 (unas 30.000 palabras) por respuesta; si es más largo, se resume por partes a pedido del usuario | `El capítulo es largo: resumí las páginas {a}–{b}. Escribe "sigue con el resto" para continuar.` Las citas no salen de las páginas del capítulo. · Sin ese capítulo: `No encontré el capítulo {x} en este documento.` |
| RB-41 | (E10c) "Explicar de otra manera": 5 modos; solo bajo respuestas que citan documentos; usa exactamente los fragmentos de esa respuesta (sin buscar otra vez) y conserva sus citas; cada modo es una llamada a Gemini y queda en el historial | Mensaje del usuario en el historial: `Explícalo: {modo}` |
| RB-42 | (E10d) Plan de lectura: capítulos elegidos entre fecha de inicio y fecha final (o N capítulos por semana), repartidos en orden; vista previa antes de crear; un capítulo ya en Tareas no se repite | `La fecha final debe ser igual o posterior a la de inicio.` · `Este capítulo ya está en Tareas.` |
| RB-43 | (E11c) Recordatorio opcional de una tarea pendiente (regla 7.10); con horario, 4 opciones; sin horario, 2 a la hora fija | `Ese momento ya pasó: no se enviará el recordatorio.` (aviso; la tarea se guarda) |
| RB-44 | (E11c) Texto exacto de la notificación (título "Nova") | `Ahora: {t} ({h})` · `En 15 min: {t} ({h})` · `En 1 hora: {t} ({h})` · `Mañana: {t} ({h})` · sin horario: `Hoy: {t}` · `Mañana: {t}` |
| RB-45 | (E11c) El permiso de notificaciones se pide solo después de tocar "Activar notificaciones"; en un iPhone sin la app instalada se muestra la guía de E11b; si el permiso está negado, se explica y se ofrece "Agregar a mi calendario". Sin notificaciones activas en ningún dispositivo, el recordatorio queda `omitido` | `Para recibir avisos en el iPhone, primero agrega Nova a inicio.` · `Las notificaciones están bloqueadas. Actívalas en los ajustes del teléfono para Nova.` · `Activa las notificaciones para recibir este aviso.` |
| RB-46 | (E11d) Resumen diario opcional por notificación a la hora elegida (7:00 por defecto), uno por día, solo si hay tareas de hoy o vencidas | `Hoy: {n} tareas · {v} vencidas` (en singular cuando corresponde; la parte en cero no se dice: `Hoy: 2 tareas`, y solo vencidas `Hoy: 1 tarea vencida`) |
| RB-47 | (E11d) "Agregar a mi calendario": `.ics` con el evento (con horario, o de todo el día) y una alarma por el recordatorio | `Es una copia: si cambias la tarea en Nova, vuelve a agregarla.` |
| RB-48 | (E10e) Un cuestionario necesita un documento con páginas; se piden 5, 10 o 20 preguntas y dificultad fácil, media o difícil; un rango de páginas debe existir en el documento | `Vuelve a indexar este documento para ver páginas y capítulos.` · `El rango de páginas no es válido: este documento tiene {n} páginas.` |
| RB-49 | (E10e) Las preguntas no se inventan: si el texto no alcanza (menos de un fragmento por cada 2 preguntas, o menos de la mitad de las pedidas tras validar, con un mínimo de 3), no se crea; con parte de las pedidas, se crea y se avisa | `Este contenido no alcanza para un cuestionario. Elige más páginas o menos preguntas.` · `Solo pude sacar {k} de {n} preguntas de este contenido.` |
| RB-50 | (E10e) Validación de cada pregunta en el servidor (9.6): cita literal dentro del fragmento citado, 4 opciones distintas y una sola correcta. La correcta no se envía al navegador antes de responder | (se descarta sin mensaje; aplica RB-49) |
| RB-51 | (E10e) Una respuesta se guarda una sola vez y no se cambia; una pregunta ajena al intento o de otro usuario responde como inexistente | `La pregunta no existe.` (`PREGUNTA_NO_ENCONTRADA`, 404) |
| RB-52 | (E10e) Cuota de Gemini agotada al generar: no se guarda nada a medias | `Se agotó por ahora el cupo gratuito de Gemini. Intenta más tarde.` (`CUOTA_AGOTADA`, 429) |
| RB-53 | (E10f) Sugerencia de repaso: con 2 o más falladas de un capítulo; se confirma en un diálogo; no se repite si ya hay una tarea pendiente con ese título | `Ya tienes esa tarea de repaso.` |
| RB-54 | (E10b2) Ver y eliminar las fuentes web propias, con confirmación; eliminar libera el cupo de la categoría (RN-05); una fuente de otro usuario responde como inexistente | Confirmación: `¿Eliminar esta fuente? Se libera su cupo en la categoría. No se puede deshacer.` Ajena o inexistente: `La fuente no existe.` (`FUENTE_NO_ENCONTRADA`, 404) |
| RB-55 | (E10c2) Una búsqueda en Wikipedia no guarda nada: el resultado trae "Guardar fuente", que guarda el resumen y el enlace del primer artículo en la categoría elegida. El tope de 20 por categoría (RN-05) se revisa al guardar, no al buscar. El servidor solo acepta enlaces de `es.wikipedia.org`. Guardar una misma dirección dos veces en una categoría no la duplica | `Esta fuente ya está guardada en «{categoria}».` · Tope: el mensaje de RN-05 · Enlace ajeno: `La dirección de la fuente no es válida.` |
| RB-56 | (E10c2) Con "Fuentes web" en "Buscar en", el Asistente responde solo con las fuentes web guardadas del usuario (búsqueda vectorial, las 4 más cercanas) y las cita con su enlace, que se puede abrir. Con "Todos los documentos" no las usa: no se mezclan con los PDF. Cada fuente es un embedding al guardarla y la pregunta no gasta llamadas extra | Sin fuentes: `Aún no tienes fuentes web guardadas. Elige "Wikipedia" en "Buscar en" y guarda las que te sirvan.` · Sin respuesta (excepción a RN-13, aprobada por el usuario el 2026-11-10; RN-13 no cambia en los demás casos): `No encontré esto en tus fuentes web guardadas. Prueba con "Wikipedia" en "Buscar en".` Cita: `Fotosíntesis · Wikipedia`, con enlace |
| RB-57 | (E11c) Indexación en segundo plano: cada minuto, el tick avanza una parte de un libro a medias (el más antiguo, respetando `indexando_hasta`, RB-38). Si Gemini pide esperar por la cuota, no espera: lo intenta en el minuto siguiente. Con la pantalla abierta sigue avanzando desde el navegador, sin repetir partes | Tarjeta: `Puedes cerrar esta pantalla: seguirá sola.` |
| RB-58 | (E10c2) Con "Wikipedia" en "Buscar en", el Asistente busca en `es.wikipedia.org` como RN-05 y responde con el resumen y los artículos usados, con enlace. No consulta documentos ni tareas. Una frase muy corta recibe el aviso actual de la búsqueda | Sin resultados: el mensaje actual de la búsqueda web |
| RB-59 | (E10c3) "IA (conocimiento general)" solo responde si el usuario la elige o toca "Preguntarle a la IA". Usa solo el modelo de chat, sin embeddings y sin documentos, tareas ni fuentes en el prompt. No hay citas ni "Explicar de otra manera". Nunca se usa como respaldo automático | Marca exacta, siempre visible, también al recargar: `Respuesta general de la IA, sin fuentes. Compruébala si es importante.` |
| RB-60 | (E10c3) El botón "Preguntarle a la IA" aparece solo bajo una respuesta "No encontré" (RN-13, la de un documento elegido o, desde el 2026-11-12 a pedido del usuario, la de Fuentes web de RB-56). Envía la misma pregunta con el origen IA y deja la respuesta anterior intacta | Botón: `Preguntarle a la IA` |
| RB-61 | (E10c2, E10c3) Ninguna respuesta mezcla orígenes. El historial que recibe el modelo y la pregunta anterior usada en la búsqueda solo toman mensajes del mismo origen (M21). Documentos y tareas son un origen; Fuentes web, Wikipedia e IA son uno cada uno | — |
| RB-62 | (E11b) Sin conexión, Inicio, Tareas, Calendario del mes actual y capítulos muestran la última copia válida del usuario. Con conexión, siempre se pide al servidor primero. No se guarda el Asistente, el texto de los documentos ni ninguna respuesta de una acción. Lo que necesita internet o escribe datos queda desactivado | Aviso: `Sin conexión · datos de las {HH:MM}` · Control desactivado: `Necesitas conexión para esto.` · Pantalla sin copia: `Esta pantalla aún no está disponible sin conexión.` |
| RB-64 | (E10g) Tipo de preguntas al crear: `Selección única`, `Respuesta múltiple`, `Verdadero o falso`, `Completar`, `Pregunta abierta` o `Mixto` (por defecto). Mixto reparte las pedidas en partes iguales entre los 5 tipos, en ese orden (5 → 1 de cada uno; 10 → 2; 20 → 4), y las intercala. RB-49 se aplica al total; con parte de las pedidas, se crea y se avisa | Los de RB-49 |
| RB-65 | (E10g) Respuesta múltiple: se dice cuántas son correctas; se marca al menos una; puntaje parcial de 7.12 | `Hay {k} respuestas correctas.` · Sin marcar: `Marca al menos una opción.` |
| RB-66 | (E10g) Verdadero o falso: si la afirmación es falsa, la explicación dice qué es lo correcto según la cita (instrucción al modelo; la cita se muestra siempre para comprobarlo) | Botones: `Verdadero` · `Falso` |
| RB-67 | (E10g) Completar: el servidor arma la frase con el espacio en blanco a partir de la cita (no confía en el modelo) y compara según 7.13 | Vacía: `Escribe tu respuesta.` |
| RB-68 | (E10g) Pregunta abierta: la respuesta (1 a 1000 caracteres) se guarda al enviarla y no se cambia; luego se muestran la respuesta modelo, la cita y la página, y el usuario se califica una sola vez. Sin Gemini para calificar | Vacía: `Escribe tu respuesta.` · Indicación: `Compara tu respuesta con la respuesta modelo y califícate.` · Botones: `La tuve bien` · `A medias` · `Mal` |
| RB-69 | (E10g) Una respuesta que no corresponde al tipo de la pregunta (por ejemplo, un texto para una de selección única, o calificarse sin haber enviado la abierta) se rechaza sin guardar nada. "Repetir solo las que fallé" y la tarea de repaso cuentan como falladas las de menos de 1 punto | `Revise los datos ingresados.` (`DATOS_INVALIDOS`, 400) |
| RB-70 | (E11e) Crear sin conexión: solo crear, con las mismas reglas y mensajes; la tarea queda en el dispositivo con su `id_cliente`; como máximo 50 pendientes | `Guardada en este dispositivo. Se enviará cuando vuelva la conexión.` · `Ya tienes 50 tareas sin enviar. Conéctate para enviarlas antes de crear más.` |
| RB-71 | (E11e) Una tarea pendiente se ve en Tareas, Inicio y Calendario con su insignia; no se completa, edita ni elimina: solo se descarta, con confirmación | `Pendiente de enviar` · `{n} tareas pendientes de enviar` · `¿Descartar esta tarea? No se enviará.` |
| RB-72 | (E11e) Envío al volver la conexión con Nova abierta: en orden de creación, una pestaña a la vez, sin duplicar nunca (7.14) | `Se enviaron {n} tareas que creaste sin conexión.` |
| RB-73 | (E11e) El recordatorio lo calcula el servidor al recibir la tarea (7.10). Si su momento pasó mientras estaba sin conexión, queda `omitido` y se avisa | `El recordatorio de «{t}» no se enviará: su momento pasó mientras estaba sin conexión.` |
| RB-74 | (E11e) Si el servidor rechaza una tarea pendiente, queda en el dispositivo con el mensaje exacto del servidor; "Corregir" abre el formulario lleno y la vuelve a enviar con el mismo `id_cliente`; "Descartar" la borra | `No se pudo enviar: {mensaje del servidor}` |
| RB-75 | (E11e) Cerrar sesión con tareas sin enviar: primero se avisa; al confirmar, se borran del dispositivo con la copia de RB-63. Las de otro usuario nunca se envían con la sesión actual y se borran al detectar otro usuario (RB-63) | `Tienes {n} tareas sin enviar. Si cierras sesión, se borrarán de este dispositivo.` (con 1: `Tienes 1 tarea sin enviar. Si cierras sesión, se borrará de este dispositivo.`) · Botones `Cerrar sesión y borrarlas` y `Cancelar` |
| RB-63 | (E11b) La copia sin conexión se borra: al cerrar sesión; si, con conexión, el servidor rechaza la sesión (401, 403 o redirección a `/login`); si inicia sesión otro usuario; y tras 7 días sin una respuesta válida del servidor, porque sin conexión no se puede saber si la sesión venció | — |
| RB-29 | Editar una tarea: solo pendientes y del usuario; título, categoría, prioridad, fecha límite y horario con las mismas validaciones y mensajes que al crear; estado, minutos y fecha de cierre no se tocan | Los de crear (`PLAN_NOVA.md` 5.1). Tarea completada: `La tarea ya está completada.` (`TAREA_YA_COMPLETADA`, 409). De otro usuario o inexistente: `La tarea no existe.` (`TAREA_NO_ENCONTRADA`, 404) |

Códigos de error nuevos (404 salvo indicación): `CATEGORIA_NO_ENCONTRADA`, `CATEGORIA_DUPLICADA` (409), `MATERIA_NO_ENCONTRADA`, `MATERIA_DUPLICADA` (409), `CORTE_NO_ENCONTRADO`, `COMPONENTE_NO_ENCONTRADO`, `NOTA_NO_ENCONTRADA`, `PORCENTAJES_INVALIDOS` (422, solo RB-10 y los cortes por defecto de Configuración), `CORTES_NO_SE_QUITAN` (422, RB-35), `NOTA_INVALIDA` (422), `META_NO_ENCONTRADA`, `META_DUPLICADA` (409), `PLAN_SIN_TEMAS` (422), `PLAN_SIN_FECHA` (422), `SIN_SYLLABUS` (422), `PLAN_INVALIDO` (502), `PASO_YA_EN_TAREAS` (409).

## 9. El asistente en Semestre

Todas las llamadas a Gemini siguen pasando por `src/lib/llm/` y piden **JSON con esquema** (`responseMimeType: application/json` y `responseSchema`), validado con Zod en el servidor antes de guardar nada.

### 9.1 Proponer temas desde el syllabus (E17)

1. El usuario elige un PDF de la materia (documentos con `materia_id`).
2. El servidor toma los fragmentos de ese documento más parecidos a "temas, contenidos y unidades del {corte}" (búsqueda vectorial limitada a ese documento, hasta 6 fragmentos) y los entrega etiquetados.
3. El modelo devuelve `[{ nombre, fuente }]`. El servidor descarta los que citen una etiqueta que no se entregó y los duplicados, y guarda el resto como `propuesto`.
4. El usuario confirma o descarta cada uno. Nada se confirma solo.

### 9.2 Generar el plan (E18)

Entradas: corte (con fecha futura), meta (si hay), notas actuales, temas **confirmados** (con id), y por cada tema los 2 fragmentos más parecidos entre los PDF de la materia (`buscar_fragmentos_usuario` con `materia`), etiquetados.

### 9.3 Esquema del plan y validación (RB-22)

```text
{ semanas: [ { inicio: 'YYYY-MM-DD', dias: [ { fecha: 'YYYY-MM-DD',
    pasos: [ { id: uuid, titulo: string ≤ 120, tema_id: uuid, minutos: 15..240, fuentes: string[] } ] } ] } ] }
```

El servidor rechaza el plan entero si: algún `tema_id` no es un tema confirmado de ese corte; alguna fuente no es una etiqueta entregada en el contexto; alguna fecha está fuera de [hoy, fecha del corte]; o no cumple el esquema. Los `id` de los pasos los asigna el servidor (no el modelo). Un rechazo se reintenta una vez; si vuelve a fallar, `PLAN_INVALIDO`.

### 9.4 Versiones y huella (RB-23)

Cada versión guarda su `huella`: `{ meta, temas: [id+nombre confirmados], notas: [nota+componente del corte y de la materia], documentos: [ids de PDF de la materia] }`. La pantalla compara la huella de la versión vigente con la actual y, si difieren, muestra RB-23 con la lista de lo que cambió ("un PDF nuevo", "notas nuevas", "temas cambiados", "meta cambiada") y el botón "Actualizar plan". Actualizar genera una versión nueva; nunca se reemplaza sola. "Editar" permite cambiar título, fecha y minutos de cada paso, borrar pasos y agregar pasos manuales (con un tema confirmado); guardar crea una versión `manual`. "Restaurar" copia una versión anterior como versión nueva.

### 9.5 Pasar a Tareas (E19, RB-24)

Cada paso tiene "Pasar a Tareas": un diálogo muestra título, fecha límite = fecha del paso, categoría = nombre de la materia y prioridad 2, y pide confirmar. Se registra en `pasos_en_tareas`; el paso queda marcado "En Tareas" con enlace. Los pasos conservan su `id` entre versiones, así que la marca se mantiene al editar.

### 9.6 Generar un cuestionario (E10e)

Es una llamada a `gemini-3.1-flash-lite` (con su respaldo) que pide JSON con esquema, igual que 9.1. No usa embeddings.

1. **Contexto:** los fragmentos del alcance elegido, etiquetados `[F1]`, `[F2]`… Hasta 3 fragmentos por pregunta (5 → 15, 10 → 30, 20 → 60). Si el alcance tiene más, se toman repartidos de manera uniforme; en un libro completo, repartidos entre sus capítulos.
2. **Mínimo de texto:** al menos un fragmento por cada 2 preguntas. Si no, no se llama a Gemini (RB-49).
3. **Dificultad** (instrucción al modelo): fácil, un dato explícito del texto; media, comprender o relacionar ideas del texto; difícil, aplicar o inferir, siempre con la respuesta justificable por el texto. Es criterio del modelo y no se puede validar con reglas.
4. **El modelo devuelve** `[{ enunciado, opciones: [4], correcta, explicacion, fuente: "F3", cita_textual }]`.
5. **Validación en el servidor (RB-50):** se descarta la pregunta si `fuente` no es una etiqueta entregada, si `cita_textual` (de 20 a 200 caracteres) no aparece literalmente en ese fragmento (sin distinguir mayúsculas, espacios ni guiones de fin de línea), si las 4 opciones no son distintas, si `correcta` no está entre 0 y 3 o si el enunciado se repite.
6. **El servidor** baraja las opciones (los modelos tienden a poner la correcta en las mismas posiciones) y calcula la página y el capítulo a partir del fragmento, sin confiar en el modelo.
7. **Reintento:** si faltan preguntas, una segunda llamada solo por las que faltan. Como máximo 2 llamadas por cuestionario.

La cita literal demuestra que la pregunta sale del documento. No demuestra que la opción marcada como correcta lo sea: por eso la explicación y la cita se muestran siempre, para que se pueda comprobar.

### 9.7 Generar preguntas de varios tipos (E10g)

Es la misma llamada de 9.6, con el mismo contexto, mínimo de texto, dificultad y reintento. A lo sumo hay 2 llamadas por cuestionario, y en la segunda se piden solo las que faltan de cada tipo.

1. **El pedido** dice cuántas preguntas quiere de cada tipo (RB-64). El esquema JSON es un solo objeto por pregunta con `tipo` y los campos de cada tipo: `opciones` y `correcta` (única), `opciones` y `correctas` (múltiple), `verdadero` (verdadero o falso) y `respuesta` (completar: la palabra o expresión que falta; abierta: la respuesta modelo). Todas llevan `enunciado` (salvo completar), `explicacion`, `fuente` y `cita_textual`.
2. **Validación (RB-50 más la de cada tipo):** la fuente y la cita se validan como en 9.6. Además:
   - **Única:** como en 9.6.
   - **Múltiple:** 4 opciones distintas y de 2 a 3 `correctas` distintas entre 0 y 3.
   - **Verdadero o falso:** `verdadero` es booleano y hay explicación.
   - **Completar:** la respuesta tiene de 1 a 4 palabras y de 3 a 40 caracteres, y aparece completa en la cita (con la comparación de 7.13 y respetando dónde empieza y termina cada palabra). El servidor arma la frase cambiando esa aparición de la cita por `_____`.
   - **Abierta:** la respuesta modelo tiene de 20 a 400 caracteres.
   - Una pregunta de un tipo que no se pidió, o de un tipo que ya está completo, se descarta.
3. **Barajar:** el servidor baraja las opciones de la única y de la múltiple, y conserva cuáles son correctas. Las preguntas se intercalan por tipo.
4. **Equilibrio en verdadero o falso:** se le pide al modelo que mezcle verdaderas y falsas, pero no se puede exigir. Si todas salen iguales, se aceptan.

## 10. API

Todas con `exigirSesion()` como primera instrucción y el id del usuario de la sesión. Contrato de respuesta igual que `PLAN_NOVA.md` 12.1.

| Método y ruta | Uso | Etapa |
|---|---|---|
| (existentes) | Igual contrato; filtran por usuario desde E01 | E01 |
| `GET/POST /api/nova/categorias`, `PATCH/DELETE /api/nova/categorias/[id]` | Categorías | E05 |
| `GET /api/nova/semana?inicio=` | Tareas y progreso de la semana | E06 |
| `PATCH /api/nova/tareas/[id]` | Editar tarea (RB-29); `DELETE` y `completar` siguen igual | E09 |
| `GET /api/nova/calendario?mes=YYYY-MM` | Días con tareas y eventos de Semestre | E07, E13 |
| `GET/PATCH /api/nova/configuracion` | Preferencias y perfil | E11 |
| `DELETE /api/nova/conversaciones` | Borrar todo el historial (RB-25) | E11 |
| `GET/POST /api/nova/materias`, `GET/PATCH/DELETE /api/nova/materias/[id]` | Materias (con cortes, componentes y notas); `PATCH` activa o quita los cortes (RB-35) | E12 |
| `PUT /api/nova/materias/[id]/cortes` | Cortes en bloque (responde con el aviso RB-07 si la suma no es 100 %) | E12 |
| `POST /api/nova/cortes/[id]/componentes`, `PATCH/DELETE /api/nova/componentes/[id]` | Componentes de evaluación (aviso RB-08) | E12 |
| `POST /api/nova/componentes/[id]/notas`, `PATCH/DELETE /api/nova/notas/[id]` | Notas de un componente (RB-09; nota vacía = "sin nota") | E12 |
| `GET/POST /api/nova/metas`, `DELETE /api/nova/metas/[id]` | Metas semanales | E15 |
| `PUT/DELETE /api/nova/metas-nota` | Metas de nota | E16 |
| `GET/POST /api/nova/cortes/[id]/temas`, `POST /api/nova/cortes/[id]/temas/proponer`, `PATCH/DELETE /api/nova/temas/[id]` | Temas | E17 |
| `GET /api/nova/cortes/[id]/plan`, `POST .../plan/generar`, `POST .../plan/versiones` (manual), `POST .../plan/restaurar` | Plan y versiones | E18 |
| `POST /api/nova/planes/[id]/pasos/[pasoId]/tarea` | Pasar a Tareas | E19 |
| `GET /api/nova/estadisticas` | Datos de Estadísticas | E20 |
| `POST /api/nova/documentos/[id]/continuar` | Indexar la parte siguiente de un libro (RB-38) | E10b |
| `GET /api/nova/documentos/[id]/capitulos` | Capítulos con sus páginas | E10b |
| `POST /api/nova/consultar` (campos nuevos) | `documentoId` ("Buscar en"), y `explicar: { mensajeId, modo }` (RB-41; una respuesta ajena o sin fragmentos: `MENSAJE_NO_ENCONTRADO`, 404) | E10c |
| `POST /api/nova/documentos/[id]/plan-lectura` (vista previa) y `.../plan-lectura/confirmar` | Plan de lectura (RB-42) | E10d |
| `POST/DELETE /api/nova/notificaciones/suscripcion`, `POST /api/nova/notificaciones/prueba` | Suscripción push del dispositivo y aviso de prueba | E11c |
| `POST /api/nova/recordatorios/tick` | Envío cada minuto; sin sesión, con `RECORDATORIOS_SECRETO` | E11c |
| `POST /api/nova/tareas` (campo nuevo) | `idCliente` (UUID, opcional): una tarea creada sin conexión; repetir el envío devuelve la misma tarea (7.14) | E11e |
| `GET /api/nova/tareas/[id]/ics` | "Agregar a mi calendario" (RB-47) | E11d |
| `POST/GET /api/nova/cuestionarios` | Generar (`maxDuration = 120`, igual que el Asistente) y listar el historial (`?documentoId=`). Desde E10g, al generar también `tipo` (por defecto `mixto`) | E10e, E10f, E10g |
| `GET /api/nova/cuestionarios/[id]` | Preguntas sin la respuesta correcta | E10e |
| `POST /api/nova/cuestionarios/[id]/intentos` | Empezar un intento; `repasoDe` para "Repetir solo las que fallé" | E10e |
| `POST /api/nova/intentos/[id]/respuestas` | Responder; devuelve acierto, correcta, explicación y cita. Desde E10g, según el tipo: `elegida`, `elegidas`, `verdadero` o `texto`; devuelve también los puntos de la pregunta | E10e, E10g |
| `POST /api/nova/intentos/[id]/autoevaluacion` | Calificarse una pregunta abierta ya enviada: `bien`, `medias` o `mal` (RB-68) | E10g |
| `POST /api/nova/intentos/[id]/tarea-repaso` | Crear la tarea de repaso (RB-53) | E10f |
| `GET /api/nova/web/fuentes`, `DELETE /api/nova/web/fuentes/[id]` | Fuentes web guardadas (RB-54) | E10b2 |
| `POST /api/nova/web/fuentes` | Guardar el resultado de una búsqueda (RB-55) | E10c2 |
| `POST /api/nova/consultar` (valores nuevos) | `documentoId: "web"` para las fuentes web guardadas (RB-56) y `"wikipedia"` para buscar en Wikipedia (RB-58) | E10c2 |
| `POST /api/nova/consultar` (valor nuevo) | `documentoId: "ia"` para la IA general (RB-59, RB-60) | E10c3 |
| `GET /api/nova/salud` | Consulta mínima a la base, para el cron diario de Vercel; con `CRON_SECRET` | E21 |
| `src/app/manifest.ts`, `public/sw.js` | Manifiesto e service worker; públicos (el middleware no los protege) | E11b |

Las rutas que llaman a Gemini declaran `maxDuration = 60`.

## 11. Pruebas

### 11.1 Automáticas (Vitest)

- **Reglas puras**: casos S-01 en adelante en cada etapa. Mínimos obligatorios:
  - S-01 a S-06 (redondeo y aprobar): 2,96 truncar → 2,9, no aprueba con 3,0; 2,95 redondear → 3,0, aprueba; 3,04 truncar → 3,0, aprueba; 2,94 redondear → 2,9; 5,0 → 5,0; 0 → 0,0.
  - S-07 a S-12 (componentes y cortes): componente con 2 de 5 notas calificadas (lo que falta no cuenta como 0); componente sin notas (pendiente completo); materia sin notas (RB-13); materia completa (definitiva); materia con cortes (nota de cada corte); el ejemplo de 7.4 (3,7 actual, 2,5 asegurado) con un peso no exacto (20 % / 3) sin error de coma flotante. S-12b: porcentajes que no suman 100 % dan la nota actual con el aviso, sin estado ni "¿Cuánto necesito?".
  - S-13 a S-18 ("¿Cuánto necesito?"): ya asegurado; el ejemplo de 7.5 (1,4 para 3,0; 4,5 para la meta 4,0); imposible con máximo alcanzable (meta 4,5 → 4,1); W = 0; truncar frente a redondear con el mismo dato (el umbral cambia en 0,05); resultado redondeado hacia arriba.
  - S-19 a S-21 (promedio por créditos), S-22 a S-24 (fallas), S-25 a S-28 (metas semanales, semana de Bogotá en el borde del domingo a medianoche).
  - S-33 a S-36 (libros, E10b): fragmentos por página con su rango, etiquetas con número impreso, índice anidado a capítulos con página final, encabezados como respaldo y ningún capítulo inventado.
  - S-37 a S-39 (E10c): detectar "página 45", "pág. 45", "p. 45", "capítulo 3" y "capítulo de X" (sin confundir "3 páginas" o "el capítulo anterior"); página fuera de rango.
  - S-40 y S-41 (E10d): reparto de capítulos entre dos fechas y por semana; capítulo ya en Tareas.
  - S-42 a S-47 (E11c, regla 7.10): las 4 opciones con horario, las 2 sin horario, cruce de medianoche, de mes y de año en Bogotá, hora ya pasada.
  - S-48 y S-49 (E11c): ventana de 30 min sin envíos dobles; texto exacto de RB-44.
  - S-50 (E11d): `.ics` válido (zona horaria, todo el día y alarma).
  - S-51 a S-53 (E10e, contexto): fragmentos por pregunta y reparto uniforme, también entre capítulos; mínimo de texto de RB-49; rango de páginas inválido.
  - S-54 a S-56 (E10e, validación de 9.6): cita inexistente, fuente inventada, opciones repetidas, `correcta` fuera de rango y enunciado duplicado; cita válida a pesar de mayúsculas, espacios y guiones de fin de línea; barajar conserva cuál es la correcta.
  - S-57 (E10e): puntaje de 7.11, con truncado y 0 de N.
  - S-58 y S-59 (E10f): comparación entre intentos sin contar los repasos; capítulos con 2 o más falladas.
  - S-60 y S-61 (E10c2): solo se aceptan enlaces de `es.wikipedia.org`; etiqueta y enlace de la cita de una fuente web.
  - S-62 y S-63 (E11c, RB-57): el tick elige el libro más antiguo y disponible; con cuota agotada no espera y lo deja para el minuto siguiente.
  - S-64 (E10c2, E10c3, RB-61): el historial solo toma mensajes del mismo origen.
  - S-65 y S-66 (E10c3): el prompt de la IA no lleva documentos, tareas ni fuentes y no pide embeddings; la marca se guarda y sale siempre, sin citas.
  - S-67 (E10c3): "Preguntarle a la IA" solo bajo "No encontré" (documentos, documento elegido o Fuentes web).
  - S-70 (E10g, 7.12): puntos de la múltiple con k = 2 y k = 3 (los ejemplos de 7.12, marcar todas, nunca menos de 0); puntaje del intento con parciales y abiertas, y el mismo resultado que 7.11 en selección única.
  - S-71 (E10g, 7.13): completar con mayúsculas, tildes, diéresis, puntuación y espacios de más; la ñ no se confunde con la n; una respuesta con palabras de más no acierta.
  - S-72 (E10g, 9.7): validación de cada tipo (múltiple con 1 o 4 correctas o repetidas, verdadero o falso sin booleano, completar con una respuesta que no está en la cita o que corta una palabra, abierta con respuesta modelo corta) y la frase con `_____` armada por el servidor.
  - S-73 (E10g, RB-64): reparto de mixto en 5, 10 y 20; la segunda llamada pide solo lo que falta de cada tipo; nunca más de 2 llamadas; un tipo de más se descarta.
  - S-74 (E10g, RB-50, RB-68): la vista de cada tipo no trae las correctas, `verdadero`, lo que falta, la respuesta modelo ni la cita antes de responder; una abierta enviada sin calificar trae la respuesta modelo y no cuenta como terminada.
  - S-75 (E10g, RB-69): una respuesta de otro tipo o calificarse sin enviar se rechaza; "Repetir solo las que fallé" incluye las "A medias" y las múltiples parciales; un cuestionario anterior (sin tipo) se responde y califica como antes.
  - S-76 (E11e, 7.14): crear con el mismo `idCliente` dos veces (también a la vez) deja una sola tarea, una sola categoría nueva y un solo recordatorio; sin `idCliente` todo sigue igual; el `idCliente` de otro usuario no choca.
  - S-77 (E11e, RB-70): sin conexión el formulario guarda en el dispositivo con las mismas validaciones; el tope de 50; el formulario y su copia están disponibles sin conexión.
  - S-78 (E11e, RB-72): el envío por resultado (201, 200 ya existía, 422, 401, red); una sola pestaña envía (Web Locks simulado); orden de creación.
  - S-79 (E11e, RB-73, RB-74): recordatorio pasado al enviar queda omitido con su aviso; "Corregir" reenvía con el mismo `idCliente`.
  - S-80 (E11e, RB-75): cerrar sesión avisa y borra; las pendientes de otro usuario no se envían.
  - S-68 y S-69 (E11b): qué rutas se pueden guardar (Asistente, API de escritura y texto de documentos nunca); cada caso de borrado de RB-63, incluido el de 7 días.
  - S-29 a S-32 (validación del plan: tema no confirmado, fuente inventada, fecha fuera de rango, plan válido).
- **Contraste**: una prueba lee los tokens de `globals.css` y comprueba ≥ 4,5:1 en cada par texto/fondo, en ambos modos, y para los 8 colores de categoría.
- **Servidor**: cada ruta nueva prueba 401/403, aislamiento (un id de otro usuario responde como inexistente), validación y contrato.
- **Editar tareas** (E09): cada validación de crear repetida al editar con su mensaje exacto, tarea completada → `TAREA_YA_COMPLETADA`, tarea de otro usuario → `TAREA_NO_ENCONTRADA`, y que estado, minutos y fecha de cierre no cambian.
- **RB-32** (ajuste de E04): los tres casos pedidos (sin documentos y sin tareas, sin documentos y con tareas, con documentos y sin tareas), las líneas del contexto, las respuestas exactas impuestas por el servidor y el aviso en tuteo; `probar:rag` pasos 9, 10d, 10e, 11b y 13 con Gemini real.
- **Asistente sin documentos** (E02b, RB-30): los cuatro casos de `consultar` (con documentos y tareas, solo tareas, solo documentos, ninguno), la pregunta de PDF sin documentos con el mensaje exacto, el límite de 50 tareas (`ORDER BY fecha_limite`, parámetro 50) y el aviso de la pantalla en sus combinaciones. `probar:rag` paso 11 con Gemini real.
- **Fechas en el Asistente** (E02c, RB-31): `semanaDe` (lunes a domingo, bordes de mes y año), `sumarDias`, `fechaLarga` y `lineaHoy` con relojes fijos, incluido el domingo 22:30 en Bogotá cuando UTC ya es lunes y el cambio exacto a medianoche de Bogotá; la línea HOY va primero en el contexto con y sin documentos; cada tarea lleva AAAA-MM-DD; el System Prompt incluye la regla; `mencionaTareas` reconoce semana, mañana, hoy y vencidas y no "¿cuál es el primer paso?". `probar:rag` paso 12 con Gemini real.
- **Interfaz**: navegación (ítem activo, hoja "Más" con Escape y foco, botón "+"), Inicio (completar abre el diálogo de minutos), pestañas de Tareas, formularios de Semestre con los mensajes exactos.

### 11.2 Scripts reales

- `npm run probar:rag` y `npm run db:verificar` en cada etapa que toque datos (este último se amplía con las tablas nuevas, su RLS y sus restricciones).
- `npm run probar:semestre` (nuevo, E13): crea una materia de prueba completa en la base real, comprueba los cálculos contra valores hechos a mano y borra lo que creó.
- `npm run probar:libro` (nuevo, E10b y E10c): con un PDF de prueba de unas 40 páginas con índice, comprueba capítulos y páginas, una pregunta por página con su cita, un capítulo y "Más simple" con Gemini real; borra lo que creó.
- `npm run probar:recordatorios` (nuevo, E11c): crea tareas con recordatorio, llama al tick con un reloj fijo en modo de prueba (sin enviar) y comprueba qué se enviaría y que no se repite; borra lo que creó.
- `npm run probar:cuestionario` (nuevo, E10e): con Gemini real y el PDF de `probar:libro`, genera 5 preguntas de un capítulo, comprueba que todas pasan RB-50 y que sus páginas están dentro del capítulo; pide 20 preguntas de 2 páginas y comprueba RB-49; borra lo que creó. Desde E10g genera un cuestionario mixto de 5 con una sola ejecución (a lo sumo 2 llamadas) y comprueba que cada pregunta pasa la validación de su tipo.
- `npm run probar:plan` (nuevo, E18): con Gemini real, propone temas desde un PDF de prueba y genera un plan; comprueba que pasa la validación y borra lo que creó.

### 11.3 Compatibilidad con `master` (después de cada migración)

Con un `git worktree` de `master` en una carpeta temporal: `npm run probar:rag` y `npm run db:verificar` **del código de master** contra la base ya migrada. Deben dar 0 fallas. Así se demuestra que producción sigue creando, completando y eliminando tareas, e indexando y consultando documentos.

### 11.4 Navegador y teléfono

En cada etapa con interfaz: navegador real a 1280 px y 390 px (sin desplazamiento horizontal, sin errores de página, foco visible) y prueba del usuario en la **vista previa de Vercel** desde su teléfono.

## 12. Casos de aceptación B-01 a B-86

Se ejecutan en la vista previa de Vercel de `ampliacion`, en computador y en teléfono, y se registran en `doc/ACEPTACION.md` (sección nueva). Antes, se repiten A-01 a A-21 en la vista previa.

| ID | Acción | Resultado esperado |
|---|---|---|
| B-01 | Después de E01, en **producción**, crear, completar y eliminar una tarea, indexar y eliminar un PDF y preguntar | Todo igual que antes; las filas nuevas quedan con el usuario dueño |
| B-02 | Iniciar sesión con otra cuenta de la lista de acceso (si existe) | No ve tareas, documentos, fuentes, materias ni metas ajenas |
| B-03 | Cambiar entre claro, oscuro y automático | Toda la app cambia; se recuerda al volver; sin parpadeo al cargar |
| B-04 | Recorrer las pantallas con el teclado | Foco visible en todo control; orden lógico |
| B-05 | En computador | Barra lateral con las 8 secciones; la activa resaltada |
| B-06 | En teléfono | Barra inferior Inicio, Calendario, Asistente (destacado), Tareas, Más; "Más" abre el resto y se cierra con Cerrar o tocando fuera |
| B-07 | Botón "+" en el teléfono | Ofrece "Nueva tarea" y "Subir documento"; ambos funcionan |
| B-08 | Ningún botón ni enlace lleva a una página inexistente o no hace nada | Cumple en todas las pantallas |
| B-09 | Inicio: escribir una pregunta en "Pregúntale a Nova" | Abre el Asistente y la pregunta ya está enviada y respondida |
| B-10 | Inicio: ver la semana y cambiar de semana | Tareas por fecha límite en su día; en teléfono, selector de días |
| B-11 | Inicio: marcar una tarea pendiente | Abre el diálogo de minutos; al confirmar queda completada y el anillo y los contadores cambian; cancelar no cambia nada |
| B-12 | Inicio: prioridades de hoy | Pendientes de hoy por prioridad; "Agregar" abre el formulario con la fecha de hoy |
| B-13 | Calendario: mes con tareas de varias categorías | Puntos del color de cada categoría; leyenda |
| B-14 | Calendario: tocar un día y "Agregar tarea" | Lista del día; el formulario abre con esa fecha puesta |
| B-15 | Calendario: con un corte y una nota con fecha | Aparecen en su día con su ícono y enlazan a la materia |
| B-16 | Tareas: pestañas Todas, Hoy, Importantes, Completadas | Cada una filtra como dice; la pestaña queda en la URL |
| B-17 | Tareas: agrupación | Grupos por categoría con color y contador completadas/total |
| B-18 | En Tareas: crear una categoría con "+ Nueva", filtrar por ella, renombrarla y cambiarle el color desde "⋯" o dejándola presionada, y eliminarla; abrir el menú de General | Sin salir de Tareas; nombre repetido → RB-02; renombrar cambia las tareas y mantiene el filtro; eliminar pide confirmación y pasa sus tareas a General; General dice "Por defecto" y solo cambia de color. Se refleja en Inicio y Calendario cuando existan (E06, E07) |
| B-19 | Fuentes: las dos pestañas | Subir PDF e índice funcionan como A-06 a A-08 y A-21; Buscar en la web como A-18 (desde E10c2, la búsqueda está en "Buscar en" del Asistente, con "Guardar fuente", y aquí queda Fuentes guardadas) |
| B-20 | Abrir `/nova/documentos` y `/nova/web` | Redirigen a Fuentes en la pestaña correcta |
| B-21 | Subir un PDF con una materia como categoría | La lista muestra la materia |
| B-22 | Configuración: cambiar el nombre y la contraseña | Se guarda; la contraseña nueva sirve para entrar |
| B-23 | Configuración: borrar el historial del asistente | Pide confirmación (RB-25) y el chat queda vacío |
| B-24 | Crear una materia; luego "Dividir en cortes" y "Quitar cortes" | Nace sin cortes y con su categoría; al dividir, Corte 1 30 % (con los componentes que ya tenía), Corte 2 30 % y Corte 3 40 % (o los configurados); quitar con más de un corte → RB-35 |
| B-25 | Componentes que suman 90 % | Se guardan, se ve el aviso RB-08 y la calculadora muestra la nota actual sin estado ni "¿Cuánto necesito?" |
| B-26 | Cortes que suman 90 % | Igual que B-25, con el aviso RB-07 |
| B-27 | Nota 5,5 | Rechazo con RB-09 |
| B-28 | Materia del ejemplo de 7.4 (5 quizzes con 2 calificados y Actividades sin notas) | Nota actual 3,7 y asegurado 2,5 (lo que falta no cuenta como 0); "¿Cuánto necesito?": 1,4 para aprobar, 4,5 para la meta 4,0, y para la meta 4,5 "no es posible" con máximo 4,1 |
| B-29 | Truncar frente a redondear con una nota exacta de 2,96 | Truncar: "2,9" y no aprueba; redondear: "3,0" y aprueba; nunca "3,0" con "no aprueba" |
| B-30 | "¿Cuánto necesito?" en un caso posible y uno imposible | Mensajes RB-12 con la nota necesaria o la máxima alcanzable |
| B-31 | Promedio del semestre con 2 materias de créditos distintos | Ponderado por créditos, coincide a mano |
| B-32 | Fallas a 2 del límite y en el límite | Alerta RB-14 y "Perdiste la materia por fallas" |
| B-33 | Productividad: meta de 5 tareas y meta de 3 h en una categoría | El progreso coincide con las tareas completadas esta semana y sus minutos |
| B-34 | Objetivos: meta 4,5 en un corte | Dice si es alcanzable y con qué nota (RB-12) |
| B-35 | Temas: agregar uno a mano y proponer desde un syllabus | Los propuestos aparecen como "propuestos" con su fuente; solo los confirmados cuentan |
| B-36 | Generar el plan | Plan por semanas y días hasta la fecha del corte, solo con temas confirmados y citas a PDF de la materia |
| B-37 | Subir un PDF nuevo de la materia o registrar una nota | Aviso RB-23 con la lista de cambios; el plan no cambió solo |
| B-38 | Editar el plan y restaurar una versión anterior | Cada acción crea una versión nueva; la anterior se puede ver |
| B-39 | Pasar un paso a Tareas, dos veces | La primera pide confirmación y crea la tarea; la segunda responde RB-24 |
| B-40 | Estadísticas | Evolución por corte, comparación entre materias y materias en riesgo (por nota o por fallas), con tabla equivalente para lectores de pantalla |
| B-43 | En una cuenta sin documentos y con una tarea pendiente: abrir el Asistente, preguntar "¿Qué tareas tengo pendientes?" y luego algo que solo estaría en un PDF | La pantalla muestra el aviso informativo (RB-30); la primera respuesta incluye la tarea y la cita; la segunda responde "No encontré esto en tus documentos". Sin tareas pendientes ni documentos, vuelve el aviso de indexar un PDF (A-13) |
| B-44 | Preguntas por fechas, con y sin documentos: "¿Qué tengo para hacer esta semana?" con una tarea esta semana y con tareas solo en fechas lejanas; "¿Qué tengo para mañana?"; "¿Qué vence primero?" | Con tareas en el periodo, las lista y las cita; sin tareas en el periodo, "No tienes tareas para esta semana." (o "para mañana") y la tarea pendiente más próxima con su fecha y su cita; "qué vence primero" responde la de fecha límite más próxima. Nunca "No encontré esto en tus documentos" si hay tareas pendientes |
| B-45 | Sin documentos y sin tareas; sin documentos y con tareas; con documentos y sin tareas: preguntar "¿Tengo alguna tarea?" y algo de un documento | Sin tareas: "No tienes tareas pendientes."; con tareas: las lista y las cita; sin documentos, la pregunta de documento explica que no hay documentos (en tuteo); con documentos, "No encontré esto en tus documentos" si el dato no está. Nunca se bloquea la pregunta; el aviso de arriba es informativo y no se repite como respuesta |
| B-46 | Recorrer Inicio, Asistente, Tareas, Productividad y Web | El aviso del proveedor está completo solo en el Asistente y como línea corta bajo "Pregúntale a Nova" en Inicio; Web conserva su subtítulo; no aparece en Tareas ni en Productividad |
| B-47 | Crear tareas de hoy con horario (8:00 – 9:30, solo 20:00) y sin horario; probar "Hasta" sin "Desde" y "Hasta" antes de "Desde"; preguntar al Asistente por una hora | Los mensajes exactos de RB-34; en Mi semana el día muestra primero las de hora en orden y luego las demás por prioridad, con su horario; Tareas y Prioridades de hoy muestran el horario; el Asistente responde con la tarea de esa hora |
| B-48 | (E08) Registrar tarea: tocar el campo de categoría, escribir parte de un nombre, escribir " universidad " (existente) y luego un nombre nuevo; guardar con ‘Crear “X”’ y otra tarea escribiendo el mismo nombre en minúsculas sin elegir | Lista con los colores; se filtra; " universidad " no ofrece crear; el nombre nuevo muestra ‘Crear “X”’ y el aviso; al guardar se crea una sola categoría con el siguiente color libre y las dos tareas la usan |
| B-49 | (E08) Con una tarea vencida: en Inicio, tocar "1 tarea vencida"; en Mi semana y en Tareas, ver la tarea | Abre Tareas en "Vencidas" (píldora activa) con solo las pendientes vencidas; la insignia "Vencida" aparece en Mi semana y en Tareas, no en las completadas ni en las de hoy |
| B-50 | (E10b) Indexar un libro de más de 300 páginas con índice | Avanza "Indexando… %" y se puede cerrar y volver; al terminar, "Ver capítulos" lista sus capítulos con páginas |
| B-51 | (E10c) "¿Qué dice la página 45?" con el libro elegido en "Buscar en"; y con dos libros sin elegir | Responde con esa página citando `p. 45`; sin elegir, pregunta en qué documento (RB-39) |
| B-52 | (E10c) "Resume el capítulo 3" | Resumen del capítulo citando sus páginas; si es muy largo, el aviso de RB-40 |
| B-53 | (E10c) Bajo una respuesta con citas, tocar "Más simple" y "Con un ejemplo" | Respuestas nuevas con las mismas citas, sin buscar otra vez |
| B-54 | (E10d) Plan de lectura de 4 capítulos en dos semanas; repetirlo | 4 tareas con fechas repartidas y páginas en el título; la segunda vez, esos capítulos dicen "Este capítulo ya está en Tareas." |
| B-55 | (E11b) En el iPhone: agregar Nova a inicio desde la guía; en Android, "Instalar" | Ícono "Nova", abre a pantalla completa sin barra del navegador; inicia sesión dentro de la app |
| B-56 | (E11c) Activar notificaciones desde el primer recordatorio y "Enviar una de prueba" | El permiso se pide solo al tocar el botón; la de prueba llega a la pantalla de bloqueo y al centro de notificaciones |
| B-57 | (E11c) Tarea de hoy con horario dentro de 20 min y recordatorio "15 min antes"; otra sin horario con "El mismo día" | Llega `En 15 min: {título} ({horario})` una sola vez; al tocarla abre la tarea resaltada; el ícono muestra el numerito; la otra avisa a la hora fija |
| B-58 | (E11d) Activar el resumen diario con tareas de hoy y una vencida; otro día sin ninguna | Llega una sola notificación `Hoy: {n} tareas · 1 vencida`; sin tareas, ninguna |
| B-59 | (E11d) "Agregar a mi calendario" en el iPhone y en Android | Se abre el calendario del teléfono con el evento y su alarma |
| B-60 | (E10e) Crear un cuestionario de 5 preguntas, dificultad media, de un capítulo, y otro de un rango de páginas | Preguntas de 4 opciones; las páginas citadas están dentro del alcance elegido |
| B-61 | (E10e) Pedir 20 preguntas de una sola página | Dice que el contenido no alcanza (RB-49); no crea nada |
| B-62 | (E10e) Responder en el teléfono, con una correcta y una incorrecta | Opciones fáciles de tocar; muestra si acertaste, la correcta, la explicación y la cita de la página; la respuesta no se puede cambiar |
| B-63 | (E10e) Cerrar a la mitad y volver | Sigue en la pregunta donde iba |
| B-64 | (E10e) Terminar con 3 de 5 y "Repetir solo las que fallé" | Puntaje 3,0; el repaso trae solo las 2 falladas y se califica sobre ellas |
| B-65 | (E10f) Hacer el mismo cuestionario dos veces y abrir el historial | Se ven los intentos por documento y capítulo, y si mejoraste; los repasos dicen "Repaso" |
| B-66 | (E10f) Fallar 2 preguntas de un capítulo y aceptar la sugerencia; repetirlo | Crea "Repasar cap. N: Título (pp. a–b)" tras confirmar; la segunda vez, RB-53 |
| B-77 | (E10g) Crear un cuestionario sin cambiar el tipo, de 5 preguntas, de un capítulo | Es mixto: una pregunta de cada tipo, intercaladas, cada una con su cita y su página al responder |
| B-78 | (E10g) En una de respuesta múltiple con 2 correctas: marcar las 2 correctas y 1 incorrecta | Dice cuántas eran correctas; vale 0,5; queda fija y entra en "Repetir solo las que fallé" |
| B-79 | (E10g) Responder una de verdadero o falso cuya afirmación es falsa, y una de completar escribiendo la respuesta en mayúsculas, sin tilde y con espacios de más | La falsa explica qué es lo correcto según la cita; la de completar cuenta como correcta |
| B-80 | (E10g) En una pregunta abierta: enviar la respuesta, cerrar la pantalla, volver y marcar "A medias" | Al volver se ven la respuesta modelo y los tres botones; vale 0,5; la respuesta y la calificación ya no se pueden cambiar; entra en "Repetir solo las que fallé" |
| B-81 | (E10g) Crear uno solo de verdadero o falso y otro solo de completar; abrir un cuestionario creado antes de E10g y el historial | Todas las preguntas son del tipo elegido; el anterior funciona igual, como selección única; el historial muestra el tipo de cada cuestionario |
| B-82 | (E11e) En el iPhone (app instalada), modo avión: crear una tarea de mañana con "1 hora antes" y otra con una categoría nueva | Dice `Guardada en este dispositivo…`; ambas aparecen en Tareas, Inicio y Calendario con `Pendiente de enviar` y sin casilla |
| B-83 | (E11e) Quitar el modo avión con Nova abierta | Se envían solas: `Se enviaron 2 tareas…`; quedan una sola vez cada una (también con dos pestañas abiertas en el PC), la categoría nueva existe y el recordatorio llega a su hora |
| B-84 | (E11e) Sin conexión, crear una tarea de hoy con "A la hora" a una hora que pasará antes de volver la conexión; volver | Se guarda en el servidor y avisa `El recordatorio de «…» no se enviará…` |
| B-85 | (E11e, en la prueba automática de Edge: con las mismas validaciones en el dispositivo y en el servidor, a mano casi no se puede provocar) Una pendiente que el servidor rechaza; tocar "Corregir" en ella y "Descartar" en otra | La rechazada muestra `No se pudo enviar: {mensaje}`; corregida se envía; la descartada desaparece |
| B-86 | (E11e) Con una tarea sin enviar, tocar "Cerrar sesión" | Avisa `Tienes 1 tarea sin enviar…`; con "Cancelar" no cierra; con "Cerrar sesión y borrarlas", cierra y al volver a entrar ya no está |
| B-67 | (E10b2) En "Buscar en la web": buscar una frase, ver la fuente en "Fuentes guardadas" sin recargar y eliminarla; con 20 en una categoría, buscar otra vez | Aparece en su categoría con su enlace y "1/20"; eliminar pide confirmación y la quita; al llegar a 20, el aviso indica que se pueden eliminar abajo, y al eliminar una se puede volver a buscar |
| B-68 | (E10c2) Con "Wikipedia" en "Buscar en": buscar una frase y no tocar "Guardar fuente"; buscar otra y guardarla; guardarla otra vez; con 20 en la categoría, buscar y guardar | La primera no aparece en "Fuentes guardadas"; la segunda sí, sin recargar; repetirla avisa que ya está; con 20, la búsqueda funciona y el tope se avisa al guardar (A-18) |
| B-69 | (E10c2) Con "Fuentes web" en "Buscar en": preguntar algo de una fuente guardada y algo que no esté; con "Todos los documentos", preguntar lo mismo; sin fuentes guardadas, preguntar | Responde citando la fuente con su enlace, que abre Wikipedia; lo que no está: `No encontré esto en tus fuentes web guardadas. Prueba con "Wikipedia" en "Buscar en".`; con documentos no usa la fuente; sin fuentes, el aviso de RB-56 |
| B-70 | (E11c) Indexar un libro largo y cerrar la pantalla o bloquear el teléfono; volver unos minutos después | El libro siguió avanzando solo, o ya aparece listo, sin repetir fragmentos |
| B-71 | (E10c2) Abrir Fuentes y `/nova/web`; volver a una respuesta de Wikipedia al recargar | Fuentes solo tiene Subir PDF y Fuentes guardadas; la dirección antigua abre Fuentes guardadas; la respuesta conserva sus enlaces y no entra en las preguntas siguientes sobre documentos |
| B-72 | (E10c3) Con "IA (conocimiento general)": preguntar algo general; recargar; luego preguntar sobre un documento con "Todos los documentos" | Sale la marca "Respuesta general de la IA, sin fuentes. Compruébala si es importante.", sin citas ni "Explicar de otra manera", también al recargar; la respuesta sobre el documento cita solo el documento |
| B-73 | (E10c3) Preguntar algo que no esté en los documentos y tocar "Preguntarle a la IA"; revisar una respuesta con citas | Se conserva el "No encontré" y debajo llega la respuesta con la marca; la respuesta con citas no trae el botón |
| B-74 | (E11b) Abrir Inicio, Tareas, Calendario y capítulos; activar modo avión y volver a abrir la app | Se ven los datos con `Sin conexión · datos de las HH:MM`; una pantalla que nunca se abrió lo dice |
| B-75 | (E11b) Sin conexión: intentar usar Asistente, indexar, cuestionarios, búsqueda web, crear, completar, editar y eliminar | Todo aparece desactivado con `Necesitas conexión para esto.`; al volver la conexión, funciona y los datos se actualizan |
| B-76 | (E11b) Cerrar sesión; luego, con otra sesión, hacer que el servidor la rechace y volver a abrir | En ambos casos ya no se ven los datos guardados sin conexión |
| B-41 | Editar una tarea pendiente desde Tareas, Inicio y Calendario (título, categoría, prioridad y fecha) | El formulario abre lleno; al guardar, el cambio se ve en las tres pantallas y en su día del Calendario; "Cancelar" no cambia nada |
| B-42 | Al editar, poner fecha "2026-02-30" y luego prioridad 5 por la API; intentar editar una tarea completada | Mismos mensajes que al crear (A-03, A-04); la completada responde "La tarea ya está completada." y no muestra "Editar" |

## 13. Riesgos y decisiones

| Riesgo o decisión | Cómo se maneja |
|---|---|
| Una sola base para producción y vista previa | Migraciones aditivas; prueba de compatibilidad con el código de `master` tras cada una (11.3); `buscar_fragmentos` y las columnas existentes no se tocan |
| `usuario_id` sin romper `master` | Columna nullable, relleno de lo existente y disparador que asigna el dueño por defecto a lo que inserte `master`. El disparador es temporal: se revisa y se quita al unir con `master` (6.1, E21) |
| Cuota gratuita de Gemini | Temas y plan son acciones explícitas del usuario; contexto acotado; `gemini-3.1-flash-lite` con respaldo; los scripts reales se corren una vez por etapa |
| El modelo inventa temas o fuentes | No se confía en el prompt: esquema JSON y validación en el servidor (9.3); se descarta lo que no cumpla |
| Coma flotante en notas | Enteros en centésimas y redondeo explícito (sección 7) |
| "Se ve 3,0 pero no aprueba" | Aprobar se decide sobre el valor mostrado (7.2) |
| Vista previa protegida por Vercel | Si pide iniciar sesión en Vercel en el teléfono, el usuario entra con su cuenta de Vercel o desactiva la protección de vista previa; se comprueba en E00 |
| Variables de entorno en vista previa | `GEMINI_API_KEY` y `BLOB_READ_WRITE_TOKEN` ya están en Preview; las de Supabase y Postgres se comprueban por nombre en E00 |
| Navegador para pruebas | Edge con `puppeteer-core`; si una actualización pendiente lo impide, se verifica por HTTP y se avisa (como en P10 y P11) |
| Tareas programadas en Vercel Hobby (una vez al día, imprecisas) | Los recordatorios usan `pg_cron` + `pg_net` de Supabase cada minuto (gratis); `pg_net` está en beta y no reintenta: el tick es idempotente y `db:verificar` revisa `net._http_response` |
| Supabase gratis pausa el proyecto con poca actividad en 7 días | **Efecto:** con la base pausada, Nova entera deja de funcionar, no solo los recordatorios, y `pg_cron` no corre (es un trabajo dentro de la base; la documentación no lo detalla). Al reanudar, los trabajos siguen configurados y los avisos atrasados más de 30 min se omiten (7.10), no llegan en tropel. **Qué cuenta como actividad:** según Supabase, las peticiones del usuario a la base, incluidas las de la aplicación conectada; bastan unas pocas por día. No está documentado si un trabajo de `pg_cron` por sí solo cuenta. **Cómo se evita:** (1) desde E11c, el tick llega a la aplicación en Vercel y esta consulta la base cada minuto; (2) como eso depende de `pg_cron`, al unir con `master` (E21) se agrega un cron diario de Vercel a `GET /api/nova/salud`, que Hobby sí permite, independiente de la base. Los cron de Vercel solo corren en producción: hasta E21 protege el tick y el uso diario. (3) Supabase avisa por correo antes de pausar: en ese caso, abrir Nova o el panel. (4) Si se pausa: "Resume project" en el panel, con datos y configuración intactos (hasta 1 año) |
| Sonido de las notificaciones en el iPhone | La web no elige el sonido; iOS decide según sus ajustes. Se comprueba en el iPhone del usuario en E11c y se documenta lo que se ve |
| Las pruebas agotaron la cuota de producción (2026-11-09) | La cuota de Gemini es por proyecto, con la misma clave en local, vista previa y producción, y se reinicia a medianoche de Pacífico (las 3:00 en Bogotá). Google prohíbe intentar eludir los límites, así que no se crea un segundo proyecto gratis para tener más cuota. Decisión del usuario: las pruebas guardan en el computador, fuera de git, los embeddings ya calculados y solo los reutilizan si coinciden el texto, el modelo y la dimensión. La prueba completa con Gemini real se hace una vez por etapa. Reindexar documentos reales se hace aparte, con cuota disponible |
| Datos privados en el dispositivo (E11b) | Decisión del usuario del 2026-11-09: copia de solo lectura de tareas, calendario y capítulos, borrada según RB-63. No guardar sesión en un teléfono compartido; la guía de instalación lo dice |
| Cuota gratuita de Gemini con libros largos | Embeddings gratis: unos 30.000 tokens por minuto y unas 1.000 peticiones al día (cifras de la documentación de Google, a confirmar en AI Studio). Un libro de 400 páginas (unos 210.000 tokens) tarda unos 8 a 10 minutos: por eso se indexa por partes (RB-38). Caben 1 o 2 libros grandes por día y comparten la cuota con las preguntas. Resumir un capítulo es una sola llamada de hasta unas 40.000 palabras; "Explicar de otra manera" es una llamada por toque |
| Espacio en Supabase gratis (500 MB) | Un libro de 400 páginas ocupa unos 2 a 3 MB (texto, vectores e índice); los PDF se borran de Blob al terminar |
| Costo de los cuestionarios con la cuota gratis de Gemini | Generar es 1 llamada (2 como máximo) del modelo de chat, sin embeddings; responder, repetir y ver el historial no llaman a Gemini. Entrada aproximada: 10.000 tokens con 5 preguntas, 20.000 con 10 y 40.000 con 20; salida, unos 3.000 con 20. Para el modelo de chat las fuentes dan entre 500 y 1.500 peticiones al día y unos 250.000 tokens por minuto (cifras no oficiales: confirmar en AI Studio). Con la cifra más baja y reintento en todos: unos 250 cuestionarios al día, compartidos con el chat; el modelo de respaldo tiene su propia cuota. En tokens, unos 6 de 20 preguntas por minuto |
| Preguntas equivocadas del modelo | La validación de 9.6 garantiza que la pregunta sale del documento, no que la respuesta marcada sea correcta. Se muestran siempre la explicación y la cita para poder comprobarla; el puntaje no afecta las notas |
| Privacidad con Gemini gratuito | Los términos del plan gratuito permiten a Google usar el contenido para mejorar sus productos y que personas lo lean, y piden no enviar información sensible, confidencial o personal. Rige desde hoy para preguntas, fragmentos y libros. El aviso de E11 (Configuración → Asistente) debe decirlo con claridad. El plan de pago no los usa para mejorar productos (2.2) |
| Sesión dentro de la app instalada en el iPhone | Es distinta de la de Safari: se inicia sesión una vez dentro de la app; la guía lo dice |
| Tamaño de la ampliación | 22 etapas pequeñas (más las agregadas después), cada una con su commit y su prueba; se puede parar en cualquier etapa con todo funcionando |
| Abrir la app más rápido (anotado para E20b) | Abrir la app mostrando al instante la copia guardada de Inicio con un aviso "Actualizando…" y reemplazarla en su lugar al llegar la respuesta del servidor, con completar, crear y editar desactivados mientras tanto; solo Inicio, con una copia del mismo usuario de menos de 24 h, sin pedidos extra al servidor. Riesgo: por un momento puede verse una tarea ya completada en otro dispositivo, o la copia antes de llevar al inicio de sesión si la sesión venció. Propuesta del 2026-11-13, no hecha por decisión del usuario. Junto con bajar el tiempo de carga de cada pantalla (≈ 550 ms en local; ver `PROMPTS_AMPLIACION.md`, E20b). |
| Tareas creadas sin conexión (E11e) | Solo crear: completar, editar o eliminar sin conexión obligaría a resolver conflictos con lo que pasó en otro dispositivo. La duplicación se evita en el servidor (`id_cliente` único por usuario), no solo en el dispositivo. En el iPhone el sistema puede borrar los datos de una app web que no se usa en semanas: lo pendiente se puede perder si no se abre Nova con conexión; Tareas lo advierte mientras haya pendientes |
| Tipos de pregunta (E10g) | La abierta se califica con la autoevaluación del usuario, sin Gemini: es honesta solo si el usuario lo es, y por eso la respuesta modelo y la cita se muestran siempre. La de completar solo acepta lo que falta, con la comparación de 7.13: un sinónimo no cuenta. Verdadero o falso puede salir desbalanceado (9.7) |
