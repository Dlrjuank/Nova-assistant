'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import type { Categoria } from '@/lib/dataService';
import { esColorCategoria, esGeneral, siguienteColorLibre, type ColorCategoria } from '@/lib/reglas/categorias';
import { MENSAJES } from '@/lib/reglas/errores';
import { PuntoCategoria } from './InsigniaCategoria';
import { SelectorColor } from './SelectorColor';

type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string };

async function pedir<T>(url: string, init: RequestInit): Promise<Resultado<T>> {
  try {
    const respuesta = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
    const cuerpo = (await respuesta.json().catch(() => null)) as { ok?: boolean; datos?: T; error?: { mensaje?: string } } | null;
    if (!respuesta.ok || !cuerpo?.ok) return { ok: false, mensaje: cuerpo?.error?.mensaje ?? MENSAJES.ERROR_INTERNO };
    return { ok: true, datos: cuerpo.datos as T };
  } catch {
    return { ok: false, mensaje: 'No se pudo conectar con el servidor. Intenta de nuevo.' };
  }
}

const colorDe = (c: Categoria): ColorCategoria => (esColorCategoria(c.color) ? c.color : 'gris');
const textoTareas = (n: number) => (n === 1 ? '1 tarea' : `${n} tareas`);

function MensajeError({ mensaje, id }: { mensaje: string; id?: string }) {
  return mensaje ? (
    <p id={id} role="alert" className="text-sm font-medium text-peligro">
      {mensaje}
    </p>
  ) : null;
}

/** Una categoría: ver, editar (nombre y color) o eliminar con confirmación. */
function FilaCategoria({ categoria, alCambiar }: { categoria: Categoria; alCambiar: () => void }) {
  const general = esGeneral(categoria.nombre);
  const [modo, setModo] = useState<'ver' | 'editar' | 'eliminar'>('ver');
  const [nombre, setNombre] = useState(categoria.nombre);
  const [color, setColor] = useState<ColorCategoria>(colorDe(categoria));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  function cancelar() {
    setModo('ver');
    setNombre(categoria.nombre);
    setColor(colorDe(categoria));
    setError('');
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    const cambios = general ? { color } : { nombre, color };
    const r = await pedir<Categoria>(`/api/nova/categorias/${categoria.id}`, { method: 'PATCH', body: JSON.stringify(cambios) });
    setEnviando(false);
    if (!r.ok) return setError(r.mensaje);
    setModo('ver');
    alCambiar();
  }

  async function eliminar() {
    setError('');
    setEnviando(true);
    const r = await pedir<{ id: string }>(`/api/nova/categorias/${categoria.id}`, { method: 'DELETE' });
    setEnviando(false);
    if (!r.ok) return setError(r.mensaje);
    alCambiar();
  }

  if (modo === 'editar') {
    return (
      <li className="rounded-2xl border border-borde bg-superficie p-4">
        <form onSubmit={(e) => void guardar(e)} className="flex flex-col gap-4" aria-label={`Editar la categoría ${categoria.nombre}`}>
          {general ? (
            <p className="text-sm text-texto-suave">General no se puede renombrar ni eliminar; sí puedes cambiar su color.</p>
          ) : (
            <Campo etiqueta="Nombre" id={`nombre-${categoria.id}`} value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} />
          )}
          <SelectorColor nombre={`color-${categoria.id}`} valor={color} alCambiar={setColor} />
          <div className="flex flex-wrap gap-2">
            <Boton type="submit" cargando={enviando}>
              Guardar cambios
            </Boton>
            <Boton variante="secundario" onClick={cancelar} disabled={enviando}>
              Cancelar
            </Boton>
          </div>
          <MensajeError mensaje={error} />
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <PuntoCategoria color={categoria.color} className="size-3.5" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-texto">{categoria.nombre}</p>
          <p className="text-sm text-texto-suave">{textoTareas(Number(categoria.tareas))}</p>
        </div>
      </div>
      {modo === 'eliminar' ? (
        <div className="flex flex-col gap-2 sm:max-w-sm">
          <p className="text-sm text-texto">
            ¿Eliminar la categoría «{categoria.nombre}»?{' '}
            {Number(categoria.tareas) > 0 ? `Sus ${textoTareas(Number(categoria.tareas))} pasarán a General.` : 'No tiene tareas.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton variante="peligro" cargando={enviando} onClick={() => void eliminar()} className="min-h-9 py-1.5">
              Sí, eliminar
            </Boton>
            <Boton variante="fantasma" onClick={cancelar} disabled={enviando} className="min-h-9 py-1.5">
              Cancelar
            </Boton>
          </div>
          <MensajeError mensaje={error} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" onClick={() => setModo('editar')} aria-label={`Editar la categoría ${categoria.nombre}`} className="min-h-9 py-1.5">
            Editar
          </Boton>
          {!general && (
            <Boton
              variante="fantasma"
              onClick={() => setModo('eliminar')}
              aria-label={`Eliminar la categoría ${categoria.nombre}`}
              className="min-h-9 py-1.5 text-peligro hover:bg-peligro/12"
            >
              Eliminar
            </Boton>
          )}
        </div>
      )}
    </li>
  );
}

/** E05 (PLAN_AMPLIACION 5.8, RB-02 a RB-04): bloque Categorías de Configuración. */
export function CategoriasConfig({ categorias }: { categorias: Categoria[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState<ColorCategoria>(() => siguienteColorLibre(categorias.map((c) => c.color)));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  // Cuando la página trae la lista nueva, el color propuesto pasa al siguiente libre.
  useEffect(() => {
    setColor(siguienteColorLibre(categorias.map((c) => c.color)));
  }, [categorias]);

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setAviso('');
    setEnviando(true);
    const r = await pedir<Categoria>('/api/nova/categorias', { method: 'POST', body: JSON.stringify({ nombre, color }) });
    setEnviando(false);
    if (!r.ok) return setError(r.mensaje);
    setNombre('');
    setAviso(`Se creó la categoría «${r.datos.nombre}».`);
    router.refresh();
  }

  return (
    <section aria-labelledby="titulo-categorias" className="flex flex-col gap-4">
      <div>
        <h2 id="titulo-categorias" className="text-lg font-semibold text-texto">
          Categorías
        </h2>
        <p className="text-sm text-texto-suave">El color de cada categoría se ve en tus tareas. Al renombrar una, sus tareas cambian con ella.</p>
      </div>

      <ul className="flex flex-col gap-2" aria-label="Tus categorías">
        {categorias.map((c) => (
          <FilaCategoria key={`${c.id}-${c.nombre}-${c.color}-${c.tareas}`} categoria={c} alCambiar={() => router.refresh()} />
        ))}
      </ul>

      <form onSubmit={(e) => void crear(e)} className="flex flex-col gap-4 rounded-2xl border border-borde bg-superficie p-4 shadow-suave" aria-labelledby="titulo-nueva-categoria">
        <h3 id="titulo-nueva-categoria" className="font-semibold text-texto">
          Nueva categoría
        </h3>
        <Campo etiqueta="Nombre" id="nueva-categoria-nombre" value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: Universidad" />
        <SelectorColor nombre="color-nueva-categoria" valor={color} alCambiar={setColor} />
        <div>
          <Boton type="submit" cargando={enviando} disabled={nombre.trim() === ''}>
            Agregar categoría
          </Boton>
        </div>
        <MensajeError mensaje={error} />
        {aviso && (
          <p role="status" className="text-sm text-exito">
            {aviso}
          </p>
        )}
      </form>
    </section>
  );
}
