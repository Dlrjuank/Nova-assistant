'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { MENSAJES } from '@/lib/reglas/errores';

const ESPERA_SI_OCUPADO_MS = 5000;

interface Pendiente {
  id: string;
  nombreArchivo: string;
  progreso: number;
}

/**
 * E10b (RB-38): mientras esta pantalla esté abierta, indexa por partes los libros que falten, de a uno.
 * Si se cierra, sigue al volver: lo que falta está guardado en la base.
 */
export function IndexacionPendiente({ pendientes }: { pendientes: Pendiente[] }) {
  const actual = pendientes[0];
  if (!actual) return null;
  return <Avance key={actual.id} documento={actual} enCola={pendientes.length - 1} />;
}

function Avance({ documento, enCola }: { documento: Pendiente; enCola: number }) {
  const router = useRouter();
  const enrutador = useRef(router);
  enrutador.current = router;
  const [avance, setAvance] = useState(documento.progreso);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const { id } = documento;

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
          enrutador.current.refresh();
          if (cuerpo.datos.progreso === null) return;
          setAvance(cuerpo.datos.progreso);
          if (cuerpo.datos.ocupado) await new Promise((r) => setTimeout(r, ESPERA_SI_OCUPADO_MS));
        } catch {
          if (vivo) setError('No se pudo conectar con el servidor. Intente de nuevo.');
          return;
        }
      }
    }
    void seguir();
    return () => {
      vivo = false;
    };
  }, [id, intento]);

  return (
    <Tarjeta className="flex max-w-xl flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="avance-indexacion" className="text-sm font-medium break-all text-texto">
          Indexando «{documento.nombreArchivo}»… {avance} %
        </label>
        <progress id="avance-indexacion" value={avance} max={100} className="h-2 w-full accent-acento" />
      </div>
      <p className="text-xs text-texto-suave">
        Un libro largo se indexa por partes y puede tardar varios minutos. Si sales de esta pantalla, sigue cuando vuelvas.
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
