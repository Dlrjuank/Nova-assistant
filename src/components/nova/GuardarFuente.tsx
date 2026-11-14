'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { CATEGORIA_POR_DEFECTO, MAX_FUENTES_WEB_POR_CATEGORIA } from '@/lib/config/nova';
import type { FuenteGuardada } from '@/lib/dataService';
import { MENSAJES } from '@/lib/reglas/errores';

/** RB-55: una búsqueda en Wikipedia no guarda nada; se guarda con este botón, en la categoría elegida. */
export function GuardarFuente({ url, resumen }: { url: string; resumen: string }) {
  const id = useId();
  const [categoria, setCategoria] = useState(CATEGORIA_POR_DEFECTO);
  const [guardando, setGuardando] = useState(false);
  const [guardada, setGuardada] = useState<FuenteGuardada | null>(null);
  const [error, setError] = useState<{ codigo: string; mensaje: string } | null>(null);

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      const respuesta = await fetch('/api/nova/web/fuentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, resumen, categoria: categoria.trim() || CATEGORIA_POR_DEFECTO }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as { ok?: boolean; datos?: FuenteGuardada; error?: { codigo?: string; mensaje?: string } } | null;
      if (!respuesta.ok || !cuerpo?.ok || !cuerpo.datos) {
        setError({ codigo: cuerpo?.error?.codigo ?? 'ERROR_INTERNO', mensaje: cuerpo?.error?.mensaje ?? MENSAJES.ERROR_INTERNO });
        return;
      }
      setGuardada(cuerpo.datos);
    } catch {
      setError({ codigo: 'SIN_CONEXION', mensaje: 'No se pudo conectar con el servidor. Intenta de nuevo.' });
    } finally {
      setGuardando(false);
    }
  }

  if (guardada) {
    return (
      <div className="mt-3">
        <Aviso tipo="exito">
          Fuente guardada en «{guardada.categoria}» ({guardada.fuentesEnCategoria} de {MAX_FUENTES_WEB_POR_CATEGORIA}).
        </Aviso>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-borde pt-3">
      <Campo id={id} etiqueta="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)} maxLength={80} autoComplete="off" />
      <div>
        <Boton variante="secundario" cargando={guardando} onClick={() => void guardar()}>
          Guardar fuente
        </Boton>
      </div>
      {error && (
        <Aviso tipo={error.codigo === 'LIMITE_FUENTES' || error.codigo === 'FUENTE_DUPLICADA' ? 'advertencia' : 'error'}>
          {error.mensaje}
          {error.codigo === 'LIMITE_FUENTES' && (
            <>
              {' '}
              <Link href="/nova/fuentes?pestana=web" className="font-semibold text-acento underline">
                Ver fuentes guardadas
              </Link>
            </>
          )}
        </Aviso>
      )}
    </div>
  );
}
