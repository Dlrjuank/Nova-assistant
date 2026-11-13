import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { avanzarLibroEnSegundoPlano, procesarRecordatorios } from '@/lib/dataService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Compara el secreto sin revelar por el tiempo cuántos caracteres coinciden. */
function secretoValido(recibido: string | null): boolean {
  const esperado = process.env.RECORDATORIOS_SECRETO;
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * E11c (6.12, 7.10, RB-57): el aviso de cada minuto. Lo llama pg_cron (con pg_net) desde Supabase con el
 * secreto en `x-nova-tick`; no usa sesión (el middleware lo deja pasar). Envía los recordatorios que llegaron y
 * avanza una parte del libro a medias más antiguo. Un fallo en una parte no impide la otra.
 */
export async function POST(peticion: Request) {
  if (!secretoValido(peticion.headers.get('x-nova-tick'))) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const [recordatorios, libro] = await Promise.allSettled([procesarRecordatorios(), avanzarLibroEnSegundoPlano()]);
  for (const r of [recordatorios, libro]) if (r.status === 'rejected') console.error('Aviso de cada minuto:', r.reason);
  return NextResponse.json(
    {
      ok: recordatorios.status === 'fulfilled' && libro.status === 'fulfilled',
      recordatorios: recordatorios.status === 'fulfilled' ? recordatorios.value : null,
      libro: libro.status === 'fulfilled' ? libro.value : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
