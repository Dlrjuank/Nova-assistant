---
name: cierre-etapa
description: Cierra una etapa de la ampliación de Nova (E20d-3, E21…) o un ajuste: documentos al día, resumen y lista de prueba. Úsala cuando termines de programar y verificar una etapa, y otra vez cuando el usuario confirme que la probó sin fallas.
---

# Cierre de etapa en Nova

## Al terminar de programar

1. **`doc/ESTADO_EJECUCION.md`:** fila nueva o actualizada en la tabla (estado, build, pruebas con números, fecha) y una sección en la bitácora con el mismo formato de las anteriores: código, decisiones, pruebas (`npm test` N de N, eslint, build, Edge X de X) y "Sin probar aquí".
2. **Plan o prompt** (`doc/PLAN_AMPLIACION.md` / `doc/PROMPTS_AMPLIACION.md`): "Cómo quedó" con lo que cambió respecto a lo planeado.
3. **`CLAUDE.md`:** actualiza solo la sección "Estado actual" (etapa, qué falta, qué debe probar el usuario). El detalle va en `ESTADO_EJECUCION.md`, no en `CLAUDE.md`.
4. El agente **documentador** puede hacer los pasos 1 a 3 en paralelo si le das el resumen completo.
5. Mensaje al usuario: resumen corto + lista con la skill **prueba-corta**. No hagas commit salvo que lo pida.

## Cuando el usuario confirma la prueba

6. Marca la etapa como terminada en los tres documentos, con la fecha y "probada por el usuario sin fallas" (o lo que haya reportado).
7. Si reportó fallas: corrígelas, anótalas como corrección dentro de la misma etapa y pide solo la prueba de lo corregido.
8. Si el usuario pide commit: un commit por etapa o parte, mensaje en español con el formato `feat(área): descripción (E20d-3)`. Nunca incluyas `doc/PRESENTACION_AMPLIACION.md`, `doc/CORREO RESEND VERCEL CONNECT (1).md`, `.env*` ni `respaldos/`.
