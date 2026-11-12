'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { SelectorCategoria } from '@/components/nova/SelectorCategoria';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Dialogo } from '@/components/ui/Dialogo';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { SugerenciaRepaso, TareaRepasoCreada } from '@/lib/dataService';
import { MENSAJES } from '@/lib/reglas/errores';
import { aplicarMascaraFecha, esFechaISOValida, hoyBogota, sumarDias } from '@/lib/reglas/fechas';

/**
 * E10f (5.11, RB-53): con 2 o más falladas de un capítulo, ofrece la tarea "Repasar cap. N: …". Nunca se crea
 * sola: se confirma en un diálogo con la fecha y la categoría.
 */
export function SugerenciasRepaso({
  intentoId,
  sugerencias,
  categoriaInicial,
  categorias,
}: {
  intentoId: string;
  sugerencias: readonly SugerenciaRepaso[];
  categoriaInicial: string;
  categorias: ReadonlyArray<{ nombre: string; color: string }>;
}) {
  const [existentes, setExistentes] = useState<ReadonlySet<string>>(new Set(sugerencias.filter((s) => s.yaExiste).map((s) => s.capituloId)));
  const [abierta, setAbierta] = useState<SugerenciaRepaso | null>(null);
  const [fecha, setFecha] = useState(() => sumarDias(hoyBogota(), 1));
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [creada, setCreada] = useState<TareaRepasoCreada | null>(null);
  const origen = useRef<HTMLButtonElement | null>(null);

  if (sugerencias.length === 0) return null;

  const errorFecha = fecha && !esFechaISOValida(fecha) ? MENSAJES.FECHA_INVALIDA : '';

  function abrir(s: SugerenciaRepaso, boton: HTMLButtonElement) {
    origen.current = boton;
    setError('');
    setCreada(null);
    setAbierta(s);
  }

  async function crear() {
    if (!abierta || cargando || !esFechaISOValida(fecha)) return;
    setError('');
    setCargando(true);
    try {
      const r = await fetch(`/api/nova/intentos/${intentoId}/tarea-repaso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capituloId: abierta.capituloId, fecha, categoria }),
      });
      const d = (await r.json().catch(() => null)) as { ok?: boolean; datos?: TareaRepasoCreada; error?: { codigo?: string; mensaje?: string } } | null;
      if (!r.ok || !d?.ok || !d.datos) {
        if (d?.error?.codigo === 'TAREA_REPASO_EXISTENTE') setExistentes((previas) => new Set(previas).add(abierta.capituloId));
        setError(d?.error?.mensaje ?? MENSAJES.ERROR_INTERNO);
        return;
      }
      setExistentes((previas) => new Set(previas).add(abierta.capituloId));
      setCreada(d.datos);
      setAbierta(null);
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <Tarjeta>
      <h2 className="mb-2 text-base font-semibold text-texto">Para repasar</h2>
      <ul className="flex flex-col divide-y divide-borde">
        {sugerencias.map((s) => (
          <li key={s.capituloId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-col">
              <span className="break-words font-medium text-texto">{s.titulo}</span>
              <span className="text-sm text-texto-suave">Fallaste {s.falladas} preguntas de este capítulo.</span>
            </div>
            {existentes.has(s.capituloId) ? (
              <span className="shrink-0 text-sm text-texto-suave">{MENSAJES.TAREA_REPASO_EXISTENTE}</span>
            ) : (
              <Boton variante="secundario" className="shrink-0" onClick={(e) => abrir(s, e.currentTarget)}>
                Crear tarea de repaso
              </Boton>
            )}
          </li>
        ))}
      </ul>
      {creada && (
        <div className="mt-3">
          <Aviso tipo="exito">
            Se creó la tarea «{creada.titulo}» en «{creada.categoria}».{' '}
            <Link href={`/nova/tareas?categoria=${encodeURIComponent(creada.categoria)}`} className="font-semibold text-acento underline">
              Ver en Tareas
            </Link>
          </Aviso>
        </div>
      )}
      <Dialogo abierto={abierta !== null} titulo="Crear tarea de repaso" descripcion={abierta?.titulo} alCerrar={() => setAbierta(null)} origen={origen}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void crear();
          }}
        >
          <Campo
            id="repaso-fecha"
            etiqueta="Fecha límite"
            value={fecha}
            onChange={(e) => {
              setFecha(aplicarMascaraFecha(e.target.value));
              setError('');
            }}
            error={errorFecha}
            placeholder="AAAA-MM-DD"
            inputMode="numeric"
            maxLength={10}
            autoComplete="off"
          />
          <SelectorCategoria id="repaso-categoria" etiqueta="Categoría" valor={categoria} onCambio={setCategoria} categorias={categorias} />
          <p className="text-xs text-texto-suave">Será una tarea de prioridad media.</p>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex flex-wrap gap-2">
            <Boton type="submit" cargando={cargando} disabled={cargando || !esFechaISOValida(fecha)}>
              Crear tarea
            </Boton>
            <Boton variante="secundario" onClick={() => setAbierta(null)} disabled={cargando}>
              Cancelar
            </Boton>
          </div>
        </form>
      </Dialogo>
    </Tarjeta>
  );
}
