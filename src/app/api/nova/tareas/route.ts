import { exigirSesion } from '@/lib/auth/sesion';
import { crearTarea, listarTareas } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaFiltroTareas, esquemaTarea } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

export const GET = conManejoDeErrores(async (peticion: Request) => {
  const { id } = await exigirSesion();
  const { searchParams } = new URL(peticion.url);
  const filtro = esquemaFiltroTareas.parse({
    estado: searchParams.get('estado') ?? undefined,
    fecha: searchParams.get('fecha') ?? undefined,
  });
  return responderOk(await listarTareas(id, filtro));
});

export const POST = conManejoDeErrores(async (peticion: Request) => {
  const { id } = await exigirSesion();
  const datos = await leerCuerpo(peticion, esquemaTarea);
  return responderOk(await crearTarea(id, datos), 201);
});
