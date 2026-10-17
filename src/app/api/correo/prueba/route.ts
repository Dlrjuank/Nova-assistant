import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enviarCorreo } from '@/lib/correo';

const correoPruebaSchema = z.object({
  para: z.string().trim().pipe(z.email()),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo de la solicitud no es válido.' }, { status: 400 });
  }

  const resultadoValidacion = correoPruebaSchema.safeParse(body);
  if (!resultadoValidacion.success) {
    return NextResponse.json({ error: 'Ingresa un correo electrónico válido.' }, { status: 400 });
  }

  const resultado = await enviarCorreo({
    para: resultadoValidacion.data.para,
    asunto: 'Prueba de correo',
    html: '<h1>Correo de prueba</h1><p>El envío de correo de NovaAssistant funciona correctamente.</p>',
  });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: resultado.id }, { status: 200 });
}
