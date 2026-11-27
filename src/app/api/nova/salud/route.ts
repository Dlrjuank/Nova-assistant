import { NextResponse } from 'next/server';
import { comprobarBase } from '@/lib/dataService';
import { conManejoDeErrores, responderOk } from '@/lib/http/respuestas';
import { secretoValido } from '@/lib/http/secreto';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * E21 (plan 6.12 y 13): el cron diario de Vercel (vercel.json), independiente de la base. No usa sesión (el
 * middleware lo deja pasar): Vercel manda `Authorization: Bearer <CRON_SECRET>`. Solo hace una consulta mínima y
 * no devuelve datos; si la base no responde, el error llega a Sentry.
 */
export const GET = conManejoDeErrores(async (peticion: Request) => {
  const esperado = process.env.CRON_SECRET;
  if (!secretoValido(peticion.headers.get('authorization'), esperado ? `Bearer ${esperado}` : undefined)) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  await comprobarBase();
  return responderOk({ base: 'ok' });
});
