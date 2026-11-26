'use client';

import { ScanLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { EtapasIndexacion } from '@/components/nova/EtapasIndexacion';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { EstadoOcr } from '@/lib/datos/tipos';
import { MENSAJES } from '@/lib/reglas/errores';
import { textoPreguntaOcr } from '@/lib/reglas/ocr';

const ESPERA_SI_OCUPADO_MS = 5000;
const SIN_CONEXION = 'Se perdió la conexión con el servidor. Intenta de nuevo.';

interface Pendiente {
  id: string;
  nombreArchivo: string;
  progreso: number;
  /** E20d-3: la lectura con OCR, si espera la respuesta o se está leyendo. */
  ocr?: EstadoOcr | null;
}

type Resultado = { tipo: 'exito' | 'info'; texto: string };

const noGuardado = (nombre: string, ocr: EstadoOcr | null | undefined) =>
  ocr?.fuente === 'fotos'
    ? `«${nombre}» no se guardó: sin leer las fotos no hay texto.`
    : `«${nombre}» no se guardó: sin leer las páginas escaneadas no tiene texto.`;

/**
 * E10b (RB-38): indexa por partes los libros que falten, de a uno. Cada llamada hace una parte, así el
 * porcentaje sube en pantalla. Desde E11c (RB-57) también avanza sola: el aviso de cada minuto indexa una parte.
 * Lo que falta queda guardado en la base y se retoma al volver.
 * E20d-3: un documento con páginas escaneadas (o fotos) primero pregunta "¿Leerlas?"; después se lee por grupos.
 */
export function IndexacionPendiente({ pendientes }: { pendientes: Pendiente[] }) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const pregunta = pendientes.find((p) => p.ocr?.estado === 'pregunta');
  const actual = pendientes.find((p) => p.ocr?.estado !== 'pregunta');
  if (pregunta || actual) {
    return (
      <>
        {resultado && <Aviso tipo={resultado.tipo}>{resultado.texto}</Aviso>}
        {pregunta && <PreguntaOcr key={pregunta.id} documento={pregunta} alResponder={setResultado} />}
        {actual && <Avance key={actual.id} documento={actual} enCola={pendientes.filter((p) => p.ocr?.estado !== 'pregunta').length - 1} alTerminar={setResultado} />}
      </>
    );
  }
  if (!resultado) return null;
  return <Aviso tipo={resultado.tipo}>{resultado.texto}</Aviso>;
}

