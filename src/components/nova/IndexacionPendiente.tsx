'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { MENSAJES } from '@/lib/reglas/errores';

const ESPERA_SI_OCUPADO_MS = 5000;
const SIN_CONEXION = 'Se perdió la conexión con el servidor. Intente de nuevo.';

interface Pendiente {
  id: string;
  nombreArchivo: string;
  progreso: number;
}

/**
 * E10b (RB-38): indexa por partes los libros que falten, de a uno. Cada llamada hace una parte, así el
 * porcentaje sube en pantalla. Solo avanza con esta pantalla abierta: nadie más pide las partes siguientes.
 * Lo que falta queda guardado en la base y se retoma al volver.
 */
export function IndexacionPendiente({ pendientes }: { pendientes: Pendiente[] }) {
  const [listo, setListo] = useState('');
  const actual = pendientes[0];
  if (actual) return <Avance key={actual.id} documento={actual} enCola={pendientes.length - 1} alTerminar={setListo} />;
  if (!listo) return null;
  return <Aviso tipo="exito">«{listo}» quedó indexado. Ya puedes preguntarle al Asistente o ver sus capítulos.</Aviso>;
}

function Avance({ documento, enCola, alTerminar }: { documento: Pendiente; enCola: number; alTerminar: (nombre: string) => void }) {
  const router = useRouter();
  const enrutador = useRef(router);
  enrutador.current = router;
  const terminar = useRef(alTerminar);
  terminar.current = alTerminar;
  const [avance, setAvance] = useState(documento.progreso);
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
            datos?: { progreso: number | null; ocupado?: boolean };
            error?: { mensaje?: string };
          } | null;
          if (!vivo) return;
          if (!respuesta.ok || !cuerpo?.ok || !cuerpo.datos) {
            setError(cuerpo?.error?.mensaje ?? MENSAJES.ERROR_LLM);
            return;
          }
          if (cuerpo.datos.progreso === null) {
            setAvance(100);
            terminar.current(nombreArchivo);
            enrutador.current.refresh();
            return;
          }
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

  return (
    <Tarjeta className="flex max-w-xl flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="avance-indexacion" className="text-sm font-medium break-all text-texto">
          Indexando «{nombreArchivo}»… {avance} %
        </label>
        <progress id="avance-indexacion" value={avance} max={100} className="h-2 w-full accent-acento" />
      </div>
      <p className="text-sm font-medium text-texto">Deja esta pantalla abierta hasta que termine.</p>
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
