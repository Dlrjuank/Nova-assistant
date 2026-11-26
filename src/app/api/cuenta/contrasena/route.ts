import { z } from 'zod';
import { obtenerSesion } from '@/lib/auth/sesion';
import { terminarCambioContrasena } from '@/lib/datos/contrasenas';
import { accesoDe } from '@/lib/datos/cuentas';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { TEXTO_CONTRASENA_ACTUAL, validarContrasenaNueva } from '@/lib/reglas/cuentas';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const esquema = z.object({ actual: z.string().max(128).optional(), nueva: z.string().max(200), confirmar: z.string().max(200) }).strict();

/**
 * E20c-3: poner una contraseña propia. Fuera de /api/nova para que la cuenta que entró con la contraseña temporal
 * (RB-91, `DEBE_CAMBIAR_CONTRASENA`) pueda usarla. No pide la anterior si la sesión entró con la temporal o con
 * Google (plan 5.14, salida a); si no, la verifica.
 */
export const POST = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await obtenerSesion();
  if (!sesion) throw new ErrorDeNegocio('NO_AUTORIZADO');
  const acceso = await accesoDe(sesion);
  const debeCambiar = !acceso.permitido && acceso.codigo === 'DEBE_CAMBIAR_CONTRASENA';
  if (!acceso.permitido && !debeCambiar) throw new ErrorDeNegocio(acceso.codigo);
  const { actual, nueva, confirmar } = await leerCuerpo(peticion, esquema);
  const invalida = validarContrasenaNueva(nueva, confirmar);
  if (invalida) throw new ErrorDeNegocio('DATOS_INVALIDOS', invalida);

  const supabase = await createSupabaseServerClient();
  if (!debeCambiar && !sesion.conGoogle) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: sesion.email, password: actual ?? '' });
    if (error || data.user?.id !== sesion.id) throw new ErrorDeNegocio('DATOS_INVALIDOS', TEXTO_CONTRASENA_ACTUAL);
  }
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) {
    if (error.code === 'same_password') throw new ErrorDeNegocio('DATOS_INVALIDOS', 'La nueva contraseña debe ser diferente de la actual.');
    if (error.code === 'reauthentication_needed') throw new ErrorDeNegocio('DATOS_INVALIDOS', 'Por seguridad, vuelve a entrar y repite el cambio.');
    if (error.code === 'weak_password') throw new ErrorDeNegocio('DATOS_INVALIDOS', 'Esa contraseña es muy fácil de adivinar. Prueba con otra.');
    console.error('Supabase rechazó el cambio de contraseña:', error.code ?? error.message);
    throw new ErrorDeNegocio('ERROR_INTERNO');
  }
  await terminarCambioContrasena(sesion.id);
  return responderOk({ listo: true });
});
