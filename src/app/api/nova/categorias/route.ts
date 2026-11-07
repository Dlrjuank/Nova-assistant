import { exigirSesion } from '@/lib/auth/sesion';
import { crearCategoria, listarCategorias } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderOk } from '@/lib/http/respuestas';
import { esquemaCategoria } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/** E05: categorías del usuario de la sesión (RB-01), con "General" siempre presente. */
export const GET = conManejoDeErrores(async () => {
  const { id } = await exigirSesion();
  return responderOk(await listarCategorias(id));
});

/** RB-02 y RB-03. Sin color, el siguiente libre de la paleta. */
export const POST = conManejoDeErrores(async (peticion: Request) => {
  const { id } = await exigirSesion();
  const datos = await leerCuerpo(peticion, esquemaCategoria);
  return responderOk(await crearCategoria(id, datos), 201);
});
