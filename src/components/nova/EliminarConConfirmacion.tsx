'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Boton } from '@/components/ui/Boton';
import { MENSAJES } from '@/lib/reglas/errores';

/** Eliminar en dos pasos, con el mismo aspecto en documentos (RN-22) y fuentes web (RB-54). */
export function EliminarConConfirmacion({ ruta, etiqueta, pregunta }: { ruta: string; etiqueta: string; pregunta: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function eliminar() {
    setError('');
    setEnviando(true);
    try {
      const respuesta = await fetch(ruta, { method: 'DELETE' });
      const cuerpo = (await respuesta.json().catch(() => null)) as { ok?: boolean; error?: { mensaje?: string } } | null;
      if (!respuesta.ok || !cuerpo?.ok) {
        setError(cuerpo?.error?.mensaje ?? MENSAJES.ERROR_INTERNO);
        return;
      }
      setConfirmando(false);
      router.refresh();
    } catch {
      setError('No se pudo conectar con el servidor. Intente de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (confirmando) {
    return (
      <div className="flex min-w-44 flex-col gap-2">
        <p className="text-sm text-texto">{pregunta}</p>
        <div className="flex flex-wrap gap-2">
          <Boton variante="peligro" cargando={enviando} onClick={() => void eliminar()} className="min-h-9 py-1.5">
            Sí, eliminar
          </Boton>
          <Boton variante="fantasma" onClick={() => setConfirmando(false)} disabled={enviando} className="min-h-9 py-1.5">
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
    <Boton variante="fantasma" aria-label={etiqueta} onClick={() => setConfirmando(true)} className="min-h-9 py-1.5 text-peligro hover:bg-peligro/10">
      Eliminar
    </Boton>
  );
}
