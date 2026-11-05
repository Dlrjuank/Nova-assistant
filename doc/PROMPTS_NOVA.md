# Nova Assistant · Prompts para GitHub Copilot

> Plan de referencia: `doc/PLAN_NOVA.md`
> Herramienta: GitHub Copilot Chat en modo Agente (VS Code)
> Punto de partida: proyecto desplegado en Vercel, Supabase conectado y login funcionando

---

## Antes de empezar: claves necesarias

Este proyecto usa servicios externos. Antes de P01 hay que tener:

1. **Clave de Gemini** (Google AI Studio, gratuita): se guarda como `GEMINI_API_KEY` en `.env.local` y en Vercel. Sin ella, la indexación y el chat no funcionan.
2. **Token de Vercel Blob**: en el proyecto de Vercel, pestaña Storage, crear un Blob store; Vercel agrega `BLOB_READ_WRITE_TOKEN`. Para local, copiarlo a `.env.local`.
3. **pgvector en Supabase**: la migración P01 lo habilita con `CREATE EXTENSION`; si el plan de Supabase no lo permitiera, se activa desde Database, Extensions.

La clave de Gemini nunca va en el código ni en el repositorio.

## Cómo ejecutar estos prompts

1. Crear la carpeta `doc/` en la raíz del repositorio (si no existe) y copiar allí `PLAN_NOVA.md` y `PROMPTS_NOVA.md`.
2. Abrir el proyecto en VS Code y abrir Copilot Chat. En el selector de modo elegir **Agent**. En el selector de modelo elegir el más capaz disponible.
3. Cada prompt se ejecuta en una **conversación nueva** (botón `+` del chat).
4. Copiar el bloque gris completo del prompt, pegarlo en el chat y enviarlo. No hay datos que reemplazar.
5. Cuando Copilot pida permiso para ejecutar un comando en la terminal, leerlo y aceptarlo.
6. Al terminar cada prompt: revisar los cambios y aceptarlos (**Keep**); hacer la verificación indicada; hacer commit con el mensaje sugerido y `git push`. Vercel desplegará; si falla, usar el prompt de despliegue fallido antes de continuar.
7. No saltar prompts. Si algo falla, usar el prompt de corrección del final.

| Fase | Prompts |
|---|---|
| 0 · Preparación | P00 |
| 1 · Base de datos | P01 |
| 2 · Reglas de negocio | P02 |
| 3 · Servidor y LLM | P03 |
| 4 · Datos y API | P04, P05 |
| 5 · Interfaz | P06, P07, P08, P09 |
| 7 · Opcionales | P10, P11 |

---

## P00 · Auditoría del repositorio y archivos de control

**Fase:** 0 · **Modifica código:** no · **Crea:** `doc/ESTADO_ACTUAL.md`, `.github/copilot-instructions.md`, `doc/ESTADO_EJECUCION.md`, `doc/checkpoints/FASE_0_COMPLETADA.md`

````text
Actúa como ingeniero de software senior trabajando en modo agente sobre este repositorio Next.js.

Contexto: el proyecto "Nova Assistant" (asistente personal con IA que responde preguntas sobre los PDF y las tareas del usuario, usando RAG) ya está desplegado en Vercel, conectado a Supabase y tiene login funcionando. El plan técnico está en doc/PLAN_NOVA.md. Este prompt NO implementa funcionalidades: audita el repositorio y crea los archivos de control.

Lee completo doc/PLAN_NOVA.md, en especial las secciones 0, 1, 2, 10 y 18.

TAREA 1. Crea doc/ESTADO_ACTUAL.md con estas secciones, llenas con lo que encuentres. No supongas: si algo no existe, escribe "No existe".
1. Versiones (package.json): next, react, typescript, tailwindcss, pg, zod, @supabase/supabase-js, jose, bcryptjs, vitest, @vercel/blob, unpdf o pdf-parse, @google/generative-ai (o el SDK de Gemini).
2. Scripts de package.json.
3. Estructura: árbol de app/, lib/, components/, supabase/ y scripts/ hasta 3 niveles. Indica si usa carpeta src/.
4. Alias de importación en tsconfig.json.
5. Autenticación: archivos; mecanismo; nombre de la cookie; función que lee la sesión y qué devuelve; ruta de la página de login; ruta a la que redirige después del login (archivo y línea); archivo de middleware o proxy y su matcher; cómo se cierra sesión.
6. Acceso a datos: clientes de Supabase existentes, uso del paquete pg, archivo de pool si existe.
7. Migraciones: carpeta, archivos existentes y su numeración, tabla de control, script o página que las aplica.
8. Variables de entorno: solo los NOMBRES presentes en .env.local y .env.example (NUNCA copies valores). Indica si existen: una cadena de conexión directa a Postgres (DATABASE_URL o similar) y con qué nombre; BLOB_READ_WRITE_TOKEN; una clave de Gemini (GEMINI_API_KEY o similar) y con qué nombre.
9. Estilos: versión de Tailwind, ubicación de globals.css, fuentes, tokens de color existentes, librería de íconos.
10. Pruebas: framework existente.
11. Conflictos con el plan: existencia previa de app/nova, app/api/nova, lib/dataService.ts y components/ui; contenido de app/page.tsx (plantilla de Next.js o propio); tablas existentes llamadas tareas_personales, documentos, fragmentos_pdf o fuentes_web.
12. Capacidad de pgvector: si puedes, consulta en Supabase si la extensión "vector" está disponible (SELECT * FROM pg_available_extensions WHERE name = 'vector'); indica si está disponible y si ya está instalada.
13. Decisiones derivadas:
    - Ruta de la página de login.
    - Archivo de protección de rutas (proxy.ts en Next.js 16, middleware.ts antes) y si ya existe.
    - Mecanismo de migraciones a usar.
    - Nombre de la variable de conexión a Postgres que usará conexion.ts.
    - Nombre de la variable de la clave de Gemini.
    - Librería de extracción de PDF a usar (unpdf preferida; pdf-parse si ya está).
    - Nombres exactos que tendrán M1 y M2 continuando la numeración existente.
    - Prefijo de imports para lib.
14. Compilación de base: resultado de npm run build (TAREA 4).

TAREA 2. Crea .github/copilot-instructions.md reemplazando [AJUSTAR] con lo hallado:

