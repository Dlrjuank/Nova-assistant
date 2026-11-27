# Ampliación completada · Nova Assistant

Fecha: 2026-11-26. Rama `ampliacion`. **Todavía no está unida con `master`:** falta la prueba del usuario (E21-2), la unión (E21-3) y el cierre (E21-4).

## Qué incluye

Etapas E00 a E20d (`doc/PROMPTS_AMPLIACION.md`), cada una probada por el usuario al cerrarla:

- Navegación, diseño nuevo con claro y oscuro, Inicio y Calendario.
- Tareas con categorías, horario, edición, recordatorios y resumen diario.
- Asistente con citas, preguntas por fecha, página y capítulo, Wikipedia, fuentes web e IA general.
- Fuentes: PDF (también escaneados), Word, PowerPoint, Markdown, texto y fotos, con OCR.
- Cuestionarios con varios tipos de pregunta, historial y repaso; plan de lectura.
- Semestre: notas, calculadora, metas, fallas, temas, plan de estudio y estadísticas.
- App instalable, consulta y creación de tareas sin conexión.
- Clave de Gemini propia, "Entrar con Google", cuentas, niveles y Administración.
- Privacidad y avisos de errores con Sentry.

## Verificación (E21-1)

- `npm test`: 1709 de 1709. Build correcto; `eslint` y `tsc` sin errores.
- `npm run db:verificar` sin fallas; M28 aplicada (también probada con el código de `master`); M27 ensayada sin cambiar la base; simulacro de restauración correcto.
- Recorrido en Edge de 32 pantallas: 24 de 24. Pruebas de Edge de las etapas recientes sin fallas, salvo la de abajo.
- Aceptación en `doc/ACEPTACION.md`: B-01 a B-116, 66 cubiertos por pruebas automáticas, 49 en parte y 1 solo en producción; A-01 a A-21, 12 cubiertos, 8 en parte y 1 sin cubrir.

## Fallas y pendientes conocidos

- **"Atrás" después de filtrar** puede dejar la lista filtrada (visto en Edge sin ventana, sobre todo en Fuentes). Tocar "Todos" funciona.
- Las pantallas y rutas anteriores a Nova (`/home`, `/dashboard`, `/status`, `/api/data`) se quitaron en `ampliacion`; en producción siguen hasta unir.
- Migración preparada sin aplicar: M27 (`supabase/pendientes/`).
- Por cambiar: la contraseña de la base y las claves de servicio, secreta y JWT de Supabase (estuvieron en referencias locales de git, ya borradas).
- Recuperar la contraseña por correo no funciona (Resend sin dominio): las salidas son Google y la contraseña temporal.

## Para unir con `master` (E21-3 y E21-4)

1. Pruebas de E21-2 sin fallas y decisiones pendientes resueltas.
2. `master` tiene un commit propio (`6ce9a4d`): el simulacro dio 3 conflictos, todos del registro; vale la versión de `ampliacion`.
3. Hay una copia de trabajo temporal que tiene `master` tomado (`git worktree list`): quitarla antes de unir.
4. Respaldo, unión, push, comprobar producción y Sentry.
5. Entre 24 y 48 horas después: M27 (`supabase/pendientes/README.md`).
6. Aviso de cada minuto a producción, revocar la omisión de la protección de Vercel, publicar la app de Google y probar con la segunda cuenta (`PROMPTS_AMPLIACION.md`, E21).
