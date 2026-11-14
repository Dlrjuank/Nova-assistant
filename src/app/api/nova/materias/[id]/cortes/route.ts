import { exigirSesion } from '@/lib/auth/sesion';
import { dividirEnCortes, guardarCortes, quitarCortes } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaAccionCortes, esquemaCortes, esquemaIdSemestre } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** 6.4 (RB-07): los cortes en bloque; en una materia sin cortes, solo la fecha final. */
export const PUT = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  const { cortes } = await leerCuerpo(peticion, esquemaCortes);
  return responderOk(await guardarCortes(sesion.id, id, cortes));
});

/** 6.4 y RB-35: "Dividir en cortes" o "Quitar cortes". */
export const POST = conManejoDeErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await exigirSesion();
  const id = esquemaIdSemestre.parse((await params).id);
  const { accion } = await leerCuerpo(peticion, esquemaAccionCortes);
  return responderOk(accion === 'dividir' ? await dividirEnCortes(sesion.id, id) : await quitarCortes(sesion.id, id));
});
