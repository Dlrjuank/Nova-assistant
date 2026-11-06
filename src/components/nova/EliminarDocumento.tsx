'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Boton } from '@/components/ui/Boton';
import { MENSAJES } from '@/lib/reglas/errores';

/** RN-22: eliminar con confirmación, como "Eliminar tarea". */
export function EliminarDocumento({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function eliminar() {
    setError('');
    setEnviando(true);
    try {
      const respuesta = await fetch(`/api/nova/documentos/${id}`, { method: 'DELETE' });
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

  const mensajeError = error && (
    <p role="alert" className="text-xs font-medium text-peligro">
      {error}
    </p>
  );

  if (confirmando) {
    return (
      <div className="flex min-w-44 flex-col gap-2">
        <p className="text-sm text-texto">¿Eliminar este documento? El asistente ya no podrá usarlo. No se puede deshacer.</p>
        <div className="flex flex-wrap gap-2">
          <Boton variante="peligro" cargando={enviando} onClick={() => void eliminar()} className="min-h-9 py-1.5">
            Sí, eliminar
          </Boton>
          <Boton variante="fantasma" onClick={() => setConfirmando(false)} disabled={enviando} className="min-h-9 py-1.5">
            Cancelar
          </Boton>
        </div>
        {mensajeError}
      </div>
    );
  }

  return (
    <Boton
      variante="fantasma"
      aria-label={`Eliminar documento: ${nombre}`}
      onClick={() => setConfirmando(true)}
      className="min-h-9 py-1.5 text-peligro hover:bg-peligro/10"
    >
      Eliminar
    </Boton>
  );
}