```markdown
# Nova Assistant · Instrucciones para Copilot

## Documentos rectores
- Plan técnico: doc/PLAN_NOVA.md. Si una instrucción contradice el plan, prevalece el plan.
- Estado real del repositorio: doc/ESTADO_ACTUAL.md.
- Avance: doc/ESTADO_EJECUCION.md. Se actualiza al final de cada tarea.

## Stack
- Next.js App Router + TypeScript + Tailwind CSS. Despliegue en Vercel.
- Postgres de Supabase con pgvector, el paquete pg y la variable [AJUSTAR: variable de conexión].
- Embeddings y chat con la API de Gemini (clave en [AJUSTAR: variable de Gemini]).
- PDF de hasta 15 MB subidos a Vercel Blob (BLOB_READ_WRITE_TOKEN); extracción de texto con [AJUSTAR: unpdf o pdf-parse].
- Validación con Zod. Pruebas con Vitest.
- Login existente: [AJUSTAR]. No se reescribe. Puerta única, sin roles.

## Convenciones
- Identificadores, comentarios, mensajes y textos de interfaz en español.
- Los mensajes exactos de la sección 5.1 del plan se usan textualmente.
- Reglas puras en lib/reglas/: funciones puras, sin pg, sin red, sin variables de entorno y sin reloj (excepto fechas.ts). Se prueban con Vitest.
- Solo lib/llm/ conoce a Gemini; el resto usa su interfaz LLMClient. La clave se lee de variable de entorno, nunca en el código.
- Solo lib/datos/ importa lib/db/conexion.ts. Rutas y páginas importan datos únicamente desde lib/dataService.ts.
- Toda ruta en app/api/nova/ llama await exigirSesion() como primera instrucción.
- El PDF se sube a Vercel Blob desde el navegador; la ruta de indexación recibe la URL, no el archivo. El tamaño se valida también en el servidor sobre el archivo real (RN-01).
- Las rutas que llaman a Gemini declaran export const maxDuration holgado.
- Vectores: columna vector(768); a SQL van como literal '[...]' casteado con ::vector; recuperación con el operador <=> (coseno).
- Entradas validadas con los esquemas de lib/validacion/esquemas.ts.
- Errores de negocio con ErrorDeNegocio(codigo); respuestas con lib/http/respuestas.ts.
- Fechas 'YYYY-MM-DD' como texto entre capas. Zona horaria America/Bogota; "hoy" solo con hoyBogota().
- En rutas dinámicas params es una Promise: const { id } = await params.
- SQL siempre con parámetros ($1, $2). Nunca concatenar valores.
- Las tareas y los documentos no se editan ni se borran (salvo la transición opcional a Completada).
- No instalar librerías de componentes (shadcn, MUI u otras). Usar components/ui/.
- Prefijo de imports para lib: [AJUSTAR].
- Archivo de protección de rutas: [AJUSTAR]. Ruta de login: [AJUSTAR].

## Al terminar cada tarea
1. npm run build sin errores.
2. npm test sin fallas (desde que exista Vitest).
3. Actualizar doc/ESTADO_EJECUCION.md.
4. No hacer commit: el estudiante revisa y hace el commit.
```

TAREA 3. Crea doc/ESTADO_EJECUCION.md:

```markdown
# Estado de ejecución · Nova Assistant

| Prompt | Estado | Build | Tests | Fecha de cierre |
|---|---|---|---|---|
| P00 Auditoría | pendiente | | | |
| P01 Base de datos (pgvector) | pendiente | | | |
| P02 Reglas de negocio | pendiente | | | |
| P03 Servidor y cliente LLM | pendiente | | | |
| P04 Datos: tareas, documentos, consulta | pendiente | | | |
| P05 API | pendiente | | | |
| P06 Interfaz base y tareas | pendiente | | | |
| P07 Documentos (subida e indexación) | pendiente | | | |
| P08 Chat del asistente | pendiente | | | |
| P09 Aceptación del MVP | pendiente | | | |
| P10 Opcionales: completar tarea e índice | pendiente | | | |
| P11 Opcional: búsqueda en Wikipedia | pendiente | | | |

## Bitácora

Cada prompt agrega una sección con: archivos creados, archivos modificados, comandos ejecutados y su resultado, problemas y cómo se resolvieron, pendientes.
```

TAREA 4. Si no existe node_modules, ejecuta npm install. Luego npm run build y registra el resultado en la sección 14 de ESTADO_ACTUAL.md. Si falla, NO corrijas: describe el error.

TAREA 5. Revisa qué claves faltan (sección 8) y explícame, en lenguaje sencillo:
- Cómo obtener la clave de Gemini en Google AI Studio y agregarla como GEMINI_API_KEY (o el nombre que ya exista) a .env.local y a Vercel.
- Cómo crear un Blob store en Vercel (Storage) para tener BLOB_READ_WRITE_TOKEN, y copiarlo a .env.local.
- Si falta la variable de conexión a Postgres, cómo obtenerla en Supabase (Connect, Transaction pooler, puerto 6543).
No continuar con P01 hasta tener la conexión a Postgres y la clave de Gemini.

RESTRICCIONES: no modifiques código, configuración ni dependencias. Solo crea los archivos de este prompt.

AL TERMINAR:
- Crea doc/checkpoints/FASE_0_COMPLETADA.md con: resultado de la compilación, qué claves existen y cuáles faltan, disponibilidad de pgvector, decisiones derivadas.
- Marca P00 en ESTADO_EJECUCION.md y agrega su sección en la bitácora.
- Muéstrame un resumen y los riesgos para los siguientes prompts.
````

**Verificación del estudiante:** abrir `doc/ESTADO_ACTUAL.md` y confirmar que la sección 8 dice si existen la clave de Gemini, el token de Blob y la conexión a Postgres, y que la 12 confirma que pgvector está disponible. Conseguir lo que falte antes de P01.

**Commit sugerido:** `docs: auditoría del repositorio y archivos de control para Copilot`

---

## P01 · Base de datos con pgvector

**Fase:** 1 · **Crea:** dos migraciones, `scripts/verificar-bd.mjs` y, si hace falta, `scripts/migrar.mjs`

````text
Antes de escribir código lee completos: doc/PLAN_NOVA.md (secciones 2.1, 6, 8 y 16), doc/ESTADO_ACTUAL.md y doc/ESTADO_EJECUCION.md.

OBJETIVO: habilitar pgvector, crear y aplicar las dos migraciones, y dejar un script que demuestre que la base protege las reglas y que la búsqueda vectorial funciona.

TAREA 1. Si ESTADO_ACTUAL.md reporta tablas previas con esos nombres que NO correspondan a este plan, detente y avísame. Si no hay conflicto, crea en supabase/migrations/ dos archivos con los nombres de la sección 13 de ESTADO_ACTUAL.md:
- Migración M1 (extensión y tablas) con el SQL exacto de la sección 8.2 del plan (incluye CREATE EXTENSION IF NOT EXISTS vector y la columna vector(768)).
- Migración M2 (índice vectorial, función buscar_fragmentos y seguridad) con el SQL exacto de la sección 8.3.
No cambies nombres de tablas, columnas, la dimensión 768, ni la función: el código posterior depende de ellos (secciones 8.4 y 2.1).

TAREA 2. Aplica las migraciones con el mecanismo existente o, si no hay, creando scripts/migrar.mjs (lee la variable de conexión indicada; ssl { rejectUnauthorized: false }; tabla _migrations; aplica en orden alfabético los archivos no registrados en una transacción; imprime "aplicada"/"omitida"; código 1 si falla) y el script "db:migrar". Si la primera migración falla porque la extensión vector no se puede crear, detente y avísame que hay que habilitarla desde Supabase (Database, Extensions) antes de seguir.

