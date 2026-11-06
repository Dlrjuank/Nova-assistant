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
12. [Casos de aceptación B-01 a B-42](#12-casos-de-aceptación-b-01-a-b-42)
13. [Riesgos y decisiones](#13-riesgos-y-decisiones)

---

## 1. Reglas generales

| Regla | Detalle |
|---|---|
| Rama | Todo en `ampliacion`, creada desde `master`. Nunca se hace commit ni push a `master`. La unión con `master` la decide el usuario al final. |
| Vista previa | Cada push de `ampliacion` genera un despliegue de vista previa en Vercel; ahí se prueba en el teléfono. Producción (`master`) no cambia. |
| Una sola base | Producción y la vista previa usan el **mismo** proyecto de Supabase. Toda migración es **aditiva** (tablas nuevas, columnas opcionales, funciones nuevas). Nunca se renombra, borra ni cambia el tipo de algo que use el código de `master`. |
| Compatibilidad con `master` | Después de cada migración, el código de `master` debe seguir creando, completando y eliminando tareas, indexando y eliminando documentos, consultando, guardando historial, calculando el índice y buscando en Wikipedia igual que hoy. Se comprueba corriendo los scripts de `master` contra la base (sección 11.3). |
| No romper la aceptación | A-01 a A-21 y sus mensajes exactos siguen valiendo. Si una ruta cambia de lugar, la vieja redirige a la nueva. |
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
| X1 | Rediseño: paleta cálida, modo claro y oscuro, íconos, encabezados, login | E02, E04 |
| X2 | Navegación: barra lateral (computador), barra inferior + "Más" + botón "+" (teléfono) | E03 |
| X3 | Categorías de tareas con color | E05 |
| X4 | Inicio: "Pregúntale a Nova", semana, progreso semanal, prioridades de hoy | E06 |
| X5 | Calendario mensual con tareas y fechas de Semestre | E07, E13 |
| X6 | Tareas con pestañas y agrupación por categoría | E08 |
| X17 | Editar tareas ya creadas: título, categoría, prioridad y fecha límite | E09 |
| X7 | Fuentes: Documentos y Web en una sección | E10 |
| X8 | Configuración: perfil, apariencia, académico, categorías, asistente, cerrar sesión | E05, E11 |
| X9 | Semestre · Materias y notas: cortes, actividades, cálculos, "¿Cuánto necesito?" | E12, E13 |
| X10 | Semestre · Fallas | E14 |
| X11 | Productividad · Metas semanales | E15 |
| X12 | Semestre · Objetivos y "¿es alcanzable?" | E16 |
| X13 | Semestre · Temas del corte (manuales y propuestos desde el syllabus) | E17 |
| X14 | Semestre · Plan de estudio con el asistente, editable y con versiones | E18 |
| X15 | Semestre · Pasar pasos del plan a Tareas | E19 |
| X16 | Semestre · Estadísticas | E20 |

### 2.2 Fuera de alcance

- Rutinas (tareas recurrentes).
- Hora de las tareas: las tareas solo tienen fecha límite (la imagen de referencia muestra horas; no se agregan).
- Escala de notas distinta de 0,0 a 5,0.
- Que el chat del Asistente responda sobre notas, materias o metas (sigue respondiendo sobre PDF y tareas).
- Que las fuentes web alimenten al chat.
- Lista de conversaciones anteriores (la base ya lo permite desde M4; la pantalla no).
- Arrastrar y soltar tareas entre días.
- Notificaciones y recordatorios.
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
| Configuración | `/nova/configuracion` | `Settings` | E05 |

### 4.2 Computador (≥ 1024 px)

Barra lateral fija a la izquierda con la marca "Nova", las secciones disponibles, el correo del usuario y "Cerrar sesión". El ítem activo lleva fondo de acento suave y `aria-current="page"`.

### 4.3 Teléfono y tableta (< 1024 px)

- Barra inferior fija con 5 botones: **Inicio, Calendario, Asistente (al centro, destacado con el color de acento), Tareas, Más**. Respeta `env(safe-area-inset-bottom)`.
- **Más** abre una hoja inferior con el resto de secciones (Fuentes, Productividad, Semestre, Configuración) y "Cerrar sesión". Se cierra con Escape, con el botón "Cerrar" o tocando fuera; el foco queda atrapado mientras está abierta.
- Botón flotante **"+"** sobre la barra inferior (no en la pantalla del Asistente, para no tapar el campo de pregunta). Abre un menú con **"Nueva tarea"** (`/nova/tareas/nueva`) y **"Subir documento"** (Fuentes, pestaña Subir PDF).
- Mientras Calendario o Semestre no existan, su lugar en la barra inferior lo ocupa otra sección existente (regla "sin botones muertos").

### 4.4 Rutas que cambian

| Antes | Después | Cómo |
|---|---|---|
| `/nova` (Asistente) | `/nova` es Inicio; el chat pasa a `/nova/asistente` | A-01 sigue: `/nova` sin sesión → login. El login sigue llevando a `/nova`. |
| `/nova/documentos`, `/nova/documentos/nuevo` | `/nova/fuentes?pestana=pdf` | Redirección permanente (E10) |
| `/nova/web` | `/nova/fuentes?pestana=web` | Redirección permanente (E10) |

Las rutas de la API (`/api/nova/...`) que ya existen no cambian de nombre ni de contrato; solo se agregan rutas nuevas.

## 5. Pantallas

### 5.1 Inicio (`/nova`)

1. **"Pregúntale a Nova"**: bloque destacado arriba, con un campo de una línea y botón "Preguntar". Al enviar, lleva a `/nova/asistente` con la pregunta enviada (no solo prellenada). Valida RN-02 en vivo, igual que el chat.
2. **Mi semana**: lunes a domingo de la semana actual (Bogotá), con flechas para la semana anterior y siguiente y el rango ("3 – 9 de nov."). En computador, 7 columnas; en teléfono, una fila de 7 días para elegir y la lista del día elegido. Cada tarea muestra casilla, título, insignia de categoría y prioridad. Las tareas se ubican por **fecha límite**.
3. Marcar la casilla de una tarea pendiente abre **el mismo diálogo de minutos** que en Tareas (componente `AccionesTarea`), porque el índice y las metas dependen de esos minutos. Cancelar no cambia nada. Una tarea completada no se puede desmarcar (como hoy).
4. **Progreso semanal**: anillo con el porcentaje de tareas completadas de la semana mostrada, y contadores de completadas, pendientes y total (sección 7.1).
5. **Prioridades de hoy**: tareas pendientes con fecha límite hoy, ordenadas por prioridad (Alta primero) y luego por título; debajo, "N tareas vencidas" con enlace a Tareas si hay pendientes con fecha pasada. Botón "Agregar" → `/nova/tareas/nueva?fecha=<hoy>`.

### 5.2 Asistente (`/nova/asistente`)

El chat actual con su historial, sin cambios de comportamiento. Si llega con una pregunta desde Inicio, la envía al cargar (una sola vez).

### 5.3 Calendario (`/nova/calendario`)

- Vista mensual (lunes primero), con flechas de mes y botón "Hoy". Cada día muestra puntos del color de la categoría de sus tareas (máximo 3 puntos y "+N"), y un ícono distinto para fechas de Semestre (cortes y actividades) a partir de E13. Leyenda debajo.
- Tocar un día muestra debajo (teléfono) o al lado (computador) la lista de ese día: tareas (con completar, mismo diálogo) y eventos de Semestre (enlazan a la materia), y el botón **"Agregar tarea"** → `/nova/tareas/nueva?fecha=<día>`.
- El formulario de tarea acepta `?fecha=YYYY-MM-DD` válida y la pone en el campo (con la máscara); una fecha inválida se ignora.

### 5.4 Tareas (`/nova/tareas`)

- Pestañas en píldora: **Todas**, **Hoy** (fecha límite hoy), **Importantes** (prioridad Alta y pendientes), **Completadas**. La pestaña va en la URL (`?vista=hoy`).
- Agrupación por categoría: encabezado con punto de color, nombre y contador **completadas/total** del grupo dentro de la pestaña (por ejemplo "4/6"); dentro, las tareas con casilla, título, fecha, prioridad y acciones (completar, eliminar) como hoy.
- Botón principal "Nueva tarea". El formulario ofrece las categorías existentes (selector) y permite escribir una nueva, que se crea con el siguiente color libre de la paleta.
- **Editar** (E09): cada tarea pendiente tiene la acción "Editar" en Tareas, en Inicio y en la lista del día del Calendario. Lleva a `/nova/tareas/[id]/editar`, con el mismo formulario de crear (componente `FormularioTarea`) ya lleno con título, categoría, prioridad y fecha límite. Mismas validaciones y mensajes que al crear (RN-01, RN-03, RN-04, RN-07 y la máscara AAAA-MM-DD, con el aviso de fecha pasada). "Guardar cambios" vuelve a la pantalla de origen; "Cancelar" no cambia nada. Las tareas completadas no se editan (RB-29).

### 5.5 Fuentes (`/nova/fuentes`)

Pestañas **Subir PDF** (subida e índice de documentos actuales, con eliminar) y **Buscar en la web** (búsqueda en Wikipedia actual). A partir de E13, al subir un PDF se puede elegir como categoría una **materia** de Semestre (se guarda en `documentos.materia_id`); la lista muestra la materia.

### 5.6 Productividad (`/nova/productividad`)

El índice diario actual sin cambios, y debajo **Metas semanales**: lista de metas con barra de progreso de la semana actual ("7 de 10 tareas", "3 h 20 min de 5 h"), botón "Nueva meta" y eliminar con confirmación.

### 5.7 Semestre (`/nova/semestre`)

Pestañas **Materias y notas**, **Objetivos y plan**, **Estadísticas** (cada una aparece en su etapa).

- **Materias y notas**: lista de materias en tarjetas (nombre, créditos, nota acumulada y proyectada con insignia Aprueba / En riesgo / No aprueba, fallas). Arriba, el **promedio del semestre** ponderado por créditos. Al abrir una materia: sus cortes con porcentaje y fecha, las actividades de cada corte con nota, porcentaje y fecha, la nota de cada corte y el bloque **"¿Cuánto necesito?"** (para aprobar y para la meta, si hay).
- **Objetivos y plan**: por materia y corte, la meta, si es alcanzable, los temas del corte y el plan de estudio con sus versiones.
- **Estadísticas**: evolución de notas por corte, comparación entre materias y materias en riesgo.

### 5.8 Configuración (`/nova/configuracion`)

Bloques: **Perfil** (nombre editable, correo de solo lectura, cambiar contraseña), **Apariencia** (claro, oscuro, automático), **Académico** (escala 0,0 a 5,0 de solo lectura, nota para aprobar, redondeo truncar/redondear, cortes por defecto), **Categorías** (crear, renombrar, cambiar color, eliminar), **Asistente** (borrar todo el historial, aviso de Gemini) y **Cerrar sesión**.

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
- La migración siembra, por cada usuario con tareas, una categoría por cada nombre distinto ya usado, con colores de la paleta en orden; "General" siempre existe.
- Renombrar una categoría actualiza también `categoria` en las tareas de ese usuario, en la misma transacción. Eliminarla pide confirmación y pasa sus tareas a "General".

### 6.3 M7 · Preferencias (E11)

| Tabla | Columnas | Restricciones |
|---|---|---|
| `preferencias_usuario` | `usuario_id` (PK), `tema` (`claro`/`oscuro`/`automatico`), `nota_aprobar` NUMERIC(3,2) default 3.00, `redondeo` (`truncar`/`redondear`) default `truncar`, `cortes_defecto` INTEGER[] default `{3000,3000,4000}` (centésimas de punto porcentual), `actualizado_en` | `nota_aprobar` entre 0 y 5; cada corte > 0 y suma 10000 |

Sin fila, se usan los valores por defecto. El nombre del perfil vive en `public.users.full_name` (ya existe).

### 6.4 M8 · Semestre (E12)

| Tabla | Columnas | Restricciones |
|---|---|---|
| `materias` | `id`, `usuario_id`, `nombre` VARCHAR(80), `creditos` SMALLINT, `docente` VARCHAR(120) NULL, `creada_en` | `UNIQUE (usuario_id, lower(nombre))`; créditos 1 a 10; `UNIQUE (id, usuario_id)` |
| `cortes` | `id`, `materia_id`, `usuario_id`, `orden` SMALLINT, `nombre` VARCHAR(40), `porcentaje` INTEGER (centésimas: 3000 = 30 %), `fecha` DATE NULL | FK compuesta `(materia_id, usuario_id)` → `materias`, `ON DELETE CASCADE`; porcentaje 1 a 10000; `UNIQUE (materia_id, orden)`; `UNIQUE (id, usuario_id)` |
| `actividades` | `id`, `corte_id`, `usuario_id`, `nombre` VARCHAR(120), `nota` SMALLINT NULL (centésimas: 375 = 3,75), `porcentaje` INTEGER (centésimas, dentro del corte), `fecha` DATE NULL | FK compuesta `(corte_id, usuario_id)` → `cortes`, `ON DELETE CASCADE`; nota 0 a 500 o NULL (sin calificar); porcentaje 1 a 10000 |
| `documentos` (columna nueva) | `materia_id` UUID NULL | FK → `materias (id)` `ON DELETE SET NULL` |

- Notas y porcentajes se guardan como **enteros en centésimas** para calcular sin errores de coma flotante (sección 7).
- Al crear una materia se crean sus cortes con los porcentajes por defecto de Configuración ("Corte 1", "Corte 2", "Corte 3") y una categoría de tareas con el mismo nombre, si no existe.
- La suma de porcentajes de los cortes (= 100 %) y de las actividades de un corte (≤ 100 %) se valida en el servidor dentro de una transacción, no con CHECK (involucra varias filas).
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

### 7.3 Nota de un corte

Con las actividades del corte (porcentaje `p_i` dentro del corte, nota `n_i` o sin calificar):

- **Aporte acumulado del corte** = Σ (n_i × p_i) / 100 % sobre las actividades calificadas. Es la nota del corte si lo que falta sacara 0.
- **Nota del corte (parcial)** = Σ (n_i × p_i) / Σ p_i sobre las calificadas: el promedio de lo ya calificado. Sin actividades calificadas: "Sin notas".
- **Peso pendiente del corte** = 100 % − Σ p_i de las calificadas (incluye actividades sin nota y porcentaje aún no asignado a actividades).

### 7.4 Nota de una materia

Con cortes de porcentaje `P_c` (suman 100 %):

- **Acumulada** = Σ_c (aporte acumulado del corte c × P_c / 100 %). Es lo ya asegurado.
- **Peso pendiente de la materia** `W` = Σ_c (peso pendiente del corte c × P_c / 100 %), en %.
- **Proyectada** = acumulada / (100 % − W) × 100 %, es decir, el promedio ponderado de todo lo calificado, suponiendo que lo que falta sigue igual. Sin nada calificado: "Sin notas". Si W = 0, proyectada = acumulada = **definitiva**.
- **Estado**: con W = 0, "Aprobada" o "Reprobada" según `mostrar(definitiva)`; con W > 0, "Aprueba", "En riesgo" (la proyectada no aprueba pero aprobar aún es posible) o "No alcanza" (aprobar ya no es posible).

### 7.5 "¿Cuánto necesito?"

Para un objetivo `O` (la nota para aprobar o una meta), con la acumulada `A` y el peso pendiente `W` de la materia (o del corte, para metas de corte):

- Se busca la nota uniforme `x` en todo lo pendiente tal que `mostrar(A + x × W / 100 %) ≥ O`. Como `mostrar` trunca o redondea, el umbral exacto es `O` (truncar) u `O − 0,05` (redondear).
- `x = (umbral − A) × 100 % / W`, **redondeada hacia arriba a la centésima** y mostrada con un decimal **hacia arriba** (para que alcanzarla garantice el objetivo).
- Si `x ≤ 0`: "Ya aseguraste {O}." Si `x > 5,0`: no es posible; se muestra la **nota máxima alcanzable** = `mostrar(A + 5,0 × W / 100 %)`. Si W = 0, no hay nada pendiente: se informa la definitiva.

### 7.6 Promedio del semestre

- **Promedio proyectado** = Σ (proyectada × créditos) / Σ créditos, sobre las materias con al menos una nota.
- **Promedio acumulado** = Σ (acumulada × créditos) / Σ créditos, sobre todas las materias con cortes.
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

## 8. Reglas de negocio y mensajes exactos

Los mensajes se usan **textualmente** en la interfaz y en la API. Los de `PLAN_NOVA.md` (sección 5.1 y 12.2) no cambian.

| ID | Regla | Mensaje exacto |
|---|---|---|
| RB-01 | Toda lectura y escritura se limita al usuario de la sesión | (404 genérico del recurso si no es suyo) |
| RB-02 | Nombre de categoría: recortado, 1 a 80 caracteres, único por usuario sin distinguir mayúsculas | `Ya existe una categoría con ese nombre.` |
| RB-03 | Color de categoría: uno de la paleta fija | `Elige un color de la lista.` |
| RB-04 | Eliminar categoría: sus tareas pasan a "General"; "General" no se elimina | `La categoría General no se puede eliminar.` |
| RB-05 | Nombre de materia único por usuario | `Ya existe una materia con ese nombre.` |
| RB-06 | Créditos enteros de 1 a 10 | `Los créditos deben ser un número entero entre 1 y 10.` |
| RB-07 | Los cortes de una materia suman exactamente 100 % | `Los porcentajes de los cortes deben sumar 100 %. Ahora suman {n} %.` |
| RB-08 | Las actividades de un corte no pasan de 100 % | `Los porcentajes de las actividades de un corte no pueden pasar de 100 %. Ahora suman {n} %.` |
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
| RB-29 | Editar una tarea: solo pendientes y del usuario; título, categoría, prioridad y fecha límite con las mismas validaciones y mensajes que al crear; estado, minutos y fecha de cierre no se tocan | Los de crear (`PLAN_NOVA.md` 5.1). Tarea completada: `La tarea ya está completada.` (`TAREA_YA_COMPLETADA`, 409). De otro usuario o inexistente: `La tarea no existe.` (`TAREA_NO_ENCONTRADA`, 404) |

Códigos de error nuevos (404 salvo indicación): `CATEGORIA_NO_ENCONTRADA`, `CATEGORIA_DUPLICADA` (409), `MATERIA_NO_ENCONTRADA`, `MATERIA_DUPLICADA` (409), `CORTE_NO_ENCONTRADO`, `ACTIVIDAD_NO_ENCONTRADA`, `PORCENTAJES_INVALIDOS` (422), `NOTA_INVALIDA` (422), `META_NO_ENCONTRADA`, `META_DUPLICADA` (409), `PLAN_SIN_TEMAS` (422), `PLAN_SIN_FECHA` (422), `SIN_SYLLABUS` (422), `PLAN_INVALIDO` (502), `PASO_YA_EN_TAREAS` (409).

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

Cada versión guarda su `huella`: `{ meta, temas: [id+nombre confirmados], notas: [actividad+nota del corte y de la materia], documentos: [ids de PDF de la materia] }`. La pantalla compara la huella de la versión vigente con la actual y, si difieren, muestra RB-23 con la lista de lo que cambió ("un PDF nuevo", "notas nuevas", "temas cambiados", "meta cambiada") y el botón "Actualizar plan". Actualizar genera una versión nueva; nunca se reemplaza sola. "Editar" permite cambiar título, fecha y minutos de cada paso, borrar pasos y agregar pasos manuales (con un tema confirmado); guardar crea una versión `manual`. "Restaurar" copia una versión anterior como versión nueva.

### 9.5 Pasar a Tareas (E19, RB-24)

Cada paso tiene "Pasar a Tareas": un diálogo muestra título, fecha límite = fecha del paso, categoría = nombre de la materia y prioridad 2, y pide confirmar. Se registra en `pasos_en_tareas`; el paso queda marcado "En Tareas" con enlace. Los pasos conservan su `id` entre versiones, así que la marca se mantiene al editar.

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
| `GET/POST /api/nova/materias`, `GET/PATCH/DELETE /api/nova/materias/[id]` | Materias (con cortes y actividades) | E12 |
| `PUT /api/nova/materias/[id]/cortes` | Cortes (en bloque, para validar la suma) | E12 |
| `POST /api/nova/cortes/[id]/actividades`, `PATCH/DELETE /api/nova/actividades/[id]` | Actividades | E12 |
| `GET/POST /api/nova/metas`, `DELETE /api/nova/metas/[id]` | Metas semanales | E15 |
| `PUT/DELETE /api/nova/metas-nota` | Metas de nota | E16 |
| `GET/POST /api/nova/cortes/[id]/temas`, `POST /api/nova/cortes/[id]/temas/proponer`, `PATCH/DELETE /api/nova/temas/[id]` | Temas | E17 |
| `GET /api/nova/cortes/[id]/plan`, `POST .../plan/generar`, `POST .../plan/versiones` (manual), `POST .../plan/restaurar` | Plan y versiones | E18 |
| `POST /api/nova/planes/[id]/pasos/[pasoId]/tarea` | Pasar a Tareas | E19 |
| `GET /api/nova/estadisticas` | Datos de Estadísticas | E20 |

Las rutas que llaman a Gemini declaran `maxDuration = 60`.

## 11. Pruebas

### 11.1 Automáticas (Vitest)

- **Reglas puras**: casos S-01 en adelante en cada etapa. Mínimos obligatorios:
  - S-01 a S-06 (redondeo y aprobar): 2,96 truncar → 2,9, no aprueba con 3,0; 2,95 redondear → 3,0, aprueba; 3,04 truncar → 3,0, aprueba; 2,94 redondear → 2,9; 5,0 → 5,0; 0 → 0,0.
  - S-07 a S-12 (cortes y materia): corte con 2 de 3 actividades calificadas; materia sin notas; materia completa (definitiva); proyectada con pesos distintos; acumulada exacta sin error de coma flotante (por ejemplo 0,1 + 0,2).
  - S-13 a S-18 ("¿Cuánto necesito?"): ya asegurado; necesario 3,4; imposible con máximo alcanzable; W = 0; truncar frente a redondear con el mismo dato (el umbral cambia en 0,05); resultado redondeado hacia arriba.
  - S-19 a S-21 (promedio por créditos), S-22 a S-24 (fallas), S-25 a S-28 (metas semanales, semana de Bogotá en el borde del domingo a medianoche).
  - S-29 a S-32 (validación del plan: tema no confirmado, fuente inventada, fecha fuera de rango, plan válido).
- **Contraste**: una prueba lee los tokens de `globals.css` y comprueba ≥ 4,5:1 en cada par texto/fondo, en ambos modos, y para los 8 colores de categoría.
- **Servidor**: cada ruta nueva prueba 401/403, aislamiento (un id de otro usuario responde como inexistente), validación y contrato.
- **Editar tareas** (E09): cada validación de crear repetida al editar con su mensaje exacto, tarea completada → `TAREA_YA_COMPLETADA`, tarea de otro usuario → `TAREA_NO_ENCONTRADA`, y que estado, minutos y fecha de cierre no cambian.
- **Interfaz**: navegación (ítem activo, hoja "Más" con Escape y foco, botón "+"), Inicio (completar abre el diálogo de minutos), pestañas de Tareas, formularios de Semestre con los mensajes exactos.

### 11.2 Scripts reales

- `npm run probar:rag` y `npm run db:verificar` en cada etapa que toque datos (este último se amplía con las tablas nuevas, su RLS y sus restricciones).
- `npm run probar:semestre` (nuevo, E13): crea una materia de prueba completa en la base real, comprueba los cálculos contra valores hechos a mano y borra lo que creó.
- `npm run probar:plan` (nuevo, E18): con Gemini real, propone temas desde un PDF de prueba y genera un plan; comprueba que pasa la validación y borra lo que creó.

### 11.3 Compatibilidad con `master` (después de cada migración)

Con un `git worktree` de `master` en una carpeta temporal: `npm run probar:rag` y `npm run db:verificar` **del código de master** contra la base ya migrada. Deben dar 0 fallas. Así se demuestra que producción sigue creando, completando y eliminando tareas, e indexando y consultando documentos.

### 11.4 Navegador y teléfono

En cada etapa con interfaz: navegador real a 1280 px y 390 px (sin desplazamiento horizontal, sin errores de página, foco visible) y prueba del usuario en la **vista previa de Vercel** desde su teléfono.

## 12. Casos de aceptación B-01 a B-42

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
| B-15 | Calendario: con un corte y una actividad con fecha | Aparecen en su día con su ícono y enlazan a la materia |
| B-16 | Tareas: pestañas Todas, Hoy, Importantes, Completadas | Cada una filtra como dice; la pestaña queda en la URL |
| B-17 | Tareas: agrupación | Grupos por categoría con color y contador completadas/total |
| B-18 | Configuración: crear, renombrar, recolorear y eliminar una categoría | Se refleja en Tareas, Inicio y Calendario; eliminar pasa sus tareas a General; nombre repetido → RB-02 |
| B-19 | Fuentes: las dos pestañas | Subir PDF e índice funcionan como A-06 a A-08 y A-21; Buscar en la web como A-18 |
| B-20 | Abrir `/nova/documentos` y `/nova/web` | Redirigen a Fuentes en la pestaña correcta |
| B-21 | Subir un PDF con una materia como categoría | La lista muestra la materia |
| B-22 | Configuración: cambiar el nombre y la contraseña | Se guarda; la contraseña nueva sirve para entrar |
| B-23 | Configuración: borrar el historial del asistente | Pide confirmación (RB-25) y el chat queda vacío |
| B-24 | Crear una materia | Nace con Corte 1 30 %, Corte 2 30 %, Corte 3 40 % (o los cortes por defecto configurados) y su categoría |
| B-25 | Cortes que suman 90 % | Rechazo con RB-07 |
| B-26 | Actividades de un corte que pasan de 100 % | Rechazo con RB-08 |
| B-27 | Nota 5,5 | Rechazo con RB-09 |
| B-28 | Materia con notas parciales (caso hecho a mano) | Nota de cada corte, acumulada y proyectada coinciden con el cálculo a mano |
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
| Tamaño de la ampliación | 22 etapas pequeñas, cada una con su commit y su prueba; se puede parar en cualquier etapa con todo funcionando |
