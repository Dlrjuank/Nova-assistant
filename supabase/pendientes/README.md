# Migraciones pendientes

Aquí esperan las migraciones que **todavía no se deben aplicar**: `npm run db:migrar` aplica todo lo que haya en `supabase/migrations/`.

## M27 · `20261128100000_nova_quitar_dueno_por_defecto.sql`

**Cuándo:** entre 24 y 48 horas después de unir `ampliacion` con `master`, con producción funcionando. Nunca antes: el código anterior no puede guardar tareas, documentos ni fuentes después de M27.

1. Comprobar que producción tiene el código nuevo y no muestra errores (Vercel y Sentry).
2. `npm.cmd run db:respaldar`
3. `node scripts/m27.mjs --ensayo` (no cambia nada) sin fallas.
4. `git mv supabase/pendientes/20261128100000_nova_quitar_dueno_por_defecto.sql supabase/migrations/`
5. `npm.cmd run db:migrar`
6. `npm.cmd run db:verificar` y `npm.cmd run probar:rag` sin fallas (el segundo usa la cuota de Gemini: una sola vez).
7. Segundo respaldo y `npm.cmd run db:restaurar -- respaldos/<carpeta> --probar` con ese respaldo nuevo.
8. Anotar en `doc/ESTADO_EJECUCION.md` y hacer commit del movimiento del archivo.

**Si hay que volver al código anterior** (Instant Rollback a un despliegue de antes de la unión): primero `node scripts/m27.mjs --revertir --confirmar`, luego mover el archivo de vuelta aquí.

**Respaldos de antes de M27:** traen `nova_config`; la restauración la omite si la tabla ya no existe.

## M29 · `20261128120000_nova_tick_solo_con_trabajo.sql`

El aviso de cada minuto llama a la app solo si hay recordatorios, resúmenes, libros, preguntas del OCR o contraseñas temporales que atender (ahorro de CPU en Vercel). Es compatible con el código de `master`. **Espera la aprobación del usuario.** Si cambia una de esas condiciones en el código, hay que cambiarla también en la función `nova_hay_trabajo_tick`.

1. `npm.cmd run db:respaldar`
2. `node scripts/m29.mjs --ensayo` (no cambia nada ni envía llamadas) sin fallas.
3. `git mv supabase/pendientes/20261128120000_nova_tick_solo_con_trabajo.sql supabase/migrations/`
4. `npm.cmd run db:migrar`
5. `npm.cmd run db:verificar` sin fallas; con el código de `master`, `db:verificar` y `probar:rag` (cuota de Gemini: una sola vez).
6. Segundo respaldo y simulacro de restauración de los dos.
7. Anotar en `doc/ESTADO_EJECUCION.md` y hacer commit del movimiento del archivo.

**Reverso:** `node scripts/m29.mjs --revertir --confirmar` y mover el archivo de vuelta aquí.
