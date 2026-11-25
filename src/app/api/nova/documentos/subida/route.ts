import type { HandleUploadBody } from '@vercel/blob/client';
import { exigirSesion } from '@/lib/auth/sesion';
import { emitirTokenSubida, exigirEspacio } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo } from '@/lib/http/respuestas';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Protocolo de subida client-side de Vercel Blob: el navegador pide aquí un token de un solo uso y sube directo.
// La respuesta conserva el formato propio de handleUpload porque upload() del navegador lo espera así.
export const POST = conManejoDeErrores(async (peticion: Request) => {
  const sesion = await exigirSesion();
  const cuerpo = (await leerCuerpo(peticion, z.looseObject({ type: z.string() }))) as unknown as HandleUploadBody;
  // E20c-2 (RB-85): pasado el tope de espacio no se entrega el permiso para subir.
  if (cuerpo.type === 'blob.generate-client-token') await exigirEspacio(sesion.id, sesion.nivel);
  const respuesta = await emitirTokenSubida(cuerpo, peticion);
  return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } });
});
