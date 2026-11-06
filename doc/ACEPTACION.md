# Aceptación del MVP · Nova Assistant

Casos de la sección 17.3 de `doc/PLAN_NOVA.md`. Se ejecutan en el despliegue de Vercel (https://nova-assistantsm-kappa.vercel.app) con la cuenta admin, no en local. Las tres últimas columnas se llenan al ejecutarlos.

- **Resultado obtenido:** lo que mostró la aplicación.
- **Evidencia:** captura, hora o texto copiado de la pantalla.
- **Observación:** cualquier diferencia con lo esperado.

Fecha de ejecución:

## Casos A-01 a A-15

| ID | Acción | Resultado esperado | Resultado obtenido | Evidencia | Observación |
|---|---|---|---|---|---|
| A-01 | Abrir `/nova` sin sesión | Redirección al login | | | |
| A-02 | Registrar una tarea con título, categoría, prioridad 3 y fecha válida | Creada, estado Pendiente | | | |
| A-03 | Registrar una tarea con prioridad 5 | Rechazo: "La prioridad debe ser 1, 2 o 3" | | | |
| A-04 | Registrar una tarea con fecha "2026-02-30" | Rechazo por fecha inválida | | | |
| A-05 | Registrar una tarea sin prioridad | Queda con prioridad 2 | | | |
| A-06 | Indexar un PDF con texto (≤ 15 MB) | Confirma el número de fragmentos | | | |
| A-07 | Intentar indexar un PDF escaneado (sin texto) | "El documento no contiene texto seleccionable (no se admite OCR)" | | | |
| A-08 | Intentar indexar un archivo mayor a 15 MB | "El documento supera el límite permitido de 15 MB" | | | |
| A-09 | Preguntar "Agenda" (1 palabra) | "La instrucción es demasiado corta" | | | |
| A-10 | Preguntar algo cuya respuesta está en el PDF | Responde correctamente y cita el PDF y el fragmento | | | |
| A-11 | Preguntar algo que no está en ningún PDF | "No encontré esto en tus documentos" | | | |
| A-12 | Preguntar "¿qué tareas tengo pendientes?" | Incluye las tareas pendientes en la respuesta, citadas como fuente | | | |
| A-13 | En una cuenta sin PDF indexados, preguntar | Avisa que primero debe indexar un documento | | | |
| A-14 | Criterio del plan: con 3 PDF reales, de 10 preguntas con respuesta en los documentos, acierta y cita bien en al menos 7 | Se registra el conteo | | | |
| A-15 | Cerrar el navegador y volver a entrar | Las tareas, los documentos y la conversación del Asistente persisten | | | |

Notas para ejecutarlos:

- **A-03:** el formulario solo ofrece prioridades 1, 2 y 3. Para ver el rechazo con el mensaje exacto se necesita llamar a la API directamente (`POST /api/nova/tareas` con `prioridad: 5`); la prueba automática `tests/servidor/rutas-nova.test.ts` también lo cubre.
- **A-04:** con la máscara se escribe `20260230`; al salir del campo aparece "La fecha debe tener formato AAAA-MM-DD y ser una fecha real."
- **A-05:** el formulario arranca con prioridad 2. La API asigna 2 cuando el campo no se envía; lo cubren `tests/reglas/tarea.test.ts` y `npm run probar:rag`.
- **A-13:** los documentos no tienen dueño (plan, sección 3.4): "una cuenta sin PDF" significa una base sin documentos. Se ejecuta antes de indexar, o después de eliminar todos los documentos.

## A-14 · Criterio del plan

Con 3 PDF reales (con texto seleccionable, no escaneados), hacer 10 preguntas cuya respuesta se conoce y está en los documentos. Una pregunta cuenta como acierto si la respuesta es correcta **y** la fuente citada es el PDF donde está el dato. Se aprueba con al menos 7 aciertos.

PDF usados:

1.
2.
3.

| # | Pregunta | Respuesta esperada | PDF donde está | Respuesta de Nova | Fuente citada | ¿Acierta y cita bien? |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| 6 | | | | | | |
| 7 | | | | | | |
| 8 | | | | | | |
| 9 | | | | | | |
| 10 | | | | | | |

**Conteo:** __ de 10. **Resultado:** aprobado (≥ 7) / no aprobado.

## Ampliaciones pedidas por el usuario (A-19 a A-21)

No estaban en el plan funcional; se agregaron tras P08.

| ID | Acción | Resultado esperado | Resultado obtenido | Evidencia | Observación |
|---|---|---|---|---|---|
| A-19 | Preguntar por una lista del PDF y luego "¿y el segundo?" | Responde el segundo elemento y cita el PDF (RN-21) | | | |
| A-20 | Salir del Asistente (por ejemplo a Tareas) y volver; luego pulsar "Conversación nueva" | La conversación sigue al volver; con "Conversación nueva" la pantalla queda vacía y la anterior se conserva en la base (RN-20) | | | |
| A-21 | Eliminar un documento desde Documentos, confirmando | Desaparece de la lista; sus fragmentos se borran y el asistente ya no lo cita (RN-22) | | | |

## Opcionales (A-16 a A-18)

A-16 (completar una tarea con minutos), A-17 (índice de productividad de un día, y el aviso en un día sin tareas) y A-18 (buscar en Wikipedia y guardar la fuente) corresponden a las funcionalidades opcionales y se verifican tras P10 y P11. Completar tarea ya existe desde P07, así que A-16 se puede ejecutar desde ahora.
