---
name: migracion-segura
description: Pasos obligatorios para crear y aplicar una migración de base de datos en Nova (Supabase compartido entre producción y la rama ampliacion). Úsala siempre antes de tocar el esquema: tablas, columnas, índices, funciones, RLS, pg_cron.
---

# Migración segura en Nova

La base es **una sola** para producción (`master`) y la vista previa (`ampliacion`). Un error rompe producción.

## Antes

1. Escribe la migración en `supabase/migrations/AAAAMMDDHHMMSS_nova_<nombre>.sql` y anótala en el plan (`doc/PLAN_AMPLIACION.md`) con su número (M27, M28…).
2. Debe ser **compatible con el código de `master`**: agrega, no quita ni renombra lo que `master` usa. Los cambios destructivos esperan a E21 (unión con `master`).
3. Nada de `SET parametro` en la definición de funciones (permiso denegado en Supabase): usa `set_config(..., true)` dentro.
4. Tablas nuevas: con `usuario_id`, RLS y, si guardan datos del usuario, agregadas a la lista de respaldo de `scripts/respaldo.mjs`.
5. **Respaldo:** `npm.cmd run db:respaldar` (queda en `respaldos/`, ignorada por git; nunca en un commit).

## Aplicar

6. `npm.cmd run db:migrar` (usa `NOVAASSISTANT_POSTGRES_URL_NON_POOLING`). No uses el MCP de Supabase para aplicar migraciones: el registro de migraciones del proyecto lo lleva el script.

## Después

7. Agrega la verificación de la migración en `scripts/verificar-bd.mjs` y corre `npm.cmd run db:verificar`.
8. Prueba el código de `master` contra la base migrada desde un `git worktree` temporal: `db:verificar` y `probar:rag` sin fallas. Borra el worktree al terminar.
9. Segundo respaldo y simulacro de restauración: `npm.cmd run db:restaurar -- respaldos/<carpeta> --probar` con los dos respaldos.
10. Anota en `doc/ESTADO_EJECUCION.md`: carpetas de los respaldos, archivo aplicado y resultados.

## Si algo sale mal

`npm.cmd run db:restaurar -- respaldos/<carpeta> --confirmar` restaura el respaldo de antes. Avísale al usuario antes de restaurar.