TAREA 3. Crea scripts/verificar-bd.mjs y "db:verificar". Debe imprimir:
1. Si la extensión vector está instalada (SELECT * FROM pg_extension WHERE extname='vector').
2. Existencia de tareas_personales, documentos, fragmentos_pdf, fuentes_web y de la función buscar_fragmentos.
3. Número de filas de cada tabla.
4. Restricciones de tareas_personales (pg_constraint) y el índice idx_fragmentos_vector.
5. Si RLS está activo en las cuatro tablas.
6. Pruebas de integridad en UNA transacción que SIEMPRE termina en ROLLBACK, con SAVEPOINT antes de cada caso que debe fallar:
   a) Insertar tarea válida (titulo "Verif", fecha_limite hoy, fecha_creacion hoy): funciona, estado 'Pendiente' por defecto.
   b) Insertar tarea con prioridad 5: debe fallar con 23514 (RN-04).
   c) Insertar tarea con prioridad 0: debe fallar con 23514.
   d) Insertar tarea con estado 'Completada' sin fecha_cierre: debe fallar con 23514 (coherencia).
   e) Insertar un documento y dos fragmentos con vectores de prueba de 768 dimensiones (puedes generar un arreglo de 768 ceros con un 1 en posiciones distintas); comprobar que se insertan.
   f) Llamar SELECT * FROM buscar_fragmentos(<vector de prueba>, 4) y comprobar que devuelve filas ordenadas por distancia ascendente.
   g) Insertar un fragmento con el mismo documento_id y numero que otro: debe fallar con 23505 (fragmentos_unico_por_doc).
   Imprime "OK" o "FALLA" por caso. Para construir el literal del vector de 768 dims, arma la cadena '[0,0,...,1,...]'.
7. Total de fallas; termina con código 1 si hubo alguna.

Ejecuta npm run db:verificar y copia la salida en la bitácora.

RESTRICCIONES: no modifiques archivos del login ni de app/. No crees tablas distintas a las del plan.

AL TERMINAR:
- npm run build sin errores.
- Crea doc/checkpoints/FASE_1_COMPLETADA.md con la salida de npm run db:verificar.
- Marca P01 en ESTADO_EJECUCION.md y agrega su sección en la bitácora.
- Muéstrame un resumen.
````

**Verificación del estudiante:** en Supabase, Table Editor, deben aparecer las cuatro tablas; en Database, Extensions, `vector` debe estar activa. La salida de `npm run db:verificar` no debe tener FALLA, y el caso f debe devolver fragmentos ordenados por distancia.

**Commit sugerido:** `feat(bd): pgvector, tablas y función de búsqueda vectorial`

---

## P02 · Reglas de negocio y pruebas unitarias

**Fase:** 2 · **Crea:** `lib/config/nova.ts`, `lib/reglas/*`, `tests/reglas/*`, `vitest.config.ts`, `scripts/probar-reglas.ts`

````text
Antes de escribir código lee completos: doc/PLAN_NOVA.md (secciones 5, 5.1, 9, 10.3, 10.4, 10.5, 12.2, 15 y 17.1), doc/ESTADO_ACTUAL.md y doc/ESTADO_EJECUCION.md.

OBJETIVO: implementar las reglas puras y probarlas con Vitest. Son el corazón verificable del proyecto: validación de tareas, consultas y documentos, fragmentación y el índice de productividad.

TAREA 1. Instala vitest (desarrollo). Agrega "test": "vitest run" y "test:ver": "vitest". Crea vitest.config.ts con environment 'node', include ['tests/**/*.test.ts'] y el alias '@' de tsconfig.json.

TAREA 2. Crea lib/config/nova.ts con el contenido exacto de la sección 10.4.

TAREA 3. Crea lib/reglas/ con las firmas exactas de la sección 10.5:
- errores.ts: CodigoError; MENSAJES y ESTADO_HTTP con la tabla 12.2 (usando LOS TEXTOS EXACTOS de la sección 5.1 donde apliquen: prioridad, PDF grande, PDF sin texto, consulta corta); clase ErrorDeNegocio.
- fechas.ts: hoyBogota; esFechaISOValida (formato YYYY-MM-DD estricto y fecha real; rechaza "2026-02-30" y "03-10-2026").
- tarea.ts: normalizarTitulo; resolverPrioridad (null/undefined → PRIORIDAD_POR_DEFECTO; fuera de 1..3 → PRIORIDAD_INVALIDA con el texto exacto); validarTarea (recorta título, vacío → DATOS_INVALIDOS; fecha con esFechaISOValida → FECHA_INVALIDA; prioridad con resolverPrioridad; devuelve { titulo, prioridad }).
- consulta.ts: normalizarConsulta (recorta y colapsa espacios a uno); contarPalabrasYCaracteres (sobre el texto normalizado; los espacios cuentan como caracteres); validarConsulta (≥ CONSULTA_MIN_PALABRAS y ≥ CONSULTA_MIN_CARACTERES; si no, CONSULTA_MUY_CORTA con el texto exacto); mencionaTareas (true si el texto en minúsculas contiene alguna de NIVELES_PALABRAS_CLAVE_TAREAS).
- documento.ts: validarTamanoPdf (> PDF_MAX_BYTES → ARCHIVO_MUY_GRANDE con el texto exacto); validarTextoExtraido (vacío o solo espacios → PDF_SIN_TEXTO con el texto exacto).
- fragmentacion.ts: fragmentar(texto) EXACTAMENTE como la sección 9.2: colapsa espacios, separa en palabras, trozos de FRAGMENTO_PALABRAS con FRAGMENTO_SOLAPAMIENTO de solapamiento (el siguiente empieza FRAGMENTO_PALABRAS - FRAGMENTO_SOLAPAMIENTO palabras después del inicio del anterior), numerados desde 1, el último puede ser más corto.
- productividad.ts: NivelProductividad; calcularIndice({ completadas, totales, minutos }) según la sección 9.1 (puntos = completadas/totales*70 + min(minutos,120)*0.25; redondeo HACIA ABAJO a un decimal con Math.floor(x*10)/10; niveles <50 Bajo, 50..79.9 Aceptable, >=80 Excelente). No maneja totales=0 (el servicio corta antes).

Ninguna regla importa pg, red, next ni process.env, ni llama new Date() (excepto el parámetro por defecto de hoyBogota).

TAREA 4. Crea tests/reglas/ayudas.ts con esperarCodigo(fn, codigo).

TAREA 5. Crea las pruebas en tests/reglas/ cubriendo T-01 a T-28 de la sección 17.1. Cada caso con su ID. Para T-21 y T-23, verifica el número de fragmentos y que el fragmento 2 empieza 50 palabras antes del fin del 1. Para T-24 y T-25, comprueba los valores exactos del plan (86.0 Excelente; 49.5 Bajo). Para T-27, construye una entrada que dé un bruto entre 79.9 y 80.0 y comprueba que queda en 79.9 Aceptable.

TAREA 6. Crea scripts/probar-reglas.ts con "probar:reglas" que ejecute un resumen de los casos principales e imprima OK/FALLA (humo rápido sin base de datos). Puede reusar las funciones de reglas directamente.

