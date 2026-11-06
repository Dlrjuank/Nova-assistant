# Aceptación del MVP · Nova Assistant

Casos de la sección 17.3 de `doc/PLAN_NOVA.md`. Se ejecutan en el despliegue de Vercel (https://nova-assistantsm-kappa.vercel.app) con la cuenta admin, no en local. Las tres últimas columnas se llenan al ejecutarlos.

- **Resultado obtenido:** lo que mostró la aplicación.
- **Evidencia:** captura, hora o texto copiado de la pantalla.
- **Observación:** cualquier diferencia con lo esperado.

Fecha de ejecución: 2026-11-06. **Resultado: A-01 a A-15 y A-19 a A-21 pasan.**

## Casos A-01 a A-15

| ID | Acción | Resultado esperado | Resultado obtenido | Evidencia | Observación |
|---|---|---|---|---|---|
| A-01 | Abrir `/nova` sin sesión | Redirección al login | Pasa: en InPrivate, `/nova` sin sesión lleva a `/login` | Ejecutado por el usuario en Vercel, 2026-11-06 |  |
| A-02 | Registrar una tarea con título, categoría, prioridad 3 y fecha válida | Creada, estado Pendiente | Pasa: la tarea con prioridad 3 y fecha 20991231 aparece como Pendiente, prioridad Alta | Ejecutado por el usuario en Vercel, 2026-11-06 |  |
| A-03 | Registrar una tarea con prioridad 5 | Rechazo: "La prioridad debe ser 1, 2 o 3" | Pasa: la API rechazó la prioridad 5 con `PRIORIDAD_INVALIDA` y no creó la tarea | Ejecutado por el usuario en Vercel, 2026-11-06 | Por la API desde la consola: el formulario solo ofrece 1, 2 y 3 |
| A-04 | Registrar una tarea con fecha "2026-02-30" | Rechazo por fecha inválida | Pasa | Ejecutado por el usuario en Vercel, 2026-11-06 |  |
| A-05 | Registrar una tarea sin prioridad | Queda con prioridad 2 | Pasa: sin prioridad quedó con prioridad 2, categoría General, estado Pendiente | Ejecutado por el usuario en Vercel, 2026-11-06 | Por la API desde la consola |
| A-06 | Indexar un PDF con texto (≤ 15 MB) | Confirma el número de fragmentos | Pasa | Ejecutado por el usuario en Vercel, 2026-11-06 |  |
| A-07 | Intentar indexar un PDF escaneado (sin texto) | "El documento no contiene texto seleccionable (no se admite OCR)" | Pasa: "El documento no contiene texto seleccionable (no se admite OCR)" | Ejecutado por el usuario en Vercel, 2026-11-06 |  |
| A-08 | Intentar indexar un archivo mayor a 15 MB | "El documento supera el límite permitido de 15 MB" | Pasa: "El documento supera el límite permitido de 15 MB" | Ejecutado por el usuario en Vercel, 2026-11-06 |  |
| A-09 | Preguntar "Agenda" (1 palabra) | "La instrucción es demasiado corta" | Pasa | Ejecutado por el usuario en Vercel, 2026-11-06 |  |
| A-10 | Preguntar algo cuya respuesta está en el PDF | Responde correctamente y cita el PDF y el fragmento | Pasa | Ejecutado por el usuario en Vercel, 2026-11-06 |  |
| A-11 | Preguntar algo que no está en ningún PDF | "No encontré esto en tus documentos" | Pasa: "¿Quién es el presidente de la empresa?" respondió "No encontré esto en tus documentos" | Ejecutado por el usuario en Vercel, 2026-11-06, con los 3 PDF de A-14 indexados | Registrado durante A-14 |
| A-12 | Preguntar "¿qué tareas tengo pendientes?" | Incluye las tareas pendientes en la respuesta, citadas como fuente | Pasa | Ejecutado por el usuario en Vercel, 2026-11-06 |  |
| A-13 | En una cuenta sin PDF indexados, preguntar | Avisa que primero debe indexar un documento | Pasa | Ejecutado por el usuario en Vercel, 2026-11-06 | Con la base sin documentos |
| A-14 | Criterio del plan: con 3 PDF reales, de 10 preguntas con respuesta en los documentos, acierta y cita bien en al menos 7 | Se registra el conteo | Pasa: 10 de 10 | Ejecutado por el usuario en Vercel, 2026-11-06; detalle en la sección A-14 | |
| A-15 | Cerrar el navegador y volver a entrar | Las tareas, los documentos y la conversación del Asistente persisten | Pasa | Ejecutado por el usuario en Vercel, 2026-11-06 |  |

Notas para ejecutarlos:

- **A-03:** el formulario solo ofrece prioridades 1, 2 y 3. Para ver el rechazo con el mensaje exacto se necesita llamar a la API directamente (`POST /api/nova/tareas` con `prioridad: 5`); la prueba automática `tests/servidor/rutas-nova.test.ts` también lo cubre.
- **A-04:** con la máscara se escribe `20260230`; al salir del campo aparece "La fecha debe tener formato AAAA-MM-DD y ser una fecha real."
- **A-05:** el formulario arranca con prioridad 2. La API asigna 2 cuando el campo no se envía; lo cubren `tests/reglas/tarea.test.ts` y `npm run probar:rag`.
- **A-13:** los documentos no tienen dueño (plan, sección 3.4): "una cuenta sin PDF" significa una base sin documentos. Se ejecuta antes de indexar, o después de eliminar todos los documentos.

## A-14 · Criterio del plan

Con 3 PDF reales (con texto seleccionable, no escaneados), hacer 10 preguntas cuya respuesta se conoce y está en los documentos. Una pregunta cuenta como acierto si la respuesta es correcta **y** la fuente citada es el PDF donde está el dato. Se aprueba con al menos 7 aciertos.

Ejecutado por el usuario en Vercel el 2026-11-06.

PDF usados:

1. `politica-teletrabajo.pdf`
2. `guia-viaje-cartagena.pdf`
3. `manual-laboratorio-quimica.pdf`

**Conteo:** 10 de 10: en todas las preguntas acertó y citó bien. **Resultado:** aprobado (≥ 7).

El usuario informó el conteo, no el texto de cada una de las 10 preguntas; si se quiere el detalle, se puede completar esta tabla:

| # | Pregunta | Respuesta esperada | PDF donde está | Respuesta de Nova | Fuente citada | ¿Acierta y cita bien? |
|---|---|---|---|---|---|---|
| 1 | | | | | | Sí |
| 2 | | | | | | Sí |
| 3 | | | | | | Sí |
| 4 | | | | | | Sí |
| 5 | | | | | | Sí |
| 6 | | | | | | Sí |
| 7 | | | | | | Sí |
| 8 | | | | | | Sí |
| 9 | | | | | | Sí |
| 10 | | | | | | Sí |

Preguntas adicionales registradas por el usuario:

- "¿Cuánto cuesta el desayuno en el hotel?": respondió que el desayuno está incluido en la tarifa, citó `guia-viaje-cartagena.pdf` y no inventó un precio.
- "¿Quién es el presidente de la empresa?": respondió "No encontré esto en tus documentos" (se anota también como A-11).

## Ampliaciones pedidas por el usuario (A-19 a A-21)

No estaban en el plan funcional; se agregaron tras P08.

| ID | Acción | Resultado esperado | Resultado obtenido | Evidencia | Observación |
|---|---|---|---|---|---|
| A-19 | Preguntar por una lista del PDF y luego "¿y el segundo?" | Responde el segundo elemento y cita el PDF (RN-21) | Pasa | Ejecutado por el usuario en Vercel, 2026-11-06 |  |
| A-20 | Salir del Asistente (por ejemplo a Tareas) y volver; luego pulsar "Conversación nueva" | La conversación sigue al volver; con "Conversación nueva" la pantalla queda vacía y la anterior se conserva en la base (RN-20) | Pasa | Ejecutado por el usuario en Vercel, 2026-11-06 |  |
| A-21 | Eliminar un documento desde Documentos, confirmando | Desaparece de la lista; sus fragmentos se borran y el asistente ya no lo cita (RN-22) | Pasa | Ejecutado por el usuario en Vercel, 2026-11-06 |  |

## Opcionales (A-16 a A-18)

La evidencia de A-16 a A-18 es de la verificación de P10 y P11 en local (servidor real, base real, Gemini real, por HTTP con una sesión real, 2026-11-06), no de Vercel. Las dos últimas columnas quedan para cuando el usuario las ejecute en producción.

| ID | Acción | Resultado esperado | Resultado en la verificación de P10 | Resultado en Vercel | Observación |
|---|---|---|---|---|---|
| A-16 | Completar una tarea con minutos; intentar completarla otra vez | Queda Completada con los minutos y la fecha de cierre; ya no muestra "Completar"; volver a completarla responde "La tarea ya está completada." | Pasa: 4 tareas completadas con 30 min cada una; repetir sobre una devolvió 409 `TAREA_YA_COMPLETADA` y sus minutos siguieron en 30 | | El botón "Completar" se verificó en el navegador en P07 |
| A-17 | Ver el índice de un día con tareas y de un día sin tareas | Con tareas: puntos (un decimal), nivel y recomendación, y el número coincide con la fórmula. Sin tareas: "Sin tareas programadas para esta fecha" | Pasa: 4 de 5 y 120 min → 86,0 Excelente (a mano: 56 + 30); 3 de 5 y 30 min → 49,5 Bajo (a mano: 42 + 7,5); día sin tareas → aviso; recomendación de Gemini en 4,6 s | | |
| A-18 | Buscar un tema en Wikipedia (por ejemplo "Sierra Nevada de Santa Marta") y guardar la fuente | Resumen breve con los artículos usados y la fuente guardada en la categoría; con 20 fuentes en la categoría, "Alcanzó el máximo de 20 fuentes en esta categoría; archive o elimine una." | Pasa: resumen de 4 frases con los artículos usados; la fila quedó en `fuentes_web` con la URL del primer artículo; con 18 fuentes de relleno, las búsquedas 19 y 20 se guardaron y la 21 respondió 409 `LIMITE_FUENTES` con el mensaje exacto | | Wikipedia y Gemini reales; el usuario probó P10 en local |
