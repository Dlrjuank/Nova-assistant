'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Boton, CLASE_FOCO } from '@/components/ui/Boton';
import { MENSAJES } from '@/lib/reglas/errores';
import { AVISO_COPIA_CALENDARIO } from '@/lib/reglas/ics';
import { AgregarACalendario } from './AgregarACalendario';
import { EnlaceEditarTarea } from './EnlaceEditarTarea';
import { FormularioMinutos } from './FormularioMinutos';

type Modo = 'inicial' | 'completar' | 'eliminar';

/** Completar (RN-16), eliminar (RN-19) y, desde E11d, "Agregar a mi calendario" (RB-47). `prefijo` distingue los ids: la tabla y las tarjetas se renderizan a la vez. */
export function AccionesTarea({
  id,
  titulo,
  completada,
  prefijo,
  editarSoloIcono = false,
}: {
  id: string;
  titulo: string;
  completada: boolean;
  prefijo: string;
  /**
   * E09: en la tabla del computador, "Editar" es un ícono para que las acciones quepan en una línea. E11d: también
   * "Agregar a mi calendario" y "Eliminar".
   */
  editarSoloIcono?: boolean;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('inicial');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [agregada, setAgregada] = useState(false);

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
    return (
      <FormularioMinutos
        id={id}
        prefijo={prefijo}
        alTerminar={() => setModo('inicial')}
        alCancelar={() => setModo('inicial')}
      />
    );
  }

  if (modo === 'eliminar') {
    return (
      <div className="flex min-w-44 flex-col gap-2">
        <p className="text-sm text-texto">¿Eliminar esta tarea? No se puede deshacer.</p>
        <div className="flex flex-wrap gap-2">
          <Boton
            variante="peligro"
            cargando={enviando}
            onClick={() => void eliminar()}
            className="min-h-9 py-1.5"
          >
            Sí, eliminar
          </Boton>
          <Boton
            variante="fantasma"
            onClick={() => setModo('inicial')}
            disabled={enviando}
            className="min-h-9 py-1.5"
          >
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
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
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
        {!completada && (
          <EnlaceEditarTarea
            id={id}
            titulo={titulo}
            soloIcono={editarSoloIcono}
            className={editarSoloIcono ? 'size-9' : 'min-h-9 py-1.5'}
          />
        )}
        {!completada && (
          <AgregarACalendario
            id={id}
            titulo={titulo}
            soloIcono={editarSoloIcono}
            className={editarSoloIcono ? 'size-9' : 'min-h-9 py-1.5'}
            alAgregar={() => setAgregada(true)}
          />
        )}
        {editarSoloIcono ? (
          // E11d: con "Agregar a mi calendario", en la tabla "Eliminar" también es un ícono para seguir en una línea.
          <button
            type="button"
            aria-label={`Eliminar tarea: ${titulo}`}
            title="Eliminar"
            onClick={() => setModo('eliminar')}
            className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-peligro transition-colors duration-150 hover:bg-peligro/12 ${CLASE_FOCO}`}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        ) : (
          <Boton
            variante="fantasma"
            aria-label={`Eliminar tarea: ${titulo}`}
            onClick={() => setModo('eliminar')}
            className="min-h-9 py-1.5 text-peligro hover:bg-peligro/12"
          >
            Eliminar
          </Boton>
        )}
      </div>
      {agregada && (
        <p role="status" className="max-w-xs text-xs text-texto-suave">
          {AVISO_COPIA_CALENDARIO}
        </p>
      )}
    </div>
  );
}
