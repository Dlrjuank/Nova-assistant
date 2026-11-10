# Prompts Jarvis · Nova Assistant

Pasos J01 a J25 para ejecutar `doc/PLAN_JARVIS.md`. Se ejecutan **después de E21 y del Paso 0**, en la rama `jarvis`, uno por vez y esperando confirmación. Pega el bloque de texto en una conversación nueva, después de cumplir "Haz tú antes".

"Viene de" indica el paso anterior (J o M) o "nuevo". Los marcados **OPCIONAL** no son parte de la ruta principal.

## Reglas J (se aplican a todos los prompts)

1. **Rama:** solo `jarvis`. Si `git branch --show-current` dice otra, detente. Nunca commit ni push a `master`. Commit y push solo si el usuario los pide.
2. **Lectura previa:** `CLAUDE.md`, `doc/PLAN_JARVIS.md`, `doc/ESTADO_JARVIS.md` y el código que se va a tocar. Si el código no coincide con el prompt, avisa antes de cambiar algo.
3. **Migraciones:** solo aditivas, sin DROP, RENAME ni cambio de tipo. Antes de cada una, `npm run db:respaldar`. Se aplican con `npm run db:migrar`. Nombre con marca de tiempo posterior a la última de `supabase/migrations`. El número del prompt es provisional: si ya se usó, toma el siguiente libre. Después: `npm run db:verificar` (ampliado) y `db:verificar` y `probar:rag` del código de `master` desde un `git worktree` temporal.
4. **Tablas nuevas:** `usuario_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE`, RLS activo sin políticas y `REVOKE ALL ... FROM anon, authenticated`. Las hijas usan claves foráneas compuestas `(id, usuario_id)`.
5. **Servicios:** `usuarioId` es el primer argumento y toda consulta filtra por él. Un id ajeno responde como inexistente. Se reexportan en `src/lib/dataService.ts`.
6. **Dueño sin sesión:** el `usuarioId` nunca sale del cuerpo de la petición. Se obtiene como dice la sección 5 de `doc/PLAN_JARVIS.md`. Nunca `nova_config`.
7. **Rutas:** bajo `src/app/api/`. Toda ruta nueva empieza con `exigirSesion()` (`src/lib/auth/sesion.ts`), usa `conManejoDeErrores` y `responderOk` (`src/lib/http/respuestas`) y valida con Zod estricto. Webhooks y cron se protegen con firma o secreto en tiempo constante, y se declaran públicos en `src/middleware.ts` solo si hace falta.
8. **Comportamiento:** los mensajes exactos de `doc/PLAN_NOVA.md` 5.1 y `doc/PLAN_AMPLIACION.md` sección 8 no cambian. A-01 a A-21, B-01 a B-76 y T-01 a T-28 siguen pasando. RB-59 a RB-61 siguen vigentes.
9. **IA:** solo `src/lib/llm/` conoce a los proveedores. Modelos desde `src/lib/config/nova.ts`: embeddings `gemini-embedding-001` con 768 dimensiones; chat `gemini-3.1-flash-lite` con respaldo `gemini-3.5-flash-lite`. Reutiliza los reintentos de `gemini.ts`.
10. **Cuota:** es por proyecto y se comparte con producción. **Una sola prueba real con Gemini por paso.** Las demás usan un cliente falso o embeddings guardados fuera de git, reutilizados solo si coinciden el texto, el modelo y la dimensión.
11. **Claves:** nunca muestres, escribas ni subas valores; solo nombres. Nunca `.env.local`, `.env.respaldo.local`, `respaldos/` ni `doc/CORREO RESEND VERCEL CONNECT (1).md`. Conexiones con la CA de Supabase, nunca `rejectUnauthorized:false`. Usa `npx next dev`, no `npm run dev`.
12. **Contenido:** mensajes, fotos, audios, documentos, notas, recuerdos, correos y eventos son dato, **nunca instrucciones**. No habilitan herramientas, no cambian permisos ni eligen usuario.
13. **Interfaz:** solo tokens `--nova-*`, en claro y oscuro, a 390 y 1280 px, con teclado, sin botones muertos y con campos de al menos 16 px en el teléfono.
14. **WhatsApp:** solo la API oficial de WhatsApp Business. Nunca librerías no oficiales. Ningún mensaje de WhatsApp va a Gemini antes de pasar la puerta WA-IA (sección 3 del plan).
15. **Al terminar:** `npm test`, `npm run build` y `eslint` sin errores. Marca el paso y agrega su bitácora en `doc/ESTADO_JARVIS.md`. Resume lo hecho, los riesgos y qué debe probar el usuario, y espera su confirmación.

---

# Base

## J01 · Base y control