TAREA 7. Ejecuta npm test hasta que pasen las 28. Si una falla, corrige la regla, no la prueba, salvo que contradiga el plan; explícalo.

RESTRICCIONES: no toques app/, el login ni la base de datos.

AL TERMINAR:
- npm run build y npm test sin errores.
- Crea doc/checkpoints/FASE_2_COMPLETADA.md con la salida resumida de npm test.
- Marca P02 en ESTADO_EJECUCION.md y agrega su sección en la bitácora.
- Muéstrame un resumen.
````

**Verificación del estudiante:** `npm test` (28 pruebas). Abrir `lib/reglas/fragmentacion.ts` y comprobar el solapamiento; abrir `lib/reglas/productividad.ts` y ver el redondeo hacia abajo.

**Commit sugerido:** `feat(reglas): validaciones, fragmentación e índice con 28 pruebas`

---

## P03 · Servidor, sesión, cliente de Gemini y extracción de PDF

**Fase:** 3 · **Crea:** conexión, sesión, respuestas, esquemas, formato, cliente LLM, extractor de PDF y `/api/nova/sesion` · **Modifica:** protección de rutas y redirección del login

````text
Antes de escribir código lee completos: doc/PLAN_NOVA.md (secciones 1.3, 2, 8.4, 10.1, 10.3, 10.7, 11, 12.1, 12.2, 15 y 16), doc/ESTADO_ACTUAL.md (secciones 5, 8, 13) y doc/ESTADO_EJECUCION.md.

OBJETIVO: dejar lista la infraestructura: conexión a Postgres con soporte de vectores, sesión, formato, esquemas, el cliente de Gemini aislado y la extracción de texto de PDF.

TAREA 1. lib/db/conexion.ts como la sección 10.7, incluyendo la función aLiteralVector(v) que convierte un arreglo de números en '[...]' para castear a ::vector en las consultas. Usa el nombre real de la variable de conexión. Si ya hay pool, reutilízalo.

TAREA 2. lib/auth/sesion.ts: obtenerSesion() (del login; devuelve { email } o null) y exigirSesion() (lanza NO_AUTORIZADO si no hay). Solo importa funciones del login.

TAREA 3. Protección de rutas en el archivo indicado: agrega /nova/:path* y /api/nova/:path* al matcher, conservando lo existente. Sin sesión: páginas redirigen al login; /api/nova responde 401. Si no es posible en ese archivo, protege en el layout de /nova (P06) y en exigirSesion(), y anótalo.

TAREA 4. Cambia SOLO el destino de la redirección posterior al login a /nova.

TAREA 5. lib/http/respuestas.ts: responderOk; responderError (ErrorDeNegocio → ESTADO_HTTP; ZodError → 400 DATOS_INVALIDOS con flatten; pg 23514/23505 → tabla 8.4; otro → console.error y 500 ERROR_INTERNO); conManejoDeErrores; leerCuerpo. Todas con Cache-Control: no-store.

TAREA 6. lib/validacion/esquemas.ts con los esquemas de la sección 12.4, con tipos z.infer. La validación fina (prioridad 1..3, fecha real, 2 palabras/8 caracteres) la hacen las reglas de lib/reglas para devolver los mensajes exactos; los esquemas solo validan forma y tipos. No importa nada del servidor.

TAREA 7. lib/formato.ts: formatearFecha (Intl es-CO, dateStyle medium, timeZone UTC); formatearPrioridad (1 Baja, 2 Media, 3 Alta); formatearMinutos.

TAREA 8. lib/llm/gemini.ts y lib/llm/prompts.ts:
- Instala el SDK de Gemini si falta (el que indique ESTADO_ACTUAL.md o @google/generative-ai).
- Implementa el objeto llm que cumple la interfaz LLMClient de la sección 11: generarEmbedding(texto) → number[] de EMBEDDING_DIMENSIONES usando MODELO_EMBEDDING; generarEmbeddings(textos) → number[][] por lotes o en serie con concurrencia baja; responder({ sistema, contexto, pregunta }) → string usando MODELO_CHAT.
- La clave se lee de la variable indicada en ESTADO_ACTUAL.md. Si falta, las funciones lanzan ErrorDeNegocio('ERROR_LLM') con un mensaje claro y lo registran en consola.
- prompts.ts: SYSTEM_PROMPT (responder solo con el contexto; si no está, decir exactamente "No encontré esto en tus documentos"; no inventar; citar fuentes por su etiqueta) y construirContexto(fragmentos, tareas) que numera y etiqueta cada fuente.

TAREA 9. lib/pdf/extraer.ts: extraerTexto(buffer) usando la librería indicada (unpdf o pdf-parse) que recibe el contenido del PDF y devuelve el texto plano. No valida tamaño ni vacío (eso lo hacen las reglas); solo extrae.

TAREA 10. app/api/nova/sesion/route.ts: GET con conManejoDeErrores; primera instrucción await exigirSesion(); responde { email }. export const dynamic = 'force-dynamic'.

VERIFICACIÓN: npm run build y npm test. Escribe un pequeño script temporal o una prueba que llame a llm.generarEmbedding("hola mundo") y confirme que devuelve un arreglo de 768 números (requiere la clave de Gemini); si no tienes la clave en local, pídeme ejecutarlo y repórtame. Inicia npm run dev; sin sesión, GET /api/nova/sesion da 401; con sesión, 200. Comprueba que el login redirige a /nova.

AL TERMINAR:
- Crea doc/checkpoints/FASE_3_COMPLETADA.md con los resultados (incluida la dimensión del embedding si se pudo probar).
- Marca P03 en ESTADO_EJECUCION.md y agrega su sección en la bitácora.
- Muéstrame un resumen.
````

**Verificación del estudiante:** `/api/nova/sesion` da 401 sin sesión y 200 con sesión. Si hay clave de Gemini, confirmar que un embedding de prueba tiene 768 dimensiones (coincide con la columna de la base).

**Commit sugerido:** `feat(servidor): conexión con vectores, sesión, cliente Gemini y extractor de PDF`

---

## P04 · Datos: tareas, documentos y consulta RAG

**Fase:** 4 (primera parte) · **Crea:** `lib/datos/*`, `lib/dataService.ts`, `scripts/limpiar-prueba.mjs`, `scripts/probar-rag.ts`

````text
Antes de escribir código lee completos: doc/PLAN_NOVA.md (secciones 5, 6, 7, 7.1, 8, 10.5, 10.6, 11 y 17.2), doc/ESTADO_ACTUAL.md y doc/ESTADO_EJECUCION.md. Revisa lib/reglas/, lib/llm/, lib/pdf/, lib/db/conexion.ts y lib/validacion/esquemas.ts.

OBJETIVO: implementar el acceso a datos y los casos de uso del MVP, incluido el flujo RAG completo, y probarlo contra la base y Gemini.

TAREA 1. lib/datos/tipos.ts con los tipos de la sección 10.6 (DatosTarea, Tarea, Documento, Fragmento, RespuestaAsistente, Fuente, y para opcionales ResultadoProductividad, ResultadoWeb). Reutiliza los tipos de lib/reglas.

