'use client';

import { upload } from '@vercel/blob/client';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { CATEGORIA_POR_DEFECTO } from '@/lib/config/nova';
import { validarTamanoPdf } from '@/lib/reglas/documento';
import { ErrorDeNegocio, MENSAJES } from '@/lib/reglas/errores';

type Etapa = 'inicial' | 'subiendo' | 'indexando';

function esPdf(archivo: File): boolean {
  return archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf');
}

/** Valida en el navegador; el servidor repite el límite de tamaño sobre el archivo real (RN-01). */
function validarArchivo(archivo: File): string | null {
  if (!esPdf(archivo)) return MENSAJES.PDF_INVALIDO;
  try {
    validarTamanoPdf(archivo.size);
    return null;
  } catch (error) {
    return error instanceof ErrorDeNegocio ? error.message : MENSAJES.ERROR_INTERNO;
  }
}

/** Blob rechaza algunos caracteres en la ruta. El nombre original se conserva aparte para mostrarlo. */
function rutaEnBlob(nombre: string): string {
  const sinTildes = nombre.replace(/\.pdf$/i, '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const base = sinTildes.replace(/[^a-zA-Z0-9_-]+/g, '-');
  return `${base.replace(/^-+|-+$/g, '').slice(0, 100) || 'documento'}.pdf`;
}

export function SubidorPdf() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [categoria, setCategoria] = useState(CATEGORIA_POR_DEFECTO);
  const [etapa, setEtapa] = useState<Etapa>('inicial');
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{ nombre: string; numFragmentos: number; progreso: number | null } | null>(null);

  const ocupado = etapa !== 'inicial';

  function elegir(seleccionado: File | null) {
    setResultado(null);
    setProgreso(0);
    setError(seleccionado ? (validarArchivo(seleccionado) ?? '') : '');
    setArchivo(seleccionado && !validarArchivo(seleccionado) ? seleccionado : null);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!archivo) return;
    setError('');
    setResultado(null);
    setProgreso(0);

    let urlBlob: string;
    setEtapa('subiendo');
    try {
      const blob = await upload(rutaEnBlob(archivo.name), archivo, {
        access: 'public',
        handleUploadUrl: '/api/nova/documentos/subida',
        contentType: 'application/pdf',
        onUploadProgress: ({ percentage }) => setProgreso(Math.round(percentage)),
      });
      urlBlob = blob.url;
    } catch (causa) {
      console.error('No se pudo subir el PDF:', causa);
      setError('No se pudo subir el archivo. Intente de nuevo.');
      setEtapa('inicial');
      return;
    }

    setEtapa('indexando');
    try {
      const respuesta = await fetch('/api/nova/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urlBlob,
          nombreArchivo: archivo.name,
          categoria: categoria.trim() || CATEGORIA_POR_DEFECTO,
        }),
      });
      // Si Vercel corta la función por tiempo, la respuesta no es JSON.
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        datos?: { numFragmentos: number; progreso?: number | null };
        error?: { mensaje?: string };
      } | null;
      if (!respuesta.ok || !cuerpo?.ok || !cuerpo.datos) {
        setError(
          cuerpo?.error?.mensaje ??
            'La indexación no terminó. El documento puede ser demasiado largo; intente con uno más corto.',
        );
        return;
      }
      setResultado({ nombre: archivo.name, numFragmentos: cuerpo.datos.numFragmentos, progreso: cuerpo.datos.progreso ?? null });
      setArchivo(null);
      if (entrada.current) entrada.current.value = '';
      router.refresh();
    } catch {
      setError('No se pudo conectar con el servidor. Intente de nuevo.');
    } finally {
      setEtapa('inicial');
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="archivo" className="text-sm font-medium text-texto">
          Archivo PDF
        </label>
        <input
          id="archivo"
          ref={entrada}
          type="file"
          accept="application/pdf,.pdf"
          disabled={ocupado}
          onChange={(e) => elegir(e.target.files?.[0] ?? null)}
          className="text-sm text-texto file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-lg file:border file:border-borde file:bg-superficie file:px-4 file:py-2 file:text-sm file:font-semibold file:text-texto hover:file:bg-acento-suave focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
        />
      </div>

      <Campo
        id="categoria"
        etiqueta="Categoría"
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
        maxLength={80}
        autoComplete="off"
        disabled={ocupado}
      />

      {etapa === 'subiendo' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="progreso" className="text-sm text-texto-suave">
            Subiendo: {progreso} %
          </label>
          <progress id="progreso" value={progreso} max={100} className="h-2 w-full accent-acento" />
        </div>
      )}
      {etapa === 'indexando' && (
        <p role="status" className="text-sm text-texto-suave">
          Indexando el documento. Si tiene muchas páginas, se hará por partes y verás el avance en esta pantalla.
        </p>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}
      {resultado && (
        <Aviso tipo="exito">
          {resultado.progreso === null
            ? `Documento indexado: ${resultado.numFragmentos} fragmentos (${resultado.nombre}).`
            : `El documento es largo: se sigue indexando por partes (${resultado.nombre}).`}
        </Aviso>
      )}

      <div className="flex flex-wrap gap-3">
        <Boton type="submit" cargando={ocupado} disabled={!archivo}>
          Indexar PDF
        </Boton>
      </div>
    </form>
  );
}