/** E20d-3: "Este PDF tiene 180 páginas escaneadas. Leerlas usa unas 18 consultas… ¿Leerlas?" */
function PreguntaOcr({ documento, alResponder }: { documento: Pendiente; alResponder: (r: Resultado) => void }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<'si' | 'no' | null>(null);
  const [error, setError] = useState('');
  const ocr = documento.ocr as EstadoOcr;

  async function responder(leer: boolean) {
    setEnviando(leer ? 'si' : 'no');
    setError('');
    try {
      const respuesta = await fetch(`/api/nova/documentos/${documento.id}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leer }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as { ok?: boolean; datos?: { eliminado?: boolean }; error?: { mensaje?: string } } | null;
      if (!respuesta.ok || !cuerpo?.ok) {
        setError(cuerpo?.error?.mensaje ?? MENSAJES.ERROR_INTERNO);
        setEnviando(null);
        return;
      }
      if (cuerpo.datos?.eliminado) alResponder({ tipo: 'info', texto: noGuardado(documento.nombreArchivo, ocr) });
      router.refresh();
    } catch {
      setError(SIN_CONEXION);
      setEnviando(null);
    }
  }

  return (
    <Tarjeta className="flex max-w-xl flex-col gap-3" data-pregunta-ocr>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-cat-oliva/12 text-cat-oliva">
          <ScanLine className="size-4.5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold break-all text-texto">«{documento.nombreArchivo}»</h2>
          <p className="text-sm text-texto">{textoPreguntaOcr(ocr.total, ocr.fuente)}</p>
          <p className="text-xs text-texto-suave">
            {ocr.fuente === 'fotos'
              ? 'Si no las lees, el documento no se guarda.'
              : 'Si no las lees, se guarda solo lo que tiene texto.'}{' '}
            Si no respondes en 24 horas, se toma como «Ahora no».
          </p>
        </div>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Boton onClick={() => void responder(true)} cargando={enviando === 'si'} disabled={enviando !== null}>
          {ocr.total === 1 ? 'Leerla' : 'Leerlas'}
        </Boton>
        <Boton variante="secundario" onClick={() => void responder(false)} cargando={enviando === 'no'} disabled={enviando !== null}>
          Ahora no
        </Boton>
      </div>
    </Tarjeta>
  );
}

function Avance({ documento, enCola, alTerminar }: { documento: Pendiente; enCola: number; alTerminar: (r: Resultado) => void }) {
  const router = useRouter();
  const enrutador = useRef(router);
  enrutador.current = router;
  const terminar = useRef(alTerminar);
  terminar.current = alTerminar;
  // Cada router.refresh() trae un objeto nuevo: con una referencia, el ciclo no se reinicia en cada parte.
  const ocrInicial = useRef(documento.ocr);
  const [avance, setAvance] = useState(documento.progreso);
  const [ocr, setOcr] = useState<EstadoOcr | null>(documento.ocr ?? null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const { id, nombreArchivo } = documento;

  useEffect(() => {
    let vivo = true;
    async function seguir() {
      while (vivo) {
        try {
          const respuesta = await fetch(`/api/nova/documentos/${id}/continuar`, { method: 'POST' });
          // Si Vercel corta la función por tiempo, la respuesta no es JSON.
          const cuerpo = (await respuesta.json().catch(() => null)) as {
            ok?: boolean;
            datos?: { progreso: number | null; ocupado?: boolean; ocr?: EstadoOcr; eliminado?: boolean };
            error?: { mensaje?: string };
          } | null;
          if (!vivo) return;
          if (!respuesta.ok || !cuerpo?.ok || !cuerpo.datos) {
            setError(cuerpo?.error?.mensaje ?? MENSAJES.ERROR_LLM);
            return;
          }
          if (cuerpo.datos.eliminado) {
            terminar.current({ tipo: 'info', texto: noGuardado(nombreArchivo, ocrInicial.current) });
            enrutador.current.refresh();
            return;
          }
          if (cuerpo.datos.progreso === null) {
            setAvance(100);
            terminar.current({ tipo: 'exito', texto: `«${nombreArchivo}» quedó indexado. Ya puedes preguntarle al Asistente o ver su contenido.` });
            enrutador.current.refresh();
            return;
          }
          setOcr(cuerpo.datos.ocr ?? null);
          setAvance(cuerpo.datos.progreso);
          enrutador.current.refresh(); // la fila de la lista también muestra el avance
          if (cuerpo.datos.ocupado) await new Promise((r) => setTimeout(r, ESPERA_SI_OCUPADO_MS));
        } catch {
          if (vivo) setError(SIN_CONEXION);
          return;
        }
      }
    }
    void seguir();
    return () => {
      vivo = false;
    };
  }, [id, nombreArchivo, intento]);

  // Al desbloquear el teléfono o volver a la pestaña, si la conexión se había cortado, sigue solo.
  useEffect(() => {
    if (!error) return;
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      setError('');
      setIntento((n) => n + 1);
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [error]);

  const leyendo = ocr?.estado === 'leyendo';
  const porcentaje = leyendo ? Math.floor((ocr.leidas / Math.max(1, ocr.total)) * 100) : avance;
  const unidadOcr = ocr?.fuente === 'fotos' ? 'fotos' : 'páginas';
  return (
    <Tarjeta className="flex max-w-xl flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="avance-indexacion" className="text-sm font-medium break-all text-texto">
          {leyendo ? `Leyendo con OCR «${nombreArchivo}»… ${ocr.leidas} de ${ocr.total} ${unidadOcr}` : `Indexando «${nombreArchivo}»… ${avance} %`}
        </label>
        <progress id="avance-indexacion" value={porcentaje} max={100} className="h-2 w-full accent-acento" />
      </div>
      {/* E20b (commit 6): el libro ya se subió, se leyó y se dividió; falta crear los vectores por partes. E20d-3: o leer con OCR. */}
      <EtapasIndexacion
        actual={leyendo ? 'leer' : 'vectores'}
        fallo={Boolean(error)}
        avance={porcentaje}
        textoLeer={leyendo ? `Leer con OCR (${ocr.leidas} de ${ocr.total} ${unidadOcr})` : undefined}
      />
      <p className="text-sm font-medium text-texto">Puedes cerrar esta pantalla: seguirá sola.</p>
      <p className="text-xs text-texto-suave">
        Si sales o se bloquea el teléfono, se detiene y sigue cuando vuelvas a Fuentes, sin perder lo avanzado. Entre una parte y otra puede
        pasar hasta un minuto por el límite gratuito de Gemini.
        {enCola > 0 && ` Después siguen ${enCola === 1 ? '1 documento' : `${enCola} documentos`}.`}
      </p>
      {error && (
        <>
          <Aviso tipo="error">{error}</Aviso>
          <div>
            <Boton
              variante="secundario"
              onClick={() => {
                setError('');
                setIntento((n) => n + 1);
              }}
            >
              Reintentar
            </Boton>
          </div>
        </>
      )}
    </Tarjeta>
  );
}
