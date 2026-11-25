'use client';

import { upload } from '@vercel/blob/client';
import { FileUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EtapasIndexacion } from '@/components/nova/EtapasIndexacion';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Selector } from '@/components/ui/Selector';
import { CATEGORIA_POR_DEFECTO } from '@/lib/config/nova';
import { validarTamanoPdf } from '@/lib/reglas/documento';
import { ErrorDeNegocio, MENSAJES } from '@/lib/reglas/errores';
import { esEtapaServidor, leerLineas, TIPO_ETAPAS, type EtapaIndexacion } from '@/lib/reglas/etapasIndexacion';
import { RequiereIa } from '@/components/nova/ia/RequiereIa';

/** Cuánto se ve "Indexado" en el botón antes de volver (E20b, botones con estados). */
const LISTO_MS = 2500;

interface CuerpoIndexar {
  ok?: boolean;
  datos?: { numFragmentos: number; progreso?: number | null };
  error?: { mensaje?: string };
}

/**
 * E20b (commit 6): lee la respuesta con etapas línea por línea y avisa cada una; devuelve la última línea, que es la
 * respuesta del contrato. Si el servidor respondió sin etapas (un error antes de empezar, o el tiempo agotado en
 * Vercel), la lee como antes.
 */
async function leerRespuesta(respuesta: Response, alEtapa: (etapa: EtapaIndexacion) => void): Promise<CuerpoIndexar | null> {
  if (!respuesta.headers.get('content-type')?.includes(TIPO_ETAPAS) || !respuesta.body) {
    return ((await respuesta.json().catch(() => null)) as CuerpoIndexar | null) ?? null;
  }
  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder();
  let acumulado = '';
  let final: CuerpoIndexar | null = null;
  for (;;) {
    const { value, done } = await lector.read();
    acumulado += done ? decodificador.decode() : decodificador.decode(value, { stream: true });
    const { objetos, resto } = leerLineas(done ? `${acumulado}\n` : acumulado);
    acumulado = resto;
    for (const o of objetos) {
      const etapa = (o as { etapa?: unknown }).etapa;
      if (esEtapaServidor(etapa)) alEtapa(etapa);
      else if (typeof (o as { ok?: unknown }).ok === 'boolean') final = o as CuerpoIndexar;
    }
    if (done) return final;
  }
}

