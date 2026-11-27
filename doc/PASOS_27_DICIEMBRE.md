# Pasos para cuando vuelva Vercel (27 de diciembre de 2026)

Guía para hacerlo **a mano**, sin depender de un asistente. Cada paso dice qué ejecutar, qué debe salir y qué hacer si falla. Si usas un agente (Antigravity, Gemini CLI, Copilot…), pídele que lea primero `AGENTS.md` y esta guía, y que vaya paso por paso preguntándote antes de cada push o migración.

Reglas mientras sigues la guía:

- Los comandos son de **PowerShell**, en la carpeta del proyecto (`cd "C:\Users\juand\OneDrive\Documents\logica y programacion\NovaAssistant"`). Usa `npm.cmd`, no `npm` (PowerShell bloquea `npm.ps1`).
- **Una sola base** para producción y la vista previa: no saltes los respaldos.
- **Nunca** muestres ni subas `.env.local` ni `.env.respaldo.local`.
- Si un paso falla y no sabes por qué, **detente**: no sigas con el siguiente.

---

## 0. Antes del 27 (si aún no se hizo)

### 0.1 M29: el aviso de cada minuto solo llama si hay trabajo

Ahorra CPU en Vercel; sin esto puede volver a pausarse la cuenta. Es compatible con el código de `master`.

```powershell
npm.cmd run db:respaldar
node scripts/m29.mjs --ensayo
```

El ensayo no cambia nada y debe terminar sin fallas. Si pasa:

```powershell
git mv supabase/pendientes/20261128120000_nova_tick_solo_con_trabajo.sql supabase/migrations/
npm.cmd run db:migrar
npm.cmd run db:verificar
npm.cmd run db:respaldar
```

Simulacro de restauración con la carpeta del último respaldo (la ves en `respaldos/`):

```powershell
npm.cmd run db:restaurar -- respaldos/<carpeta> --probar
```

Si algo sale mal: `node scripts/m29.mjs --revertir --confirmar` y mueve el archivo de vuelta a `supabase/pendientes/`. Al terminar, commit del movimiento: `git commit -am "chore(db): aplicar M29"`.

### 0.2 Cambiar las claves que se filtraron en git (solo en tu PC, no en GitHub)

Contraseña de la base, `NOVAASSISTANT_SUPABASE_SERVICE_ROLE_KEY`, `NOVAASSISTANT_SUPABASE_SECRET_KEY` y `NOVAASSISTANT_SUPABASE_JWT_SECRET`.

1. Supabase → **Project Settings → Database → Reset database password**. Guarda la nueva en un lugar seguro.
2. Supabase → **Project Settings → API Keys**: crea una clave secreta nueva y revoca la anterior. Cambiar el JWT secret cierra todas las sesiones: hazlo al final.
3. Actualiza esas variables (y las tres URL de Postgres que llevan la contraseña: `..._POSTGRES_URL`, `..._URL_NON_POOLING`, `..._PRISMA_URL`) en `.env.local`, en `.env.respaldo.local` y en **Vercel → Settings → Environment Variables** (Production y Preview). Si Vercel no deja editarlas mientras está pausado, hazlo como primer paso del día 27.
4. Comprueba: `npm.cmd run db:verificar` debe pasar.
5. Vacía la papelera de OneDrive.

---

## 1. Variables en Vercel (lo primero el 27)

Si en el paso 0.2 no pudiste cambiarlas en Vercel, hazlo ahora en Production y Preview. Con las claves viejas, producción no funciona.

Revisa también **Vercel → Settings → Git → Production Branch = `master`** (en GitHub la rama principal es `ampliacion` por la entrega; Vercel debe seguir publicando `master`).

## 2. Push de `ampliacion` y prueba en la vista previa

```powershell
git status
git push origin ampliacion
```

Espera en Vercel → Deployments a que la vista previa quede **Ready**. Prueba en https://nova-assistant-git-ampliacion-dlrjuank.vercel.app:

- Entrar con Google; Inicio, Tareas y Fuentes cargan.
- Una pregunta al Asistente (una sola: gasta cuota de Gemini).
- Subir un documento pequeño.
- Bloquear la segunda cuenta con su sesión abierta y recargar → "Cuenta bloqueada". Desbloquearla.
- Modo avión y de vuelta → desaparece "Sin conexión".

