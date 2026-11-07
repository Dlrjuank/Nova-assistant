'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Boton } from '@/components/ui/Boton';
import { MENSAJES } from '@/lib/reglas/errores';
import { FormularioMinutos } from './FormularioMinutos';

type Modo = 'inicial' | 'completar' | 'eliminar';

/** Completar (RN-16) y eliminar (RN-19). `prefijo` distingue los ids: la tabla y las tarjetas se renderizan a la vez. */
export function AccionesTarea({
  id,
  titulo,
  completada,
  prefijo,
}: {
  id: string;
  titulo: string;
  completada: boolean;
  prefijo: string;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('inicial');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function eliminar() {
    setError('');
    setEnviando(true);
    try {
      const respuesta = await fetch(`/api/nova/tareas/${id}`, { method: 'DELETE' });
      const cuerpo = (await respuesta.json()) as { ok: boolean; error?: { mensaje?: string } };
      if (!respuesta.ok || !cuerpo.ok) {
        setError(cuerpo.error?.mensaje ?? MENSAJES.ERROR_INTERNO);
        return;
      }
      setModo('inicial');
      router.refresh();
    } catch {
      setError('No se pudo conectar con el servidor. Intente de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (modo === 'completar') {
    return <FormularioMinutos id={id} prefijo={prefijo} alTerminar={() => setModo('inicial')} alCancelar={() => setModo('inicial')} />;
  }

  if (modo === 'eliminar') {
    return (
      <div className="flex min-w-44 flex-col gap-2">
        <p className="text-sm text-texto">¿Eliminar esta tarea? No se puede deshacer.</p>
        <div className="flex flex-wrap gap-2">
          <Boton variante="peligro" cargando={enviando} onClick={() => void eliminar()} className="min-h-9 py-1.5">
            Sí, eliminar
          </Boton>
          <Boton variante="fantasma" onClick={() => setModo('inicial')} disabled={enviando} className="min-h-9 py-1.5">
            Cancelar
          </Boton>
        </div>
        {error && (
          <p role="alert" className="text-xs font-medium text-peligro">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!completada && (
        <Boton
          variante="secundario"
          aria-label={`Completar tarea: ${titulo}`}
          onClick={() => setModo('completar')}
          className="min-h-9 py-1.5"
        >
          Completar
        </Boton>
      )}
      <Boton
        variante="fantasma"
        aria-label={`Eliminar tarea: ${titulo}`}
        onClick={() => setModo('eliminar')}
        className="min-h-9 py-1.5 text-peligro hover:bg-peligro/12"
      >
        Eliminar
      </Boton>
    </div>
  );
}
