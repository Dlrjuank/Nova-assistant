# Fase 7 completada · Nova Assistant

Fecha de cierre: 2026-11-06

Funcionalidades opcionales (P10 y P11). Con esta fase quedan construidas todas las funcionalidades del plan.

## Qué incluye

- **F5 · Completar tarea:** hecho en P07 a pedido del usuario (minutos, fecha de cierre, sin repetir).
- **F6 · Índice de productividad (P10):** `/nova/productividad`. Fórmula de la sección 9.1 con redondeo hacia abajo, aviso "Sin tareas programadas para esta fecha" y recomendación de Gemini; si Gemini falla, el índice se muestra igual.
- **F4 · Búsqueda en Wikipedia (P11):** `/nova/web`. Busca en Wikipedia en español, resume los 3 primeros artículos con Gemini y guarda la fuente en `fuentes_web` (máximo 20 por categoría, RN-05).

## Verificación

- `npm test`: 240 de 240. `npm run build` correcto; `eslint` sin errores ni avisos.
- P10, por HTTP con sesión real, base y Gemini reales: 12 de 12. 4 de 5 con 120 min → 86,0 Excelente; 3 de 5 con 30 min → 49,5 Bajo; día sin tareas y "ya completada" correctos. El usuario lo probó en local.
- P11, por HTTP con sesión real, base, Wikipedia y Gemini reales: 13 de 13. Resumen y fuente guardada; consulta corta 422; sin resultados no guarda; fuentes 19 y 20 guardadas y la 21 rechazada con `LIMITE_FUENTES` (409), sin pasar de 20.
- Edge no arrancó durante esta fase (actualización pendiente con el navegador abierto), así que la interfaz de P10 y P11 se verificó con las pruebas de jsdom y no en un navegador real.

## Sin verificar

- A-16, A-17 y A-18 en Vercel (se registran en `doc/ACEPTACION.md`).
- La interfaz de Productividad y Web en un navegador real por parte de Claude.