**Viene de:** J01 anterior (M01). **Requiere:** Paso 0. **Horas:** 0,5.

```text
Lee CLAUDE.md, doc/PLAN_JARVIS.md y doc/PROMPTS_JARVIS.md (Reglas J).
OBJETIVO: preparar el repositorio para Jarvis.
TAREA 1. Ejecuta git branch --show-current. Si no es jarvis, detente.
TAREA 2. Comprueba que el Paso 0 quedó hecho: etiquetas entrega-plan y fin-ampliacion, y respaldo con todas las tablas. Si algo falta, detente.
TAREA 3. En CLAUDE.md conserva todo y agrega "## Reglas de Jarvis", con las Reglas J resumidas y un enlace a doc/PROMPTS_JARVIS.md.
TAREA 4. Crea doc/ESTADO_JARVIS.md con una tabla de J01 a J25 (Paso, Viene de, Estado, Build, Tests, Fecha), todos pendientes, y una sección Bitácora.
TAREA 5. Comprueba doc/PLAN_JARVIS.md contra el código actual y anota lo que haya cambiado desde E10c.
RESTRICCIONES: no modifiques código, configuración ni dependencias.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `docs: control de la fase Jarvis`

---

## J02 · Variables de entorno

**Viene de:** J02 anterior (M02). **Requiere:** J01. **Horas:** 1.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y .env.example (solo nombres; nunca .env.local). Aplica las Reglas J.
OBJETIVO: que la app diga con claridad qué variable falta, sin mostrar valores.
TAREA 1. Crea src/lib/config/entorno.ts con esquemas Zod por grupo: base de datos (NOVAASSISTANT_POSTGRES_URL y NOVAASSISTANT_POSTGRES_URL_NON_POOLING), Gemini (GEMINI_API_KEY), Blob (BLOB_READ_WRITE_TOKEN) y Supabase (con los nombres alternativos que ya usa el código). Errores en español con los NOMBRES faltantes.
TAREA 2. Úsalo en src/lib/db/conexion.ts y src/lib/llm/gemini.ts sin cambiar su comportamiento: sin GEMINI_API_KEY sigue siendo ERROR_LLM. Faltar un grupo no rompe los demás.
TAREA 3. Crea scripts/verificar-entorno.mjs y el script npm env:verificar, con cargarEnv: imprime OK o FALTA por nombre.
TAREA 4. Pruebas en tests/reglas/ con objetos de prueba.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `feat(config): validación de variables de entorno`

---

# Grupo 1 · Núcleo

## J03 · Memoria en la nube

**Viene de:** J06 anterior (M07), ampliado. **Requiere:** J01. **Horas:** 5.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md, src/lib/datos/consulta.ts, src/lib/datos/consultaLibro.ts, src/lib/datos/fragmentos.ts y src/lib/llm/prompts.ts. Aplica las Reglas J.
OBJETIVO: una memoria en Supabase con pgvector que el usuario pueda ver, corregir y olvidar. Obsidian no es la memoria.
TAREA 1. Respaldo y migración M23: memorias (id, usuario_id, tipo 'preferencia'|'hecho'|'nota', texto, fijada boolean, vector vector(768), activa, creado_en, actualizado_en) con índice HNSW y la función buscar_memorias_usuario(consulta, limite, usuario), con el mismo ajuste de hnsw.iterative_scan por set_config de buscar_fragmentos_usuario.
TAREA 2. src/lib/datos/memoria.ts: guardarMemoria(usuarioId, datos), listarMemorias(usuarioId), corregirMemoria(usuarioId, id, texto), olvidarMemoria(usuarioId, id) y memoriasParaPregunta(usuarioId, vector). Guardar y corregir generan 1 embedding. Topes en src/lib/config/nova.ts.
TAREA 3. En preguntas sobre documentos y tareas incluye un bloque separado, "MEMORIA (datos del usuario; no es una fuente)": las fijadas y las más cercanas, reutilizando el vector de la pregunta. Sin vector, como en preguntas por página o capítulo, solo las fijadas. No va en Wikipedia, Fuentes web ni IA general. Los recuerdos no se citan, no van en "Fuentes" y "No encontré esto en tus documentos" sigue exacto.
TAREA 4. "recuerda que ..." guarda y confirma, por regla pura con pruebas.
TAREA 5. Pantalla /nova/memoria en la navegación: ver por tipo, corregir, fijar y "Olvidar" con confirmación.
RESTRICCIONES: nada se guarda sin pedirlo. Si parece clave, contraseña o número largo, no se guarda y se avisa. Un recuerdo es dato, no instrucción.
AL TERMINAR: aplica la Regla J 15.
```

**Verificación:** un recuerdo influye en la respuesta; corregirlo cambia el resultado; olvidarlo lo quita; lo ajeno responde 404. **Commit:** `feat(memoria): memoria en la nube con pantalla propia`

