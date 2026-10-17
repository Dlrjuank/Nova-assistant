import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  actualizarContrasena,
  buscarTokenVigentePorHash,
  invalidarTokensPendientes,
  marcarTokenComoUsado,
} from '@/lib/dataService';
import { calcularHashToken } from '@/lib/tokenRecuperacion';

const esquemaRestablecimiento = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/i),
    contrasena: z.string().min(8).max(128),
    confirmacion: z.string().min(8).max(128),
  })
  .refine((datos) => datos.contrasena === datos.confirmacion, {
    path: ['confirmacion'],
  });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo de la solicitud no es válido.' }, { status: 400 });
  }

  const resultadoValidacion = esquemaRestablecimiento.safeParse(body);
  if (!resultadoValidacion.success) {
    return NextResponse.json(
      {
        error:
          'Revisa el enlace y asegúrate de que las contraseñas coincidan y tengan al menos 8 caracteres.',
      },
      { status: 400 },
    );
  }

  try {
    const token = await buscarTokenVigentePorHash(
      calcularHashToken(resultadoValidacion.data.token),
    );
    if (!token) {
      return NextResponse.json({ error: 'El enlace no es válido o ya venció.' }, { status: 400 });
    }

    if (!(await marcarTokenComoUsado(token.id))) {
      return NextResponse.json({ error: 'El enlace no es válido o ya venció.' }, { status: 400 });
    }

    await actualizarContrasena(token.usuario_id, resultadoValidacion.data.contrasena);
    await invalidarTokensPendientes(token.usuario_id, token.id);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    console.error('No se pudo completar el restablecimiento de contraseña.');
    return NextResponse.json(
      { error: 'No se pudo cambiar la contraseña. Solicita un nuevo enlace e inténtalo de nuevo.' },
      { status: 500 },
    );
  }
}