TAREA 2. lib/datos/tareas.ts:
- crearTarea(d): validarTarea; inserta con estado 'Pendiente', categoria (o CATEGORIA_POR_DEFECTO), prioridad resuelta, fecha_creacion = hoyBogota(). Devuelve la Tarea.
- listarTareas({ estado, fecha }): filtra por estado y/o fecha_limite; orden por fecha_limite.
- tareasPendientesComoTexto(): devuelve las tareas en estado 'Pendiente' como una lista de { id, texto } legible para el contexto (título, categoría, prioridad, fecha límite).
- completarTarea(id, minutos): se implementa en P10 (déjala preparada o con un throw claro).

TAREA 3. lib/datos/documentos.ts:
- emitirTokenSubida(nombreArchivo): usa el flujo de subida client-side de Vercel Blob (@vercel/blob/client handleUpload en el servidor) para emitir el token; restringe a PDF. Devuelve lo que el cliente necesita.
- indexarDocumento({ urlBlob, nombreArchivo, categoria }): descarga el Blob (fetch de la urlBlob en el servidor); valida el tamaño real con validarTamanoPdf (RN-01); extrae el texto con lib/pdf/extraer.ts; validarTextoExtraido (PDF_SIN_TEXTO); fragmenta con fragmentar; genera embeddings con llm.generarEmbeddings; en una transacción inserta el documento y sus fragmentos (cada vector con aLiteralVector y ::vector) y actualiza num_fragmentos. Devuelve { documentoId, numFragmentos }.
- listarDocumentos(): documentos con su num_fragmentos y fecha.
- existenDocumentos(): boolean (COUNT > 0 en documentos con fragmentos).

TAREA 4. lib/datos/fragmentos.ts: recuperarFragmentos(vectorConsulta, limite): llama a la función SQL buscar_fragmentos($1::vector, $2) y devuelve los fragmentos con nombre de archivo, número y distancia.

TAREA 5. lib/datos/consulta.ts: consultar(pregunta) EXACTAMENTE como la sección 7.1 (validarConsulta; si no existenDocumentos → SIN_DOCUMENTOS; embedding de la pregunta; recuperarFragmentos(…, FRAGMENTOS_RECUPERADOS); si mencionaTareas, agregar tareasPendientesComoTexto; construirContexto; llm.responder; devolver RespuestaAsistente con respuesta y fuentes etiquetadas). Las fuentes de PDF se etiquetan "nombre.pdf · fragmento N"; las de tarea, "Tarea <id corto>".

TAREA 6. lib/datos/productividad.ts y lib/datos/wikipedia.ts: créalos preparados para P10 y P11 (con throw claro o sin exportar aún). No se usan en el MVP.

TAREA 7. lib/dataService.ts como fachada: reexporta las funciones públicas del MVP y los tipos. Verifica que ningún archivo fuera de lib/datos importe lib/db/conexion.ts y que solo lib/llm conozca a Gemini.

TAREA 8. scripts/limpiar-prueba.mjs con "db:limpiar": borra tareas cuyo título empiece por 'Prueba' y documentos cuyo nombre empiece por 'prueba' con sus fragmentos (ON DELETE CASCADE). Imprime el conteo.

TAREA 9. Crea un PDF de prueba con texto en el repo (por ejemplo scripts/fixtures/prueba.pdf) o genéralo en el script; debe tener varias frases en español con un dato concreto reconocible (por ejemplo "La garantía del producto es de 24 meses"). Crea scripts/probar-rag.ts con "probar:rag" (requiere clave de Gemini y base) con los pasos de la sección 17.2: crear tareas (válida, prioridad 7 → error, fecha inválida → error), indexar el PDF de prueba subiéndolo primero a Blob o pasando el buffer directamente a una variante interna de indexación para pruebas, consultar "info" (corta → error), consultar por el dato del PDF (responde y cita el pdf), consultar por tareas pendientes (cita la tarea), consultar algo ausente ("No encontré esto en tus documentos"), y en base sin documentos SIN_DOCUMENTOS. Imprime OK/FALLA por paso; limpia al final; código 1 si hay fallas. Si subir a Blob desde el script es complejo, permite que indexarDocumento acepte, solo para pruebas, un buffer local además de una urlBlob, y documenta ese atajo.

Ejecuta npm run probar:rag (si tienes la clave) y corrige hasta 0 fallas. Si no tienes la clave en local, pídeme ejecutarlo y repórtame.

AL TERMINAR:
- npm run build y npm test sin errores.
- Marca P04 en ESTADO_EJECUCION.md y agrega la salida de probar:rag en la bitácora. La fase 4 sigue abierta hasta P05.
- Muéstrame un resumen.
````

**Verificación del estudiante:** ejecutar `npm run probar:rag` (con la clave de Gemini): el paso que pregunta por el dato del PDF debe responderlo y citar el archivo; el que pregunta algo ausente debe decir "No encontré esto en tus documentos".

**Commit sugerido:** `feat(datos): tareas, indexación de PDF y consulta RAG con prueba`

---

## P05 · API

**Fase:** 4 (cierre) · **Crea:** rutas de `app/api/nova/`

````text
Antes de escribir código lee completos: doc/PLAN_NOVA.md (secciones 2.2, 12.1 a 12.4), doc/ESTADO_EJECUCION.md, lib/dataService.ts, lib/http/respuestas.ts, lib/validacion/esquemas.ts y lib/auth/sesion.ts.

OBJETIVO: exponer las operaciones del MVP, incluida la subida de PDF a Vercel Blob.

TAREA 1. Crea las rutas del MVP de la tabla 12.3 (deja productividad y web para P10/P11):
- GET /api/nova/sesion ya existe.
- GET y POST /api/nova/tareas.
- GET /api/nova/documentos.
- POST /api/nova/documentos/subida: implementa el handler de subida client-side de Vercel Blob (handleUpload), restringiendo a PDF y usando exigirSesion(); este es el endpoint que el navegador usa para subir el archivo directo a Blob.
- POST /api/nova/documentos: recibe { urlBlob, nombreArchivo, categoria } y llama indexarDocumento. Declara export const maxDuration = 60 (o el máximo del plan de Vercel) porque genera embeddings de muchos fragmentos.
- POST /api/nova/consultar: recibe { pregunta } y llama consultar. También con maxDuration holgado.
Reglas de cada handler: primera instrucción await exigirSesion(); conManejoDeErrores; cuerpos con leerCuerpo; export const dynamic = 'force-dynamic'; POST de tareas y documentos responden 201.

TAREA 2. Verificación sin sesión: con npm run dev, GET /api/nova/tareas y POST /api/nova/consultar deben dar 401.

TAREA 3. Verificación con sesión: pídeme que inicie sesión. Prueba POST /api/nova/tareas con prioridad 5 (422, "La prioridad debe ser 1, 2 o 3") y con datos válidos (201). Prueba POST /api/nova/consultar con "Agenda" (422, "La instrucción es demasiado corta"). La prueba de indexación completa desde el navegador se hace en P07. Documenta.

