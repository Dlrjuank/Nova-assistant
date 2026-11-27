# Nova Assistant · Instrucciones para agentes de código

Este archivo es para cualquier asistente de código (Antigravity, Gemini CLI, GitHub Copilot, Codex…). Las reglas completas del proyecto están en [`CLAUDE.md`](CLAUDE.md): **léelo entero antes de hacer nada**. Lo más importante está resumido aquí.

## Antes de empezar

1. Lee `CLAUDE.md` (estado actual, reglas y trampas conocidas).
2. Si la tarea es publicar o unir con `master`, sigue [`doc/PASOS_27_DICIEMBRE.md`](doc/PASOS_27_DICIEMBRE.md) paso por paso.
3. El avance de cada etapa está en `doc/ESTADO_EJECUCION.md`; el plan, en `doc/PLAN_AMPLIACION.md`.

## Reglas que no se rompen

- **Pregunta antes** de cada commit, push, unión con `master` o migración. El usuario decide; no lo hagas por tu cuenta.
- **Una sola base de datos** para producción y la vista previa. Toda migración sigue `.claude/skills/migracion-segura/SKILL.md`: respaldo, `db:migrar`, `db:verificar`, prueba con el código de `master` y simulacro de restauración. Nunca apliques migraciones con otra herramienta que no sean los scripts del proyecto.
- **Nunca muestres, copies ni subas** `.env.local` ni `.env.respaldo.local`. El repositorio es **público**: ninguna clave ni contraseña va en un commit (tampoco la de la cuenta de prueba).
- `doc/PRESENTACION_AMPLIACION.md` y `doc/CORREO RESEND VERCEL CONNECT (1).md` nunca van en un commit.
- **Cuota de Gemini compartida con producción:** no repitas pruebas que llaman a Gemini (`probar:rag`, preguntas al Asistente, indexar) ni las corras en paralelo.
- Sobre producción, **solo lectura** salvo que el usuario pida otra cosa.

## Cómo trabajar en esta máquina (Windows)

- PowerShell bloquea `npm.ps1`: usa `npm.cmd` y `npx.cmd`.
- Pruebas: `npm.cmd test`, `npm.cmd run type-check`, `npm.cmd run lint`, `npm.cmd run build`.
- Servidor local: `npx.cmd next dev` (no `npm run dev`, que reescribe `.env.local`). `next build` rompe un `next dev` que esté corriendo.
- Código en `src/` (alias `@/*`); documentos en `doc/`.

## Estilo

- Toda la app y los textos van en español con **tuteo**.
- Sin librerías de animación (solo CSS). Los componentes de Nova usan solo los colores `--nova-*`.
- Todo lo que guarda datos llama a `router.refresh()`.
- Al terminar un cambio: resume qué hiciste y da al usuario una lista corta de qué probar.