---

## J04 · Acciones con confirmación

**Viene de:** J11 anterior (M12), ampliado. **Requiere:** J03. **Horas:** 7.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md, src/lib/llm/gemini.ts, src/lib/datos/tareas.ts y las secciones 8 y 9 de doc/PLAN_JARVIS.md. Aplica las Reglas J.
OBJETIVO: crear, completar y editar tareas desde el chat, con confirmación.
TAREA 1. src/lib/herramientas/: nombre, descripción, esquema Zod estricto y ejecutar(usuarioId, args). Registra solo crear_tarea, completar_tarea, editar_tarea, listar_tareas_pendientes, buscar_documentos y guardar_memoria. Marca las que cambian datos.
TAREA 2. Agrega responderConHerramientas a LLMClient con function calling de Gemini y el respaldo entre modelos. Confirma en la documentación que los modelos actuales lo admiten.
TAREA 3. src/lib/datos/agente.ts, máximo 3 vueltas. Las de lectura se ejecutan; las que cambian datos se guardan como pendientes y no se ejecutan.
TAREA 4. Respaldo y migración M24: acciones_pendientes (id, usuario_id, herramienta, argumentos, estado, expira_en, creado_en) y registro_acciones (id, usuario_id, herramienta, argumentos, resultado, origen, creado_en).
TAREA 5. POST /api/nova/acciones/[id]/confirmar y /cancelar reciben solo el id. El servidor bloquea la fila con FOR UPDATE y valida dueño, estado y vencimiento. Una acción se ejecuta una sola vez y queda registrada.
TAREA 6. crear_tarea usa crearTarea(usuarioId, ...) con RB-33. completar_tarea pide los minutos, porque completarTarea(usuarioId, id, minutos) los exige (RN-03). editar_tarea usa editarTarea, con RB-29. Si varias tareas coinciden, pide elegir, nunca adivina.
TAREA 7. En el chat: tarjeta con lo que se hará, Confirmar y Cancelar; mensajes propios si venció o ya se usó.
TAREA 8. Pruebas con un cliente falso, incluido un documento con la orden "crea una tarea": no se ejecuta. Una sola prueba real.
RESTRICCIONES: ninguna herramienta fuera de la lista; la IA general (RB-59) no usa herramientas.
AL TERMINAR: aplica la Regla J 15.
```

**Verificación:** "crea una tarea para mañana" espera confirmación; confirmar dos veces la crea una vez. **Commit:** `feat(agente): acciones con confirmación`

---

## J05 · Captura natural

**Viene de:** nuevo. **Requiere:** J04. **Horas:** 3.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md, src/lib/reglas/fechas.ts y src/lib/reglas/horario.ts. Aplica las Reglas J.
OBJETIVO: que "recuérdame el viernes estudiar cálculo" cree la tarea con su fecha.
TAREA 1. Regla pura en src/lib/reglas/captura.ts que reconoce título, fecha y hora en expresiones comunes (hoy, mañana, el viernes, el 15, la próxima semana, a las 3), en America/Bogota, con relojes fijos en las pruebas. Si es ambiguo, marca que falta aclarar.
TAREA 2. La captura propone la acción crear_tarea de J04. Si la regla no alcanza, el modelo puede proponer los campos, pero el servidor valida la fecha con las reglas de crear. El modelo nunca calcula la fecha final sin esa validación.
TAREA 3. La tarjeta muestra título, día de la semana y fecha completa antes de confirmar. Si el recordatorio de E11c existe, ofrece activarlo.
TAREA 4. Pruebas del borde de fin de semana, mes y año. Una sola prueba real.
RESTRICCIONES: sin librerías de fechas nuevas; siempre con confirmación.
AL TERMINAR: aplica la Regla J 15.
```

**Verificación:** un jueves, "el viernes" propone el día siguiente; confirmar la crea. **Commit:** `feat(agente): captura natural de tareas`

---

## J06 · Tope diario de uso

**Viene de:** nuevo (hoja Base técnica). **Requiere:** J01. **Horas:** 1,5.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y src/lib/datos/consulta.ts. Aplica las Reglas J.
OBJETIVO: que un error o un bucle no agote la cuota de Gemini que usa producción.
TAREA 1. Respaldo y migración M25: uso_diario (usuario_id, fecha, canal, llamadas), con clave primaria compuesta.
TAREA 2. Regla pura y función contarUso(usuarioId, canal) con incremento atómico, y tope por canal en src/lib/config/nova.ts.
TAREA 3. Se revisa antes de cada llamada a Gemini de los flujos de Jarvis. Al llegar al tope, un mensaje claro en español. Las preguntas existentes de la app no se bloquean en este paso.
TAREA 4. Pruebas de concurrencia y del cambio de día en Bogotá.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `feat(limites): tope diario de uso`

