# Fase 6 completada · Nova Assistant

Fecha de cierre: 2026-11-06

Revisión de calidad y preparación de la aceptación del MVP (P09). La ejecución de los casos A-01 a A-15 en producción queda a cargo del usuario y se registra en `doc/ACEPTACION.md`.

## Pruebas

- `npm test`: 210 de 210.
- `npm run probar:rag` (base, Blob y Gemini reales): 0 fallas, incluido el paso 9 (`SIN_DOCUMENTOS` con la base vacía).
- `npm run build` correcto; `eslint` sin errores. `tsc` mantiene los 2 errores previos de `src/lib/__tests__/json-db.test.ts` (código anterior a Nova, sin tocar).

## Revisión contra las secciones 10.3 y 16 del plan

| Punto | Resultado |
|---|---|
| Mensajes de la sección 5.1 | Coinciden textualmente en `lib/reglas/errores.ts` y `lib/llm/prompts.ts` |
| Reglas sin red ni base | `lib/reglas` solo importa `lib/config/nova` y otros módulos de reglas; `fechas.ts` es la única que usa el reloj |
| Gemini aislado en `lib/llm` | Solo `lib/llm` importa `@google/genai`; fuera de él solo hay comentarios y los nombres de modelo en `lib/config/nova.ts`, como indica la sección 10.4 |
| Clave de Gemini fuera del repositorio | Ningún archivo versionado tiene claves ni cadenas de conexión con contraseña; `.env.local` y `.env.respaldo.local` están ignorados por `.env*.local`; `.env.example` solo tiene nombres o valores de ejemplo |
| Rutas con `exigirSesion` | Las 9 rutas de `/api/nova` lo llaman |
| Tamaño del PDF en el servidor | `validarTamanoPdf` se aplica a los bytes descargados, además del navegador y del token de subida |
| Vectores como parámetro | `$1::vector` y `unnest($4::text[])` con `::vector`; nada concatenado |
| Textos en español | No se encontraron textos en inglés en la interfaz de Nova |
| Estado no solo con color | Prioridad, estado, avisos y burbujas del chat llevan texto |

## Corregido en esta fase

- **Citas de tareas con el índice interno:** en `probar:rag` el modelo citó `[Tarea T1]` (el índice que ponía `construirContexto`) en lugar de la etiqueta real. `armarFuentes` no lo reconocía y devolvía todas las fuentes. Ahora cada fuente del contexto se encabeza solo con su etiqueta citable; hay una prueba nueva y el paso 7 de `probar:rag` exige que las fuentes sean solo tareas.
- `.env.example` incluye los nombres de las variables de Nova, sin valores.

## Pendiente del usuario

- Ejecutar A-01 a A-15 (más A-19 a A-21) en https://nova-assistantsm-kappa.vercel.app.
- A-14: indexar 3 PDF reales y comprobar que de 10 preguntas con respuesta conocida acierta y cita bien en al menos 7.
