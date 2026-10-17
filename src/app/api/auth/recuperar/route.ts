import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enviarCorreo } from '@/lib/correo';
import {
  buscarUsuarioPorEmail,
  contarSolicitudesDeUsuario,
  crearTokenRecuperacion,
  invalidarTokensPendientes,
} from '@/lib/dataService';
import { plantillaRecuperacion } from '@/lib/plantillasCorreo';
import { calcularHashToken, generarToken } from '@/lib/tokenRecuperacion';
import { obtenerUrlBase } from '@/lib/urlBase';

const esquemaRecuperacion = z.object({
  email: z.string().trim().pipe(z.email().max(254)),
});

const mensajePublico =
  'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo de la solicitud no es válido.' }, { status: 400 });
  }

  const resultadoValidacion = esquemaRecuperacion.safeParse(body);
  if (!resultadoValidacion.success) {
    return NextResponse.json({ error: 'Ingresa un correo electrónico válido.' }, { status: 400 });
  }

  let etapa = 'buscar cuenta';
  try {
    const usuario = await buscarUsuarioPorEmail(resultadoValidacion.data.email);
    if (!usuario?.email) {
      console.info('Recuperación de contraseña: no se encontró una cuenta con ese correo.');
    } else {
      etapa = 'contar solicitudes';
      const solicitudes = await contarSolicitudesDeUsuario(usuario.id);
      if (solicitudes >= 3) {
        console.info('Recuperación de contraseña: se alcanzó el límite temporal de solicitudes.');
      } else {
        etapa = 'invalidar enlaces anteriores';
        await invalidarTokensPendientes(usuario.id);

        const token = generarToken();
        etapa = 'guardar enlace de recuperación';
        await crearTokenRecuperacion(
          usuario.id,
          calcularHashToken(token),
          new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        );

        const enlace = `${obtenerUrlBase()}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
        etapa = 'enviar correo por Resend';
        const resultadoCorreo = await enviarCorreo({
          para: usuario.email,
          asunto: 'Restablecer contraseña',
          html: plantillaRecuperacion(enlace),
        });

        if (!resultadoCorreo.ok) {
          etapa = 'invalidar enlace cuyo correo no se envió';
          await invalidarTokensPendientes(usuario.id);
          console.error('Recuperación de contraseña: falló el envío por Resend.');
        }
      }
    }
  } catch {
    console.error(`Recuperación de contraseña: error durante la etapa "${etapa}".`);
  }

  return NextResponse.json({ mensaje: mensajePublico }, { status: 200 });
}
