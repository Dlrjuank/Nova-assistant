# Fase 4 completada · Nova Assistant

Fecha de cierre: 2026-11-05

Datos (P04) y API (P05) del MVP. `npm run build` correcto y `npm test` 124/124.

## `npm run probar:rag` (P04)

0 fallas: tarea válida y errores de prioridad y fecha, token de subida que rechaza lo que no es PDF, subida real a Vercel Blob, indexación (3 fragmentos de 768 dimensiones), borrado del PDF de Blob, consulta corta, dato presente (con cita), tareas pendientes (con cita) y dato ausente ("No encontré esto en tus documentos"). Detalle en la bitácora.

## Verificación de la API (P05)

Con `next dev` y dos usuarios temporales, ya borrados. Se comprobó:

- Sin sesión, 401 en todas las rutas de `/api/nova` (verificado en P03 y en tests).
- Cuenta fuera de la lista de acceso: 403 `ACCESO_DENEGADO` en las 6 rutas y redirección de `/nova` a `/home`.
- Cuenta en la lista: tarea con prioridad 5 → 422 "La prioridad debe ser 1, 2 o 3"; consulta "Agenda" → 422 "La instrucción es demasiado corta"; tarea válida → 201; flujo de subida, indexación y tres consultas reales.

## Sin verificar

- Subida desde el navegador (P07) y el despliegue en Vercel con estas rutas.