AL TERMINAR:
- npm run build y npm test sin errores.
- Crea doc/checkpoints/FASE_4_COMPLETADA.md con probar:rag (P04) y las verificaciones.
- Marca P05 en ESTADO_EJECUCION.md y agrega su sección en la bitácora.
- Muéstrame un resumen.
````

**Verificación del estudiante:** con sesión, crear una tarea por API y confirmar que prioridad 5 devuelve el mensaje exacto; sin sesión, las rutas dan 401.

**Commit sugerido:** `feat(api): rutas del MVP con subida a Blob y consulta`

---

## P06 · Interfaz base, navegación y tareas

**Fase:** 5 · **Crea:** `components/ui/*`, layout de `/nova`, tareas · **Modifica:** `app/globals.css` y, según el caso, `app/page.tsx`

````text
Antes de escribir código lee completos: doc/PLAN_NOVA.md (secciones 4, 5, 5.1, 13, 14 y 16), doc/ESTADO_ACTUAL.md (secciones 5, 9, 11), doc/ESTADO_EJECUCION.md, lib/dataService.ts y lib/formato.ts.

OBJETIVO: construir los componentes reutilizables, la navegación con el aviso de privacidad y la gestión de tareas.

TAREA 1. Agrega los tokens de color de la sección 14 sin borrar nada existente: con Tailwind 4 en @theme de app/globals.css; con Tailwind 3 en tailwind.config.

TAREA 2. components/ui/: Boton (primario, secundario, peligro, fantasma; prop cargando), Campo, Selector, Tarjeta, Insignia (tono neutro, primario, alta, media, baja, completada), Aviso (info, exito, advertencia, error), EstadoVacio. Foco visible y contraste.

TAREA 3. components/nova/: NavegacionNova (barra con "Nova", enlaces Asistente (/nova), Tareas, Documentos, y Productividad/Web cuando existan; correo del usuario; cerrar sesión; menú móvil); InsigniaPrioridad (Alta/Media/Baja con los colores de la sección 14 y texto); InsigniaEstadoTarea (Pendiente/Completada).

TAREA 4. app/nova/layout.tsx (servidor): obtenerSesion(); sin sesión, redirect al login. Renderiza NavegacionNova, un Aviso de privacidad visible (el texto de la sección 13: las preguntas y los fragmentos se envían al proveedor del asistente; no subir datos sensibles) y el contenido (ancho máximo 1000 px, fondo --color-fondo).

TAREA 5. app/page.tsx: si es la plantilla de Next.js, redirección a /nova; si tiene contenido propio, agrega un enlace a /nova sin borrarlo.

TAREA 6. Tareas: components/nova/FormularioTarea.tsx (cliente) y app/nova/tareas/nueva/page.tsx: título, categoría (por defecto "General"), prioridad (selector 1/2/3, por defecto 2), fecha límite (YYYY-MM-DD, campo de fecha). Validación en vivo con las reglas; los mensajes de error coinciden con la sección 5.1 (prioridad, fecha). POST /api/nova/tareas; al guardar navega a /nova/tareas.

TAREA 7. components/nova/TablaTareas.tsx y app/nova/tareas/page.tsx (servidor): listarTareas; columnas título, categoría, prioridad (InsigniaPrioridad), estado (InsigniaEstadoTarea), fecha límite, fecha de creación; filtro por estado; botón "Registrar tarea"; EstadoVacio. Tablas en tarjetas apiladas bajo 640 px. (La acción "Completar" se agrega en P10.)

VERIFICACIÓN: pídeme que inicie sesión si lo necesitas. Comprueba: el login lleva al asistente (aún vacío); el aviso de privacidad se ve; registrar una tarea; intentar prioridad 5 (mensaje exacto) y fecha 2026-02-30 (rechazo); ver la tarea en la tabla; filtrar por estado. Revisa la navegación en móvil.

AL TERMINAR:
- npm run build y npm test sin errores.
- Marca P06 en ESTADO_EJECUCION.md y agrega su sección en la bitácora.
- Muéstrame un resumen.
````

**Verificación del estudiante:** registrar una tarea; comprobar que prioridad 5 y fecha 2026-02-30 se rechazan con sus mensajes.

**Commit sugerido:** `feat(interfaz): componentes base, navegación y tareas`

---

## P07 · Documentos: subida a Blob e indexación

**Fase:** 5 · **Crea:** subida de PDF con progreso y listado de documentos

````text
Antes de escribir código lee completos: doc/PLAN_NOVA.md (secciones 2.2, 5.1, 6.1, 13 y 16), doc/ESTADO_EJECUCION.md, lib/dataService.ts y los componentes existentes.

OBJETIVO: permitir subir un PDF (hasta 15 MB) a Vercel Blob desde el navegador e indexarlo, mostrando el resultado.

TAREA 1. components/nova/SubidorPdf.tsx (cliente): usa el flujo de subida client-side de Vercel Blob (@vercel/blob/client upload) apuntando a /api/nova/documentos/subida.
- Antes de subir, valida en el navegador que el archivo sea PDF y que no supere PDF_MAX_BYTES (15.728.640); si lo supera, muestra "El documento supera el límite permitido de 15 MB" sin subir.
- Muestra progreso de subida.
- Al terminar la subida a Blob, llama POST /api/nova/documentos con { urlBlob, nombreArchivo, categoria } para indexar.
- Muestra el resultado: "Documento indexado: N fragmentos" o el mensaje de error (PDF_SIN_TEXTO, ARCHIVO_MUY_GRANDE). Campo de categoría (por defecto "General").
- Estado de carga durante la indexación (puede tardar por los embeddings).

TAREA 2. app/nova/documentos/nuevo/page.tsx: encabezado "Indexar PDF", el SubidorPdf y una nota breve de que solo se admiten PDF con texto seleccionable (no escaneados) y el límite de 15 MB.

TAREA 3. components/nova/TablaDocumentos.tsx y app/nova/documentos/page.tsx (servidor): listarDocumentos; columnas nombre, categoría, número de fragmentos, fecha de indexación; botón "Indexar PDF"; EstadoVacio con guía ("Indexa un PDF para poder preguntarle al asistente").

VERIFICACIÓN: pídeme que inicie sesión si lo necesitas. Comprueba con PDF reales: indexar un PDF con texto (muestra el número de fragmentos y aparece en la tabla); intentar un PDF escaneado o sin texto (mensaje PDF_SIN_TEXTO); si tienes uno mayor a 15 MB, intentar subirlo (rechazo en el navegador). Documenta. Si no puedes probar la subida tú mismo, descríbeme los pasos exactos para que yo lo pruebe en el navegador.

AL TERMINAR:
- npm run build y npm test sin errores.
- Marca P07 en ESTADO_EJECUCION.md y agrega su sección en la bitácora.
- Muéstrame un resumen.
````

**Verificación del estudiante:** indexar un PDF propio con texto y ver el número de fragmentos; comprobar que un PDF escaneado se rechaza con el mensaje correcto.

**Commit sugerido:** `feat(interfaz): subida de PDF a Blob e indexación`

---

