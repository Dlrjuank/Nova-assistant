'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { MENSAJES } from '@/lib/reglas/errores';

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
  const [minutos, setMinutos] = useState('0');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const minutosValidos = /^\d+$/.test(minutos.trim());

  async function ejecutar(url: string, opciones: RequestInit) {
    setError('');
    setEnviando(true);
    try {
      const respuesta = await fetch(url, opciones);
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

  function completar(evento: FormEvent) {
    evento.preventDefault();
    if (!minutosValidos) return;
    void ejecutar(`/api/nova/tareas/${id}/completar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutos: Number(minutos) }),
    });
  }

  const mensajeError = error && (
    <p role="alert" className="text-xs font-medium text-peligro">
      {error}
    </p>
  );

  if (modo === 'completar') {
    return (
      <form onSubmit={completar} className="flex min-w-44 flex-col gap-2">
        <Campo
          id={`${prefijo}-minutos-${id}`}
          etiqueta="Minutos dedicados"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={minutos}
          onChange={(e) => setMinutos(e.target.value)}
          error={minutosValidos ? undefined : 'Escriba un número entero de 0 en adelante.'}
          autoFocus
        />
        <div className="flex flex-wrap gap-2">
          <Boton type="submit" cargando={enviando} disabled={!minutosValidos} className="min-h-9 py-1.5">
            Confirmar
          </Boton>
          <Boton variante="fantasma" onClick={() => setModo('inicial')} disabled={enviando} className="min-h-9 py-1.5">
            Cancelar
          </Boton>
        </div>
        {mensajeError}
      </form>
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
            onClick={() => void ejecutar(`/api/nova/tareas/${id}`, { method: 'DELETE' })}
            className="min-h-9 py-1.5"
          >
            Sí, eliminar
          </Boton>
          <Boton variante="fantasma" onClick={() => setModo('inicial')} disabled={enviando} className="min-h-9 py-1.5">
            Cancelar
          </Boton>
        </div>
        {mensajeError}
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
        className="min-h-9 py-1.5 text-peligro hover:bg-peligro/10"
      >
        Eliminar
      </Boton>
    </div>
  );
}