---

# Grupo 2 · Canales

## J07 · Voz en la app

**Viene de:** J14 anterior (M16). **Requiere:** J01. **Horas:** 2.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y src/components/nova/Chat.tsx. Aplica las Reglas J.
OBJETIVO: hablarle a Nova y que responda en voz.
TAREA 1. Botón de micrófono con el reconocimiento de voz del navegador (es-CO) que rellena el campo; se envía con un toque.
TAREA 2. "Leer respuestas en voz alta" con speechSynthesis en español, recordada en el navegador con try/catch. Lee el texto final, sin citas entre corchetes.
TAREA 3. Indicadores "Escuchando…" y "Hablando…", con botón para detener. Con "reducir movimiento", sin animaciones.
TAREA 4. Si el navegador no admite la API, el botón no aparece.
TAREA 5. Agrega al aviso de privacidad que el navegador puede enviar el audio a su servicio.
RESTRICCIONES: no grabar ni guardar audio; el permiso se pide solo al tocar el micrófono.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `feat(voz): micrófono y lectura en voz alta`

---

## J08 · WhatsApp: conexión y comandos

**Viene de:** J05 anterior (M06), Telegram reemplazado. **Requiere:** J04 y J06. **Horas:** 4,5. **Haz tú antes:** crear la app en Meta con el número de prueba, generar un token permanente de usuario del sistema y guardar `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` y `WHATSAPP_VERIFY_TOKEN`, sin enviar los valores.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y las secciones 5, 6 y 8 de doc/PLAN_JARVIS.md. Aplica las Reglas J. Este paso NO envía mensajes a Gemini.
OBJETIVO: vincular un número y usar comandos fijos por la API oficial de WhatsApp Business.
TAREA 1. Respaldo y migración M26: vinculos_whatsapp (usuario_id único, wa_id único, conversacion_id, opt_in_en, vinculado_en), codigos_vinculacion_whatsapp (usuario_id, hash_codigo, expira_en, usado_en), intentos_vinculacion_whatsapp (wa_id como clave primaria, fallidos, bloqueado_hasta) y mensajes_whatsapp (id de mensaje como clave primaria, recibido_en).
TAREA 2. Configuración → WhatsApp: con sesión, generar un código de un solo uso válido 10 minutos, ver el vínculo y revocarlo.
TAREA 3. src/lib/whatsapp/cliente.ts con enviarTexto y enviarBotones, con la API oficial y fetch.
TAREA 4. GET /api/whatsapp/webhook compara hub.verify_token en tiempo constante y devuelve hub.challenge. POST lee el CUERPO CRUDO y valida X-Hub-Signature-256 con WHATSAPP_APP_SECRET en tiempo constante antes de interpretarlo. Comprueba metadata.phone_number_id. Responde 200 y procesa después. Ignora mensajes repetidos.
TAREA 5. Resuelve usuarioId por messages[].from en vinculos_whatsapp y vuelve a comprobar tieneAccesoNova. Sin vínculo solo acepta VINCULAR CODIGO, con máximo 5 intentos fallidos por número. Registra la aceptación.
TAREA 6. Comandos fijos: PENDIENTES, TAREA <título> | <AAAA-MM-DD> con confirmación por botones usando las acciones de J04, BAJA. Enrutado en src/lib/reglas/whatsapp.ts con pruebas. Un botón lleva solo el id de la acción, y se comprueba que sea del dueño del número.
TAREA 7. Pruebas de firma válida, inválida, sin cuerpo crudo, repetidos y número ajeno.
AL TERMINAR: aplica la Regla J 15 y explica, sin valores, cómo registrar el webhook con la vista previa protegida usando un secreto de omisión dedicado.
```

**Verificación:** sin vincular no responde más que la instrucción; con el código, PENDIENTES funciona; una firma falsa no se procesa. **Commit:** `feat(whatsapp): conexión oficial y comandos`

---

## J09 · Resumen y avisos por WhatsApp

**Viene de:** J10 anterior (M11, M14). **Requiere:** J08, E11c y E11d. **Horas:** 3. **Haz tú antes:** crear las plantillas de utilidad en Meta y consultar la tarifa de Colombia.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md, doc/PLAN_AMPLIACION.md 5.10, 6.12 y 7.10, y el código del tick de E11c. Aplica las Reglas J. Este paso NO envía contenido a Gemini.
OBJETIVO: usar WhatsApp como un canal más de los avisos existentes. NO crees una tabla de recordatorios, vercel.json ni un flujo de GitHub Actions.
TAREA 1. Respaldo y migración M27: preferencias_usuario.resumen_whatsapp y recordatorios_whatsapp (boolean, false por defecto), envios.canal TEXT NULL y vinculos_whatsapp.ultima_entrada_en.
TAREA 2. Regla pura: si la ventana de 24 horas está abierta, mensaje de servicio; si no, plantilla de utilidad. Una plantilla nunca se usa dentro de la ventana. Con pruebas.
TAREA 3. Configuración → Notificaciones: activar cada aviso por WhatsApp, solo con número vinculado, mostrando que las plantillas tienen costo.
TAREA 4. El tick de E11c y el resumen de E11d también envían por WhatsApp a quien lo activó, tomando usuario_id de cada fila, sin duplicar. Contenido determinista con los textos de RB-44 y RB-46.
TAREA 5. Si WhatsApp falla, la notificación push sigue igual.
AL TERMINAR: aplica la Regla J 15 y deja anotada la tarifa consultada con su fecha.
```