Si algo falla, **no sigas**: anota el error (Sentry: https://juank-ing.sentry.io/issues/?project=nova-assistant).

## 3. Unir `ampliacion` con `master`

```powershell
git worktree list
```

Si aparece una copia de trabajo temporal con `[master]`, quítala (cambia la ruta por la que aparezca):

```powershell
git worktree remove --force "<ruta de la copia con master>"
git worktree prune
```

Respaldo y unión:

```powershell
npm.cmd run db:respaldar
git checkout master
git pull origin master
git merge ampliacion
```

Habrá **3 conflictos** (todos del registro de cuentas). En todos vale la versión de `ampliacion`:

```powershell
git diff --name-only --diff-filter=U
```

Para cada archivo que salga:

```powershell
git checkout --theirs -- "<archivo>"
git add "<archivo>"
```

Y borra el archivo que sobra:

```powershell
git rm src/lib/auth/registro.ts
```

Comprueba antes del commit (todo debe pasar):

```powershell
npm.cmd test
npm.cmd run type-check
npm.cmd run lint
npm.cmd run build
```

Si pasa:

```powershell
git commit -m "E21-3: unir la ampliación con master"
git push origin master
```

Esto publica la Nova nueva en producción. **Anota la hora**: M27 va entre 24 y 48 horas después.

Si `build` o las pruebas fallan, no hagas push: `git merge --abort` (antes del commit) y vuelve a `ampliacion` con `git checkout ampliacion`.

## 4. Comprobar producción

En https://novaassistantjc.vercel.app:

- Entrar (con Google o correo).
- `/privacidad` abre sin iniciar sesión.
- Sentry y Vercel → Logs sin errores nuevos.
- Al día siguiente, en Vercel → Crons, que `GET /api/nova/salud` corrió.

## 5. Aviso de cada minuto a producción

1. En `.env.local`, cambia `NOVA_TICK_URL` a `https://novaassistantjc.vercel.app/api/nova/recordatorios/tick` y quita la línea `VERCEL_AUTOMATION_BYPASS_SECRET`.
2. Ejecuta:

```powershell
npm.cmd run db:configurar-tick
```

3. En Vercel → Settings → Deployment Protection, revoca la omisión de protección (Protection Bypass for Automation).
4. Comprueba en Supabase → SQL Editor:

```sql
select status_code, created from net._http_response order by created desc limit 10;
```

Deben salir respuestas `200` (con M29 aplicada, solo cuando hay recordatorios u otro trabajo).

## 6. Reinstalar la app y las notificaciones

En cada teléfono y computador: abrir la dirección de producción, instalar la app de nuevo y volver a activar las notificaciones (las suscripciones son por dirección). Probar con Configuración → "Enviar una de prueba".

## 7. Cambiar el token de Blob

Vercel → Storage → tu Blob → rotar `BLOB_READ_WRITE_TOKEN`. Actualízalo en Vercel (Production y Preview) y en `.env.local`. Vuelve a desplegar producción (Deployments → el último → Redeploy) y comprueba que subir un documento funciona.

## 8. Publicar la app de Google

Google Cloud → **Google Auth Platform**:

- Página principal: `https://novaassistantjc.vercel.app`; privacidad: `https://novaassistantjc.vercel.app/privacidad`.
- Dominios autorizados: `novaassistantjc.vercel.app`.
- **Publicar app**.

En Supabase → Authentication → Providers, comprueba que Google sigue activo. Prueba entrar con la segunda cuenta.

## 9. Limpiar

- Supabase → Authentication → URL Configuration → quita de Redirect URLs las direcciones `trycloudflare.com`.
- GitHub → Settings → Default branch → vuelve a `master` (ya tiene todo).
- Si ya no la necesitas, elimina la cuenta de prueba del profesor desde Administración.

## 10. M27 (entre 24 y 48 horas después de unir)

Solo si producción funciona sin errores.

```powershell
npm.cmd run db:respaldar
node scripts/m27.mjs --ensayo
```

Sin fallas en el ensayo:

```powershell
git mv supabase/pendientes/20261128100000_nova_quitar_dueno_por_defecto.sql supabase/migrations/
npm.cmd run db:migrar
npm.cmd run db:verificar
npm.cmd run probar:rag
npm.cmd run db:respaldar
npm.cmd run db:restaurar -- respaldos/<carpeta del último respaldo> --probar
git commit -am "chore(db): aplicar M27"
git push origin master
```

`probar:rag` gasta cuota de Gemini: córrelo una sola vez.

**Si hay que volver al código anterior** (Vercel → Instant Rollback a un despliegue de antes de la unión): primero `node scripts/m27.mjs --revertir --confirmar` y mueve el archivo de vuelta a `supabase/pendientes/`.

## Con esto, E21 queda cerrada

Anota en `doc/ESTADO_EJECUCION.md` qué hiciste, las carpetas de los respaldos y los resultados, y en `CLAUDE.md` (Estado actual) que E21 terminó.

## Para no volver a pasarte del plan gratis de Vercel

- Revisa **Vercel → Usage** cada semana; si a mitad de mes pasas del 50 % de CPU, frena las pruebas en la vista previa.
- Prueba en tu PC (`npx.cmd next dev`) siempre que puedas.
- Nada que corra cada minuto en Vercel sin filtrar antes en la base (eso hace M29).