## P08 · Chat del asistente

**Fase:** 5 · **Crea:** la pantalla del asistente con chat y fuentes

````text
Antes de escribir código lee completos: doc/PLAN_NOVA.md (secciones 5.1, 6.2, 7.1, 11, 13 y 14), doc/ESTADO_EJECUCION.md, lib/dataService.ts y los componentes existentes.

OBJETIVO: la pantalla principal: preguntar al asistente y ver la respuesta con sus fuentes.

TAREA 1. components/nova/MensajeChat.tsx: una burbuja de mensaje; distingue usuario y asistente por color y alineación (nunca solo color); la del asistente puede incluir, debajo, las fuentes.

TAREA 2. components/nova/ListaFuentes.tsx: muestra las fuentes como chips bajo la respuesta del asistente ("factura.pdf · fragmento 3", "Tarea 1a2b"); si no hay fuentes, no muestra nada.

TAREA 3. components/nova/Chat.tsx (cliente): mantiene la conversación en memoria (no hace falta persistirla); campo de pregunta con validación en vivo (habilita enviar solo con ≥ 2 palabras y ≥ 8 caracteres, usando las reglas de lib/reglas/consulta.ts); al enviar, agrega la pregunta como burbuja de usuario, muestra un estado "Pensando…" y llama POST /api/nova/consultar; agrega la respuesta como burbuja del asistente con ListaFuentes. Maneja los errores: SIN_DOCUMENTOS muestra un aviso con enlace a /nova/documentos/nuevo; ERROR_LLM muestra un aviso para reintentar; CONSULTA_MUY_CORTA no debería llegar porque el botón está deshabilitado, pero si llega, muestra el mensaje.

TAREA 4. app/nova/page.tsx: encabezado "Asistente"; si no hay documentos (puede comprobarse al cargar con un fetch ligero o dejando que la primera consulta devuelva SIN_DOCUMENTOS), muestra una guía para indexar primero; el Chat ocupa la vista. Repite brevemente el aviso de privacidad si no está ya visible en el layout.

VERIFICACIÓN: pídeme que inicie sesión si lo necesitas. Con al menos un PDF indexado: preguntar algo cuya respuesta esté en el PDF (responde y muestra la fuente); preguntar algo ausente ("No encontré esto en tus documentos"); preguntar "¿qué tareas tengo pendientes?" (incluye las tareas y las cita); escribir "Agenda" (el botón queda deshabilitado o muestra el mensaje). En una cuenta sin documentos, preguntar (aviso de indexar primero). Documenta.

AL TERMINAR:
- npm run build y npm test sin errores.
- Marca P08 en ESTADO_EJECUCION.md y agrega su sección en la bitácora.
- Muéstrame un resumen.
````

**Verificación del estudiante:** hacer tres preguntas: una con respuesta en el PDF (debe citar la fuente), una ausente (debe decir que no la encontró) y una sobre tareas pendientes (debe citarlas).

**Commit sugerido:** `feat(interfaz): chat del asistente con fuentes`

---

## P09 · Aceptación del MVP

**Fase:** 6 · **Crea:** `doc/ACEPTACION.md` · **Modifica:** `README.md`

````text
Antes de escribir código lee completos: doc/PLAN_NOVA.md (secciones 5.1, 10.3, 16 y 17.3) y doc/ESTADO_EJECUCION.md completo.

OBJETIVO: cerrar el MVP con la revisión de calidad y la aceptación.

TAREA 1. Ejecuta npm test y, si tienes la clave de Gemini, npm run probar:rag. Corrige cualquier falla en el código (no en las pruebas).

TAREA 2. Revisa el código contra las secciones 10.3 y 16. Reporta y corrige en la bitácora: mensajes que no coincidan textualmente con la sección 5.1; reglas que llamen a red o a la base; código fuera de lib/llm que conozca a Gemini; la clave de Gemini en el código o el repositorio; rutas sin exigirSesion; tamaño de PDF validado solo en el navegador; vectores concatenados en SQL en vez de parámetro casteado; textos en inglés; estado comunicado solo con color.

TAREA 3. Crea doc/ACEPTACION.md con la tabla A-01 a A-15 de la sección 17.3 (columnas: ID, acción, resultado esperado, resultado obtenido, evidencia, observación; las tres últimas vacías) y una nota de que A-16 a A-18 corresponden a los opcionales (P10, P11). Incluye el criterio del plan (A-14): con 3 PDF reales y 10 preguntas, acertar y citar bien en al menos 7.

TAREA 4. Actualiza README.md: descripción (qué es RAG en una línea); funcionalidades; requisitos (claves: conexión a Postgres, Gemini, Blob); cómo correr en local (npm install, .env.local con los NOMBRES de las variables, db:migrar, dev); scripts y su propósito; estructura de carpetas; nota de privacidad (los fragmentos y la pregunta se envían al proveedor del LLM; no usar datos sensibles); nota de que la clave de Gemini nunca va en el repositorio; enlace a doc/PLAN_NOVA.md.

TAREA 5. Verifica que .env.local esté en .gitignore y que ningún archivo versionado tenga claves ni valores de variables de entorno.

AL TERMINAR:
- npm run build y npm test sin errores.
- Crea doc/checkpoints/FASE_5_COMPLETADA.md (interfaz) y doc/checkpoints/FASE_6_COMPLETADA.md (revisión y aceptación).
- Marca P09 en ESTADO_EJECUCION.md y agrega su sección en la bitácora.
- Muéstrame un resumen y recuérdame que A-01 a A-15 se ejecutan en el despliegue de Vercel, y que A-14 necesita 3 PDF reales y 10 preguntas.
````

**Verificación del estudiante:** hacer push y ejecutar A-01 a A-15 en la URL de Vercel; para A-14, indexar 3 PDF propios y comprobar que de 10 preguntas con respuesta conocida acierta y cita bien en al menos 7.

**Commit sugerido:** `docs: aceptación del MVP y README`

---

## P10 · Opcionales: completar tarea e índice de productividad

**Fase:** 7 · **Requisito:** `doc/checkpoints/FASE_6_COMPLETADA.md` existe y `doc/ACEPTACION.md` está diligenciado

````text
Antes de escribir código lee completos: doc/PLAN_NOVA.md (secciones 5 (RN-16 a RN-18), 7 (CU-04, CU-05), 9.1, 17.1 (T-24 a T-28) y 19), doc/ESTADO_EJECUCION.md y doc/checkpoints/FASE_6_COMPLETADA.md. Si FASE_6_COMPLETADA.md no existe, detente y avísame.

OBJETIVO: F5 (completar tarea) y F6 (índice de productividad).

TAREA 1. F5 · Completar tarea:
- lib/datos/tareas.ts: completarTarea(id, minutos): si no existe, TAREA_NO_ENCONTRADA; si estado es 'Completada', TAREA_YA_COMPLETADA; si no, estado 'Completada', minutos_invertidos = minutos (esquemaCompletar, entero ≥ 0), fecha_cierre = hoyBogota() (RN-16). Reexporta en dataService.
- app/api/nova/tareas/[id]/completar/route.ts: POST con exigirSesion() y esquemaCompletar.
- En TablaTareas, acción "Completar" en las tareas Pendientes: abre un campo para los minutos y confirma; tras completar, router.refresh(). Una tarea ya completada no muestra la acción.

