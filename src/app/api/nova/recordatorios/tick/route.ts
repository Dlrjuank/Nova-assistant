import { NextResponse } from 'next/server';
import { avanzarLibroEnSegundoPlano, procesarRecordatorios, procesarResumenes, vencerContrasenasTemporales, vencerPreguntasOcr } from '@/lib/dataService';
import { secretoValido } from '@/lib/http/secreto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * E11c (6.12, 7.10, RB-57): el aviso de cada minuto. Lo llama pg_cron (con pg_net) desde Supabase con el
 * secreto en `x-nova-tick`; no usa sesión (el middleware lo deja pasar). Envía los recordatorios que llegaron y
 * avanza una parte del libro a medias más antiguo. E11d: también el resumen diario (RB-46). E20c-3 (RB-91): reemplaza las
 * contraseñas temporales que vencieron sin usarse. E20d-3: la pregunta del OCR sin respuesta en 24 horas es "Ahora no". Un fallo en una parte no impide la otra.
 */
export async function POST(peticion: Request) {
  if (!secretoValido(peticion.headers.get('x-nova-tick'), process.env.RECORDATORIOS_SECRETO)) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const [recordatorios, resumenes, libro, temporales, ocr] = await Promise.allSettled([procesarRecordatorios(), procesarResumenes(), avanzarLibroEnSegundoPlano(), vencerContrasenasTemporales(), vencerPreguntasOcr()]);
  for (const r of [recordatorios, resumenes, libro, temporales, ocr]) if (r.status === 'rejected') console.error('Aviso de cada minuto:', r.reason);
  return NextResponse.json(
    {
      ok: recordatorios.status === 'fulfilled' && resumenes.status === 'fulfilled' && libro.status === 'fulfilled',
      recordatorios: recordatorios.status === 'fulfilled' ? recordatorios.value : null,
      resumenes: resumenes.status === 'fulfilled' ? resumenes.value : null,
      libro: libro.status === 'fulfilled' ? libro.value : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