**Commit:** `feat(whatsapp): resumen y avisos`

---

## J10 · Conversación con IA por WhatsApp

**Viene de:** J05 anterior (M06). **Requiere:** J09 y la **puerta WA-IA** (D3 y D4). **Horas:** 3. **Haz tú antes:** decidir D3 y D4; guardar `GEMINI_API_KEY_WHATSAPP` de un proyecto de pago, con alerta de presupuesto.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y las secciones 3, 7 y 8 de doc/PLAN_JARVIS.md. Aplica las Reglas J.
ANTES DE EMPEZAR: confirma que D3 y D4 quedaron aprobadas en doc/ESTADO_JARVIS.md y relee la sección 4.7 de los términos de WhatsApp. Si no están aprobadas o cambió la cláusula, detente y avísame.
OBJETIVO: preguntar sobre mis tareas y documentos desde WhatsApp.
TAREA 1. En src/lib/llm/ permite elegir el cliente de Gemini de WhatsApp, que usa solo GEMINI_API_KEY_WHATSAPP. Sin esa clave, se rechaza: nunca se recurre a la clave gratuita.
TAREA 2. Un texto normal llama a consultarYRegistrar(usuarioId, texto, vinculo.conversacion_id), revisando el tope de J06, y responde con el texto y sus fuentes. Divide respuestas largas respetando el límite de WhatsApp.
TAREA 3. Por WhatsApp no se ofrece "IA general" (RB-59): solo tareas y documentos propios.
TAREA 4. La captura natural de J05 y las acciones de J04 funcionan con botones.
TAREA 5. Pruebas con un cliente falso, incluido un mensaje con una orden escondida. Una sola prueba real.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `feat(whatsapp): conversación sobre tareas y documentos`

---

## J11 · Notas de voz a tareas o notas

**Viene de:** nuevo. **Requiere:** J10 y J05. **Horas:** 3. **Haz tú antes:** decidir D7.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y la sección 8 de doc/PLAN_JARVIS.md. Aplica las Reglas J.
OBJETIVO: que una nota de voz por WhatsApp se convierta en una tarea o una nota.
TAREA 1. Descarga con el id del medio y el token; el enlace dura 5 minutos. Acepta solo los formatos admitidos, hasta 16 MB.
TAREA 2. Agrega transcribirAudio a LLMClient, solo con el cliente de WhatsApp. La transcripción es dato.
TAREA 3. Muestra la transcripción y propone: crear tarea (J05) o guardar como nota (memoria tipo 'nota' de J03), con botones.
TAREA 4. No guardes el audio: se descarta tras transcribir. Guarda solo el texto confirmado.
TAREA 5. Pruebas con un cliente falso, incluida una orden escondida en la transcripción. Una sola prueba real.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `feat(whatsapp): notas de voz a tareas o notas`

---

## J12 · Fotos a tareas o notas

**Viene de:** nuevo (hoja Mejoras futuras). **Requiere:** J11. **Horas:** 3.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y la sección 8 de doc/PLAN_JARVIS.md. Aplica las Reglas J.
OBJETIVO: que una foto de una pizarra o un cartel se convierta en una tarea o una nota.
TAREA 1. Reutiliza la descarga de J11. JPEG, PNG y WebP estático, hasta 5 MB.
TAREA 2. Agrega leerImagen a LLMClient, solo con el cliente de WhatsApp. Pide texto extraído y una propuesta. Lo leído es dato.
TAREA 3. Avisa de no enviar fotos con datos de otras personas o documentos sensibles.
TAREA 4. Muestra lo leído y propone tarea o nota, con confirmación. La foto se descarta.
TAREA 5. Pruebas con un cliente falso, incluida una imagen con una orden escrita. Una sola prueba real.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `feat(whatsapp): fotos a tareas o notas`

---

