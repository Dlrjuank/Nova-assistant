import { exigirSesion } from '@/lib/auth/sesion';
import { indexarDocumento, listarDocumentos } from '@/lib/dataService';
import { conManejoDeErrores, leerCuerpo, responderConEtapas, responderOk } from '@/lib/http/respuestas';
import { TIPO_ETAPAS, type EtapaServidor } from '@/lib/reglas/etapasIndexacion';
import { esquemaIndexar } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';
// Genera embeddings de todos los fragmentos. Con el límite de Gemini de 30.000 tokens por minuto,
// un documento largo necesita varios minutos (ver ESPERA_MAXIMA_INDEXAR_MS en lib/llm/gemini.ts).
export const maxDuration = 300;

export const GET = conManejoDeErrores(async () => {
  const { id } = await exigirSesion();
  return responderOk(await listarDocumentos(id));
});

export const POST = conManejoDeErrores(async (peticion: Request) => {
  const { id } = await exigirSesion();
  const datos = await leerCuerpo(peticion, esquemaIndexar);
  // E20b (commit 6): la pantalla pide las etapas; los scripts y las pruebas reciben el JSON de siempre.
  if (peticion.headers.get('accept')?.includes(TIPO_ETAPAS)) {
    return responderConEtapas<EtapaServidor, Awaited<ReturnType<typeof indexarDocumento>>>((alEtapa) => indexarDocumento(id, datos, { alEtapa }), TIPO_ETAPAS);
  }
  return responderOk(await indexarDocumento(id, datos), 201);
});