TAREA 2. F6 · Índice de productividad:
- Verifica que lib/reglas/productividad.ts y las pruebas T-24 a T-28 pasan (se crearon en P02).
- lib/datos/productividad.ts: calcularProductividad(fecha): cuenta las tareas con fecha_limite = fecha; si 0, devuelve { sinTareas: true } (RN-18, el servicio corta aquí y la interfaz muestra "Sin tareas programadas para esta fecha"); si no, cuenta completadas y suma los minutos de las completadas (tope aplicado por la regla), llama calcularIndice y pide a llm.responder una recomendación breve (una o dos frases) a partir del nivel y los números. Devuelve { puntos, nivel, recomendacion }. Reexporta en dataService.
- app/api/nova/productividad/route.ts: POST con exigirSesion() y esquemaProductividad (fecha opcional, por defecto hoy).
- components/nova/TarjetaProductividad.tsx y app/nova/productividad/page.tsx: selector de fecha (por defecto hoy); muestra puntos (un decimal), nivel (con color) y recomendación, o el aviso de sin tareas. Agrega "Productividad" a NavegacionNova.

VERIFICACIÓN: pídeme que inicie sesión si lo necesitas. Crea tareas con fecha límite hoy, completa algunas con minutos y comprueba el índice (verifica a mano un caso contra la fórmula, por ejemplo 4 de 5 y 120 min → 86,0 Excelente). Comprueba una fecha sin tareas (aviso). Comprueba que una tarea ya completada no se puede volver a completar. Documenta.

AL TERMINAR:
- npm run build y npm test sin errores.
- Agrega a doc/ACEPTACION.md los resultados de A-16 (completar) y A-17 (índice, con día con y sin tareas).
- Marca P10 en ESTADO_EJECUCION.md y agrega su sección en la bitácora.
- Muéstrame un resumen.
````

**Verificación del estudiante:** completar una tarea con minutos y revisar el índice del día; comprobar a mano que el número coincide con la fórmula y que un día sin tareas muestra el aviso.

**Commit sugerido:** `feat(opcional): completar tarea e índice de productividad`

---

## P11 · Opcional: búsqueda en Wikipedia

**Fase:** 7 (cierre) · **Requisito:** P10 completado

````text
Antes de escribir código lee completos: doc/PLAN_NOVA.md (secciones 5 (RN-05), 7 (CU-06), 8.2 (fuentes_web), 17.3 (A-18) y 19), doc/ESTADO_EJECUCION.md y los componentes existentes.

OBJETIVO: F4, buscar en Wikipedia en español, resumir con el LLM y guardar la fuente.

TAREA 1. lib/datos/wikipedia.ts: buscarEnWikipedia(consulta, categoria): valida la consulta (validarConsulta, RN-02); consulta la API pública de Wikipedia en español (sin clave) y toma los 3 primeros resultados; pide a llm.responder una síntesis breve a partir de esos extractos; antes de guardar, cuenta las fuentes de esa categoría: si ya hay MAX_FUENTES_WEB_POR_CATEGORIA (20), lanza LIMITE_FUENTES (RN-05); si no, guarda una fila en fuentes_web (categoria, url del primer resultado, extracto = la síntesis, fecha_guardado = hoyBogota()). Devuelve { resumen, url, guardada: true }. Reexporta en dataService.

TAREA 2. app/api/nova/web/route.ts: POST con exigirSesion() y esquemaWeb (consulta, categoria opcional, por defecto "General").

TAREA 3. app/nova/web/page.tsx: campo de consulta y categoría; muestra el resumen y la URL guardada; si el servidor responde LIMITE_FUENTES, muestra el mensaje (archive o elimine una antes). Agrega "Web" a NavegacionNova. Nota: el borrado o archivado de fuentes está fuera de alcance; si se llega al límite, se informa pero no se ofrece borrar (coherente con "fuera de alcance" del plan).

VERIFICACIÓN: pídeme que inicie sesión si lo necesitas. Busca un tema (por ejemplo "Sierra Nevada de Santa Marta"); comprueba que devuelve un resumen y guarda la fuente; repite consultas en la misma categoría hasta acercarte al límite para ver el mensaje de LIMITE_FUENTES (puedes bajar temporalmente MAX_FUENTES_WEB_POR_CATEGORIA en config para probarlo sin crear 20, y luego restaurarlo). Documenta.

AL TERMINAR:
- npm run build y npm test sin errores.
- Agrega a doc/ACEPTACION.md el resultado de A-18 (búsqueda web).
- Crea doc/checkpoints/FASE_7_COMPLETADA.md.
- Marca P11 en ESTADO_EJECUCION.md y agrega su sección en la bitácora.
- Muéstrame un resumen.
````

**Verificación del estudiante:** buscar un tema y ver el resumen con su fuente guardada; comprobar el mensaje de límite por categoría.

**Commit sugerido:** `feat(opcional): búsqueda en Wikipedia con resumen y fuente`

---

## Prompts auxiliares

### Corrección de un error

Reemplazar `[NN]` por el número del prompt y pegar el error completo donde se indica.

````text
Durante la ejecución del prompt P[NN] apareció este error:

[PEGAR AQUÍ EL ERROR COMPLETO]

Lee doc/PLAN_NOVA.md, doc/ESTADO_ACTUAL.md y doc/ESTADO_EJECUCION.md. Encuentra la causa y corrígela sin salir del alcance de P[NN]. No modifiques pruebas ni scripts de prueba para que pasen; corrige el código que prueban. Ejecuta npm run build y npm test. Registra en la bitácora la causa, la corrección y los archivos modificados. Muéstrame un resumen.
````

### Reanudación de un prompt interrumpido

````text
La ejecución anterior del prompt P[NN] se interrumpió. Lee doc/ESTADO_EJECUCION.md, doc/PLAN_NOVA.md y doc/PROMPTS_NOVA.md (sección P[NN]). Revisa qué archivos de P[NN] ya existen y cuáles faltan, y continúa desde la primera tarea incompleta sin rehacer lo terminado. Al final ejecuta npm run build y npm test, y actualiza la bitácora.
````

### Despliegue fallido en Vercel

````text
El despliegue en Vercel falló con este registro:

[PEGAR AQUÍ EL REGISTRO DEL BUILD DE VERCEL]

Lee doc/ESTADO_ACTUAL.md y doc/ESTADO_EJECUCION.md. Identifica la causa (error de compilación, variable de entorno faltante en Vercel —incluidas la clave de Gemini y el token de Blob—, diferencia entre local y producción, o maxDuration insuficiente en una ruta que llama a Gemini). Si es de código, corrígelo y verifica con npm run build. Si es una variable de entorno, dime exactamente qué NOMBRE de variable falta y en qué entornos de Vercel agregarla, sin pedir ni mostrar valores. Registra la causa y la solución en la bitácora.
````