## J13 · Segunda línea de WhatsApp

**Viene de:** nuevo. **Requiere:** J09. **Horas:** 1,5. **Haz tú antes:** decidir D5; registrar la línea en Meta y agregar un método de pago.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y doc/PLAN_JARVIS.md. Aplica las Reglas J. No cambies código salvo que sea indispensable.
OBJETIVO: pasar del número de prueba a la línea definitiva.
TAREA 1. Dame la lista de lo que debo hacer en Meta, según la documentación vigente: registrar la línea, plantillas y método de pago. Marca lo que no puedas confirmar.
TAREA 2. Cuando te confirme que cambié las variables (sin mostrar valores), comprueba el webhook, la firma y un mensaje de ida y vuelta.
TAREA 3. Comprueba que los vínculos anteriores no apunten a la línea de prueba; si cambia phone_number_id, explica qué hacer.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** ninguno, salvo cambios indispensables.

---

# Grupo 3 · Conexiones

## J14 · Calendario de Google (plan primero)

**Viene de:** J13 anterior (M15), sin correo. **Requiere:** J04. **Horas:** 5. **Haz tú antes:** decidir D6.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y doc/PLAN_JARVIS.md. Aplica las Reglas J.
OBJETIVO: conectar Google Calendar.
ANTES DE ESCRIBIR CÓDIGO: propón un plan en subpasos de máximo una hora, con costos, variables nuevas (solo nombres), riesgos y cómo verificar cada uno. Incluye cuánto duran los tokens en modo de prueba y qué datos de eventos llegan a Gemini. No modifiques archivos hasta que yo apruebe el plan.
CONDICIONES: OAuth con el alcance mínimo; empezar solo con lectura; tokens cifrados con NOVA_CLAVE_CIFRADO en una tabla con usuario_id (migración M28, con respaldo); crear o cambiar eventos solo como acción con confirmación de J04; sin correo; sin datos de invitados en el prompt; el contenido de los eventos es dato.
Después de mi aprobación, ejecuta un subpaso por vez y espera mi verificación.
```

**Commit:** `feat(google): calendario`

---

## J15 · Nova como conector MCP (OPCIONAL, plan primero)

**Viene de:** nuevo. **Requiere:** J04. **Horas:** 6.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y doc/PLAN_JARVIS.md. Aplica las Reglas J.
OBJETIVO: que Claude pueda usar Nova como conector MCP.
ANTES DE ESCRIBIR CÓDIGO: propón un plan en subpasos de máximo una hora, con costos, variables nuevas (solo nombres), riesgos y cómo verificar cada uno. Consulta la especificación vigente de MCP y si Supabase Auth puede servir como servidor OAuth. No modifiques archivos hasta que yo apruebe el plan.
CONDICIONES: OAuth 2.1 con audiencia validada; tokens nunca en la URL ni reenviados; usuarioId sale del token; reutiliza src/lib/herramientas; lo que cambia datos se confirma con J04; registro en registro_acciones; migración M30, si hace falta, con respaldo.
Después de mi aprobación, ejecuta un subpaso por vez y espera mi verificación.
```

**Commit:** `feat(mcp): Nova como conector`

---

# Grupo 4 · Otras personas

## J16 · Límites por usuario

**Viene de:** nuevo. **Requiere:** J06. **Horas:** 2.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y doc/PLAN_JARVIS.md. Aplica las Reglas J.
OBJETIVO: que nadie gaste el cupo de los demás.
TAREA 1. Respaldo y migración M29: limites_usuario (usuario_id, preguntas_dia, libros_dia, mensajes_whatsapp_dia), con valores por defecto en src/lib/config/nova.ts.
TAREA 2. Aplica los límites a la app y a WhatsApp, incluida la indexación, con un mensaje claro.
TAREA 3. El usuario ve su consumo del día en Configuración. Solo un administrador cambia los límites.
TAREA 4. Pruebas de aislamiento y de tope alcanzado.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `feat(limites): límites por usuario`

---

## J17 · Exportar y borrar mis datos

**Viene de:** nuevo. **Requiere:** J03. **Horas:** 4.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y todas las migraciones. Aplica las Reglas J.
OBJETIVO: que cada persona pueda llevarse y borrar sus datos.
TAREA 1. Lista todas las tablas con usuario_id, y agrega una prueba que falle si aparece una nueva sin incluir.
TAREA 2. GET /api/nova/mis-datos/exportar devuelve un archivo con tareas, categorías, documentos, memoria, conversaciones, materias, notas y vínculos, sin secretos, tokens ni vectores.
TAREA 3. POST /api/nova/mis-datos/borrar exige escribir una frase de confirmación y volver a iniciar sesión reciente. Borra todo lo del usuario en una transacción, sus archivos de Blob y sus vínculos, y cierra la sesión.
TAREA 4. Pantalla en Configuración. Pruebas con dos usuarios: borrar a uno no toca al otro.
RESTRICCIONES: en pruebas, solo usuarios temporales. Nunca ejecutes el borrado sobre una cuenta real.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `feat(cuenta): exportar y borrar datos`

