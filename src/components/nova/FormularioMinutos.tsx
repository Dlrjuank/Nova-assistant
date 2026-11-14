'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { MENSAJES } from '@/lib/reglas/errores';

/**
 * Completar una tarea con los minutos dedicados (RN-16, RN-17). Es el mismo formulario en Tareas
 * (AccionesTarea, en línea) y en Inicio (casilla de la semana, dentro de un diálogo): el índice y las metas
 * dependen de esos minutos. Cancelar no cambia nada.
 */
export function FormularioMinutos({
  id,
  prefijo,
  alTerminar,
  alCancelar,
  enfocar = true,
}: {
  id: string;
  /** Distingue los ids cuando la misma tarea aparece dos veces en la página. */
  prefijo: string;
  alTerminar: () => void;
  alCancelar: () => void;
  enfocar?: boolean;
}) {
  const router = useRouter();
  const [minutos, setMinutos] = useState('0');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const minutosValidos = /^\d+$/.test(minutos.trim());

  async function completar(evento: FormEvent) {
    evento.preventDefault();
    if (!minutosValidos) return;
    setError('');
    setEnviando(true);
    try {
      const respuesta = await fetch(`/api/nova/tareas/${id}/completar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutos: Number(minutos) }),
      });
      const cuerpo = (await respuesta.json()) as { ok: boolean; error?: { mensaje?: string } };
      if (!respuesta.ok || !cuerpo.ok) {
        setError(cuerpo.error?.mensaje ?? MENSAJES.ERROR_INTERNO);
        return;
      }
      alTerminar();
      router.refresh();
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={(e) => void completar(e)} className="flex min-w-44 flex-col gap-2">
      <Campo
        id={`${prefijo}-minutos-${id}`}
        etiqueta="Minutos dedicados"
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={minutos}
        onChange={(e) => setMinutos(e.target.value)}
        error={minutosValidos ? undefined : 'Escribe un número entero de 0 en adelante.'}
        autoFocus={enfocar}
      />
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" cargando={enviando} disabled={!minutosValidos} className="min-h-9 py-1.5">
          Confirmar
        </Boton>
        <Boton variante="fantasma" onClick={alCancelar} disabled={enviando} className="min-h-9 py-1.5">
          Cancelar
        </Boton>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-peligro">
          {error}
        </p>
      )}
    </form>
  );
}