function tamano(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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

/** E13 (B-21): con una materia elegida, su nombre es la categoría del documento. */
export function SubidorPdf({ materias = [] }: { materias?: ReadonlyArray<{ id: string; nombre: string }> }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [categoria, setCategoria] = useState(CATEGORIA_POR_DEFECTO);
  const [materiaId, setMateriaId] = useState('');
  const materia = materias.find((m) => m.id === materiaId);
  // E20b (commit 6): la etapa en curso (null = sin indexar), si falló o si terminó.
  const [etapa, setEtapa] = useState<EtapaIndexacion | null>(null);
  const [fallo, setFallo] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [listo, setListo] = useState(false);
  const [encima, setEncima] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{ nombre: string; numFragmentos: number } | null>(null);

  const ocupado = trabajando;

  useEffect(() => {
    if (!listo) return;
    const t = setTimeout(() => setListo(false), LISTO_MS);
    return () => clearTimeout(t);
  }, [listo]);

  function elegir(seleccionado: File | null) {
    setResultado(null);
    setProgreso(0);
    setEtapa(null);
    setFallo(false);
    setTerminado(false);
    setError(seleccionado ? (validarArchivo(seleccionado) ?? '') : '');
    setArchivo(seleccionado && !validarArchivo(seleccionado) ? seleccionado : null);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!archivo) return;
    setError('');
    setResultado(null);
    setProgreso(0);
    setFallo(false);
    setTerminado(false);
    setTrabajando(true);

    let urlBlob: string;
    setEtapa('subir');
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
      setError('No se pudo subir el archivo. Intenta de nuevo.');
      setFallo(true);
      setTrabajando(false);
      return;
    }

    setEtapa('leer');
    try {
      const respuesta = await fetch('/api/nova/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: `${TIPO_ETAPAS}, application/json` },
        body: JSON.stringify({
          urlBlob,
          nombreArchivo: archivo.name,
          categoria: materia ? materia.nombre : categoria.trim() || CATEGORIA_POR_DEFECTO,
          ...(materia ? { materiaId: materia.id } : {}),
        }),
      });
      // Si Vercel corta la función por tiempo, la respuesta no es JSON (ni termina con la línea del resultado).
      const cuerpo = await leerRespuesta(respuesta, setEtapa);
      if (!respuesta.ok || !cuerpo?.ok || !cuerpo.datos) {
        setError(
          cuerpo?.error?.mensaje ??
            'La indexación no terminó. El documento puede ser demasiado largo; intenta con uno más corto.',
        );
        setFallo(true);
        return;
      }
      if ((cuerpo.datos.progreso ?? null) === null) {
        setResultado({ nombre: archivo.name, numFragmentos: cuerpo.datos.numFragmentos });
        setTerminado(true);
        setListo(true);
      } else {
        // Si es largo, el avance (y sus etapas) lo muestra IndexacionPendiente, que aparece con el refresh.
        setEtapa(null);
      }
      setArchivo(null);
      if (entrada.current) entrada.current.value = '';
      router.refresh();
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
      setFallo(true);
    } finally {
      setTrabajando(false);
    }
  }

  // E20c-1 (RB-79): indexar necesita la IA (embeddings); sin una que sirva, el aviso con la guía.
  return (
    <RequiereIa>
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="archivo" className="text-sm font-medium text-texto">
          Archivo PDF
        </label>
        {/* E20b (commit 6): una zona para tocar o arrastrar el PDF; el campo de archivo la cubre entera, así el clic,
            el teclado y soltar un archivo son los del navegador. */}
        <div
          data-zona-pdf
          data-encima={encima || undefined}
          onDragEnter={() => setEncima(true)}
          onDragLeave={() => setEncima(false)}
          onDrop={() => setEncima(false)}
          className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-acento ${
            encima ? 'border-acento bg-acento-suave' : archivo ? 'border-acento/60 bg-superficie' : 'border-borde bg-superficie-2 hover:border-acento'
          } ${ocupado ? 'opacity-70' : ''}`}
        >
          <FileUp aria-hidden="true" className={`size-7 ${archivo || encima ? 'text-acento' : 'text-texto-suave'}`} />
          <p aria-hidden="true" className="text-sm font-semibold text-texto">
            {archivo ? archivo.name : (
              <>
                <span className="pointer-fine:hidden">Toca para elegir un PDF</span>
                <span className="hidden pointer-fine:inline">Elige un PDF o arrástralo aquí</span>
              </>
            )}
          </p>
          <p id="archivo-detalle" className="text-xs text-texto-suave">
            {archivo ? `${tamano(archivo.size)} · Toca o arrastra otro para cambiarlo` : 'Ningún archivo elegido'}
          </p>
          <input
            id="archivo"
            ref={entrada}
            type="file"
            accept="application/pdf,.pdf"
            disabled={ocupado}
            aria-describedby="archivo-detalle"
            onChange={(e) => elegir(e.target.files?.[0] ?? null)}
            className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {materias.length > 0 && (
        <Selector
          id="materia"
          etiqueta="Materia (opcional)"
          value={materiaId}
          onChange={(e) => setMateriaId(e.target.value)}
          disabled={ocupado}
          opciones={[{ valor: '', texto: 'Ninguna' }, ...materias.map((m) => ({ valor: m.id, texto: m.nombre }))]}
        />
      )}

      <Campo
        id="categoria"
        etiqueta="Categoría"
        value={materia ? materia.nombre : categoria}
        onChange={(e) => setCategoria(e.target.value)}
        maxLength={80}
        autoComplete="off"
        disabled={ocupado || Boolean(materia)}
        ayuda={materia ? 'Es la de la materia.' : undefined}
      />

      {(etapa !== null || terminado) && (
        <div className="nova-aparecer flex flex-col gap-2">
          <EtapasIndexacion actual={etapa} terminado={terminado} fallo={fallo} avance={etapa === 'subir' ? progreso : undefined} />
          {trabajando && etapa !== 'subir' && (
            <p className="text-xs text-texto-suave">Si tiene muchas páginas, se hará por partes y verás el avance en esta pantalla.</p>
          )}
        </div>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}
      {resultado && (
        <Aviso tipo="exito">
          Documento indexado: {resultado.numFragmentos} fragmentos ({resultado.nombre}).
        </Aviso>
      )}

      <div className="flex flex-wrap gap-3">
        <Boton type="submit" cargando={ocupado} listo={listo} textoListo="Indexado" disabled={!archivo}>
          {ocupado ? 'Indexando…' : 'Indexar PDF'}
        </Boton>
      </div>
    </form>
    </RequiereIa>
  );
}
