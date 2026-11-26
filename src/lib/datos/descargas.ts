import { validarTamanoPdf } from '@/lib/reglas/documento';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

/** Descarga el Blob cortando en cuanto supera el límite, para no cargar en memoria un archivo enorme (RN-01). */
export async function descargarArchivo(urlBlob: string): Promise<Uint8Array> {
  const respuesta = await fetch(urlBlob, { redirect: 'error' });
  if (!respuesta.ok || !respuesta.body) throw new ErrorDeNegocio('PDF_INVALIDO');

  const partes: Uint8Array[] = [];
  let total = 0;
  const lector = respuesta.body.getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.length;
    try {
      validarTamanoPdf(total);
    } catch (error) {
      await lector.cancel();
      throw error;
    }
    partes.push(value);
  }

  const bytes = new Uint8Array(total);
  let posicion = 0;
  for (const parte of partes) {
    bytes.set(parte, posicion);
    posicion += parte.length;
  }
  return bytes;
}