---

## J18 · Plan para abrir a otras personas (plan primero)

**Viene de:** nuevo. **Requiere:** J16 y J17. **Horas:** 2 para planear.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y la sección 10 de doc/PLAN_JARVIS.md. Aplica las Reglas J.
OBJETIVO: decidir cómo podrán usar Jarvis otras personas. No decidas tú.
ANTES DE ESCRIBIR CÓDIGO: compara con datos vigentes las dos opciones, registrarse en mi Nova o instalar la suya: costo mensual para 5 y 50 personas, plan de Vercel, Supabase y Gemini, riesgo con la sección 4.7 de WhatsApp, privacidad y tratamiento de datos en Colombia, soporte y horas. Marca lo que no puedas confirmar. No modifiques archivos hasta que yo elija.
Después de mi elección, propón subpasos de máximo una hora y ejecuta uno por vez.
```

**Commit:** según la opción elegida.

---

# Grupo 5 · Opcionales

## J19 · Exportar a Markdown para Obsidian (OPCIONAL)

**Viene de:** J09 anterior (M10), reducido. **Requiere:** J03. **Horas:** 2.

```text
Lee CLAUDE.md y doc/ESTADO_JARVIS.md. Aplica las Reglas J.
OBJETIVO: descargar la memoria como archivos Markdown, por ejemplo para Obsidian. La memoria sigue en Supabase.
TAREA 1. GET /api/nova/memoria/exportar devuelve un .zip o un .md único, según lo más simple sin dependencias nuevas.
TAREA 2. Función pura que sanea cada nombre (sin rutas, ".." ni caracteres reservados), con pruebas, también en Windows.
TAREA 3. Botón "Exportar" en /nova/memoria.
RESTRICCIONES: solo exporta; no lee ni escribe un vault.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `feat(memoria): exportar a Markdown`

---

## J20 · Lista de conversaciones (OPCIONAL)

**Viene de:** J03 anterior (M03). **Requiere:** J01. **Horas:** 1,5.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md, src/lib/datos/conversacion.ts, src/components/nova/Chat.tsx y src/app/api/nova/conversaciones/route.ts. Aplica las Reglas J. El historial ya existe desde M4: NO crees tablas.
OBJETIVO: volver a conversaciones anteriores.
TAREA 1. listarConversaciones(usuarioId) y obtenerConversacion(usuarioId, id). El título es la primera pregunta recortada, con una regla pura.
TAREA 2. Rutas GET /api/nova/conversaciones/lista y /[id]. Las rutas actuales no cambian.
TAREA 3. Lista accesible en el Asistente, conservando fuentes y marcas de origen.
TAREA 4. Pruebas de aislamiento, ruta e interfaz.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `feat(chat): lista de conversaciones`

---

## J21 · Respuestas en tiempo real (OPCIONAL)

**Viene de:** J04 anterior (M04). **Requiere:** J01. **Horas:** 3.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md, src/lib/llm/gemini.ts, src/lib/datos/consulta.ts, src/lib/datos/conversacion.ts y src/lib/reglas/citas.ts. Aplica las Reglas J.
OBJETIVO: mostrar la respuesta mientras se genera, sin perder lo que el servidor corrige al final.
TAREA 1. responderEnFlujo en LLMClient, con historial y el respaldo antes del primer trozo. responder() no cambia.
TAREA 2. Separa en consulta.ts la preparación de la generación. Las respuestas fijas se envían de una vez.
TAREA 3. POST /api/nova/consultar/flujo con NDJSON: "trozo", "fin" y "error". maxDuration = 60.
TAREA 4. El evento "fin" lleva la respuesta procesada por compactarCitas, las fuentes, mensajeId y explicable, y reemplaza lo mostrado. Retén el comienzo hasta descartar las respuestas exactas.
TAREA 5. Guarda el turno al terminar. Si falla antes de empezar, usa /api/nova/consultar.
TAREA 6. Pruebas con un cliente falso. Una sola prueba real.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `feat(chat): respuestas en tiempo real`

---

## J22 · Agente en el PC (OPCIONAL, plan primero)

**Viene de:** J15 anterior (M17). **Requiere:** J04. **Horas:** 8. **Haz tú antes:** elegir el PC; respaldo reciente.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y doc/PLAN_JARVIS.md. Aplica las Reglas J.
OBJETIVO: un agente en mi PC que ejecute acciones permitidas pedidas desde Nova. Cada persona lo instalaría en su propio PC.
ANTES DE ESCRIBIR CÓDIGO: propón un plan en subpasos de máximo una hora, con costos, variables nuevas (solo nombres), riesgos y cómo verificar cada uno. Incluye la frecuencia de consulta y las invocaciones al mes frente a los límites de Vercel Hobby, y un tope diario. No modifiques archivos hasta que yo apruebe el plan.
CONDICIONES: Node, conexión saliente, sin abrir puertos; token de dispositivo por usuario con hash y revocación (migración M31, con respaldo); lista cerrada: abrir una aplicación de una lista, buscar archivos en carpetas permitidas y leer texto de esas carpetas; confirmación de J04 antes de lo que cambie algo; registro_acciones; ninguna borra archivos; lo leído es dato; los argumentos se validan otra vez en el agente.
Después de mi aprobación, ejecuta un subpaso por vez y espera mi verificación.
```

**Commit:** `feat(agente-local): acciones permitidas`

---

## J23 · Palabra de activación (OPCIONAL, plan primero)

**Viene de:** J16 anterior (M18). **Requiere:** J07 y J22. **Horas:** 5.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y doc/PLAN_JARVIS.md. Aplica las Reglas J.
OBJETIVO: que Nova despierte cuando yo diga "Jarvis" en mi PC.
ANTES DE ESCRIBIR CÓDIGO: propón un plan en subpasos de máximo una hora, con costos, variables nuevas (solo nombres), riesgos y cómo verificar cada uno. Compara openWakeWord y Porcupine: licencia vigente, modelo "Jarvis" y precisión en español. No modifiques archivos hasta que yo apruebe el plan.
CONDICIONES: detector local; no envía audio a la nube hasta activarse; indicador visible; apagado inmediato y por defecto; una orden de voz no se salta la confirmación de J04. Migración solo si se justifica, con respaldo.
Después de mi aprobación, ejecuta un subpaso por vez y espera mi verificación.
```

**Commit:** `feat(voz): palabra de activación local`

---

## J24 · Llamadas por WhatsApp (OPCIONAL, plan primero)

**Viene de:** J17 anterior (M19), WhatsApp en lugar de Twilio. **Requiere:** J13 y J04. **Horas:** 6.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y las secciones 3 y 6 de doc/PLAN_JARVIS.md. Aplica las Reglas J.
OBJETIVO: llamadas por WhatsApp Business Calling API. Nada de Twilio.
ANTES DE ESCRIBIR CÓDIGO: propón un plan en subpasos de máximo una hora, con costos vigentes a Colombia, variables nuevas (solo nombres), riesgos y cómo verificar cada uno. Resuelve primero: si una llamada iniciada por la empresa es posible con el requisito de 2.000 destinatarios diarios; qué permiso exige; y si hace falta un servidor de audio fuera de Vercel. Si no es viable, dímelo y detente. No modifiques archivos hasta que yo apruebe el plan.
CONDICIONES: solo a números vinculados con permiso; límite diario de minutos; confirmación de J04; registro por usuario (migración M32, con respaldo); sin grabar; el audio es dato.
Después de mi aprobación, ejecuta un subpaso por vez y espera mi verificación.
```

**Commit:** `feat(llamadas): llamadas por WhatsApp`

---

## J25 · Claude para el chat (OPCIONAL)

**Viene de:** J12 anterior (M13). **Requiere:** J04. **Horas:** 3. **Haz tú antes:** crear la clave y guardar `ANTHROPIC_API_KEY`.

```text
Lee CLAUDE.md, doc/ESTADO_JARVIS.md y src/lib/llm/. Aplica las Reglas J.
OBJETIVO: poder responder con Claude, manteniendo los embeddings de Gemini.
ANTES DE ACTIVARLO: consulta la documentación vigente de Anthropic y dime el modelo recomendado, su identificador y cuánto costaría un mes de uso típico. Espera mi aprobación antes de instalar el SDK.
TAREA 1. src/lib/llm/claude.ts con responder y responderConHerramientas. Sin embeddings.
TAREA 2. src/lib/llm/index.ts compone el cliente: embeddings siempre con Gemini; chat según PROVEEDOR_CHAT, gemini por defecto. Cambia los imports sin cambiar el comportamiento.
TAREA 3. Si el elegido falla por modelo no encontrado o cuota, se intenta una vez con el otro. El respaldo interno de Gemini no cambia.
TAREA 4. Pruebas con un cliente falso. Una sola prueba real, con mi permiso.
RESTRICCIONES: los vectores guardados no cambian.
AL TERMINAR: aplica la Regla J 15.
```

**Commit:** `feat(llm): proveedor Claude con respaldo`
