'use client';

import { Ellipsis, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent, type PointerEvent as EventoPuntero, type ReactNode } from 'react';
import { Boton, CLASE_FOCO } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Dialogo } from '@/components/ui/Dialogo';
import type { Categoria } from '@/lib/dataService';
import { esColorCategoria, esGeneral, siguienteColorLibre, type ColorCategoria } from '@/lib/reglas/categorias';
import { MENSAJES } from '@/lib/reglas/errores';
import { hrefTareas } from '@/lib/rutasTareas';
import { PuntoCategoria } from './InsigniaCategoria';
import { SelectorColor } from './SelectorColor';

/** Lo que dura una presión para abrir el menú de una categoría en el teléfono. */
export const PRESION_LARGA_MS = 500;

type Panel =
  | { tipo: 'nueva' }
  | { tipo: 'menu' | 'renombrar' | 'color' | 'eliminar'; categoria: Categoria };

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

const CLASE_CHIP = `inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${CLASE_FOCO}`;
const chipActivo = (activo: boolean) =>
  activo ? 'border-acento bg-acento-suave text-acento' : 'border-borde bg-superficie text-texto hover:bg-superficie-2';

/**
 * E05b (PLAN_AMPLIACION 5.4): fila de categorías arriba de Tareas. Filtra por categoría (en la URL),
 * crea con "+ Nueva" y abre el menú de una categoría con "⋯" (en la elegida), dejándola presionada o con
 * clic derecho. General es la categoría por defecto: solo cambia de color.
 */
export function FilaCategorias({
  categorias,
  activa,
  vista,
}: {
  categorias: Categoria[];
  /** Nombre de la categoría filtrada, o null para "Todas". */
  activa: string | null;
  /** E08: pestaña (vista) que se conserva al cambiar de categoría. */
  vista?: string | undefined;
}) {
  const href = (categoria: string | null) => hrefTareas(vista, categoria);
  const router = useRouter();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState<ColorCategoria>('terracota');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [anuncio, setAnuncio] = useState('');
  const origen = useRef<HTMLElement | null>(null);
  const presion = useRef<{ temporizador: number | null; larga: boolean; x: number; y: number }>({ temporizador: null, larga: false, x: 0, y: 0 });

  function abrir(nuevo: Panel, desde: HTMLElement | null) {
    if (desde) origen.current = desde;
    setError('');
    if (nuevo.tipo === 'nueva') {
      setNombre('');
      setColor(siguienteColorLibre(categorias.map((c) => c.color)));
    } else if (nuevo.tipo === 'renombrar') {
      setNombre(nuevo.categoria.nombre);
    } else if (nuevo.tipo === 'color') {
      setColor(colorDe(nuevo.categoria));
    }
    setPanel(nuevo);
  }
  const cerrar = () => setPanel(null);

  // Presión larga en el teléfono: abre el menú y evita que el toque siga el enlace.
  function alPresionar(evento: EventoPuntero<HTMLAnchorElement>, categoria: Categoria) {
    const p = presion.current;
    p.larga = false;
    p.x = evento.clientX;
    p.y = evento.clientY;
    const elemento = evento.currentTarget;
    p.temporizador = window.setTimeout(() => {
      p.larga = true;
      abrir({ tipo: 'menu', categoria }, elemento);
    }, PRESION_LARGA_MS);
  }
  function cancelarPresion() {
    const p = presion.current;
    if (p.temporizador !== null) window.clearTimeout(p.temporizador);
    p.temporizador = null;
  }
  function alMover(evento: EventoPuntero<HTMLAnchorElement>) {
    const p = presion.current;
    if (Math.hypot(evento.clientX - p.x, evento.clientY - p.y) > 8) cancelarPresion(); // está deslizando la fila
  }

  async function terminar(r: Resultado<unknown>, mensaje: string, destino?: string) {
    setEnviando(false);
    if (!r.ok) return setError(r.mensaje);
    cerrar();
    setAnuncio(mensaje);
    if (destino) router.replace(destino);
    router.refresh();
  }

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    const r = await pedir<Categoria>('/api/nova/categorias', { method: 'POST', body: JSON.stringify({ nombre, color }) });
    await terminar(r, r.ok ? `Se creó la categoría «${r.datos.nombre}».` : '');
  }

  async function renombrar(evento: FormEvent, categoria: Categoria) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    const r = await pedir<Categoria>(`/api/nova/categorias/${categoria.id}`, { method: 'PATCH', body: JSON.stringify({ nombre }) });
    const destino = r.ok && activa === categoria.nombre ? href(r.datos.nombre) : undefined;
    await terminar(r, r.ok ? `La categoría ahora se llama «${r.datos.nombre}».` : '', destino);
  }

  async function cambiarColor(evento: FormEvent, categoria: Categoria) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    const r = await pedir<Categoria>(`/api/nova/categorias/${categoria.id}`, { method: 'PATCH', body: JSON.stringify({ color }) });
    await terminar(r, `Se cambió el color de «${categoria.nombre}».`);
  }

  async function eliminar(categoria: Categoria) {
    setError('');
    setEnviando(true);
    const r = await pedir<{ id: string }>(`/api/nova/categorias/${categoria.id}`, { method: 'DELETE' });
    const destino = r.ok && activa === categoria.nombre ? href(null) : undefined;
    await terminar(r, `Se eliminó «${categoria.nombre}»; sus tareas pasaron a General.`, destino);
  }

  const mensajeError = error && (
    <p role="alert" className="text-sm font-medium text-peligro">
      {error}
    </p>
  );
  const botonesFormulario = (textoGuardar: string) => (
    <div className="flex flex-wrap gap-2">
      <Boton type="submit" cargando={enviando}>
        {textoGuardar}
      </Boton>
      <Boton variante="secundario" onClick={cerrar} disabled={enviando}>
        Cancelar
      </Boton>
    </div>
  );

  let contenido: { titulo: string; descripcion?: string; cuerpo: ReactNode } | null = null;
  if (panel?.tipo === 'nueva') {
    contenido = {
      titulo: 'Nueva categoría',
      cuerpo: (
        <form onSubmit={(e) => void crear(e)} className="flex flex-col gap-4">
          <Campo etiqueta="Nombre" id="categoria-nombre" value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: Universidad" />
          <SelectorColor nombre="categoria-color" valor={color} alCambiar={setColor} />
          {botonesFormulario('Crear categoría')}
          {mensajeError}
        </form>
      ),
    };
  } else if (panel) {
    const c = panel.categoria;
    const general = esGeneral(c.nombre);
    const descripcion = `${general ? 'Por defecto · ' : ''}${textoTareas(Number(c.tareas))}`;
    if (panel.tipo === 'menu') {
      contenido = {
        titulo: c.nombre,
        descripcion,
        cuerpo: (
          <div className="flex flex-col gap-2">
            {general && <p className="text-sm text-texto-suave">General es la categoría por defecto: no se renombra ni se elimina.</p>}
            {!general && (
              <Boton variante="secundario" onClick={() => abrir({ tipo: 'renombrar', categoria: c }, null)} className="justify-start">
                Renombrar
              </Boton>
            )}
            <Boton variante="secundario" onClick={() => abrir({ tipo: 'color', categoria: c }, null)} className="justify-start">
              Cambiar color
            </Boton>
            {!general && (
              <Boton variante="secundario" onClick={() => abrir({ tipo: 'eliminar', categoria: c }, null)} className="justify-start text-peligro!">
                Eliminar
              </Boton>
            )}
          </div>
        ),
      };
    } else if (panel.tipo === 'renombrar') {
      contenido = {
        titulo: `Renombrar «${c.nombre}»`,
        descripcion: 'Sus tareas cambian de categoría con ella.',
        cuerpo: (
          <form onSubmit={(e) => void renombrar(e, c)} className="flex flex-col gap-4">
            <Campo etiqueta="Nombre" id="categoria-nombre" value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} />
            {botonesFormulario('Guardar')}
            {mensajeError}
          </form>
        ),
      };
    } else if (panel.tipo === 'color') {
      contenido = {
        titulo: `Color de «${c.nombre}»`,
        ...(general ? { descripcion: 'Por defecto' } : {}),
        cuerpo: (
          <form onSubmit={(e) => void cambiarColor(e, c)} className="flex flex-col gap-4">
            <SelectorColor nombre="categoria-color" valor={color} alCambiar={setColor} />
            {botonesFormulario('Guardar')}
            {mensajeError}
          </form>
        ),
      };
    } else {
      contenido = {
        titulo: `Eliminar «${c.nombre}»`,
        cuerpo: (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-texto">
              ¿Eliminar la categoría «{c.nombre}»?{' '}
              {Number(c.tareas) === 0
                ? 'No tiene tareas.'
                : Number(c.tareas) === 1
                  ? 'Su tarea pasará a General.'
                  : `Sus ${textoTareas(Number(c.tareas))} pasarán a General.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Boton variante="peligro" cargando={enviando} onClick={() => void eliminar(c)}>
                Sí, eliminar
              </Boton>
              <Boton variante="secundario" onClick={cerrar} disabled={enviando}>
                Cancelar
              </Boton>
            </div>
            {mensajeError}
          </div>
        ),
      };
    }
  }

  return (
    <>
      <nav aria-label="Filtrar por categoría" className="-mx-4 lg:mx-0">
        <ul className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          <li className="shrink-0">
            <Link href={href(null)} aria-current={activa === null ? 'page' : undefined} className={`${CLASE_CHIP} ${chipActivo(activa === null)}`}>
              Todas
            </Link>
          </li>
          {categorias.map((c) => {
            const elegida = activa !== null && activa.toLowerCase() === c.nombre.toLowerCase();
            return (
              <li key={c.id} className={`flex shrink-0 items-center rounded-full ${elegida ? 'bg-acento-suave' : ''}`}>
                <Link
                  href={href(c.nombre)}
                  aria-current={elegida ? 'page' : undefined}
                  className={`${CLASE_CHIP} ${chipActivo(elegida)} select-none [-webkit-touch-callout:none]`}
                  onPointerDown={(e) => alPresionar(e, c)}
                  onPointerUp={cancelarPresion}
                  onPointerLeave={cancelarPresion}
                  onPointerCancel={cancelarPresion}
                  onPointerMove={alMover}
                  onClick={(e) => {
                    if (presion.current.larga) {
                      e.preventDefault();
                      presion.current.larga = false;
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    cancelarPresion();
                    abrir({ tipo: 'menu', categoria: c }, e.currentTarget);
                  }}
                >
                  <PuntoCategoria color={c.color} />
                  {c.nombre}
                </Link>
                {elegida && (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`Opciones de la categoría ${c.nombre}`}
                    onClick={(e) => abrir({ tipo: 'menu', categoria: c }, e.currentTarget)}
                    className={`-ml-1 inline-flex size-9 items-center justify-center rounded-full text-acento hover:bg-superficie ${CLASE_FOCO}`}
                  >
                    <Ellipsis aria-hidden="true" className="size-4" />
                  </button>
                )}
              </li>
            );
          })}
          <li className="shrink-0">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={(e) => abrir({ tipo: 'nueva' }, e.currentTarget)}
              className={`${CLASE_CHIP} border-dashed border-borde bg-superficie text-acento hover:bg-superficie-2`}
            >
              <Plus aria-hidden="true" className="size-4" />
              Nueva
            </button>
          </li>
        </ul>
      </nav>
      <p role="status" className="sr-only">
        {anuncio}
      </p>
      <Dialogo
        key={panel?.tipo ?? 'cerrado'}
        abierto={contenido !== null}
        titulo={contenido?.titulo ?? ''}
        {...(contenido?.descripcion ? { descripcion: contenido.descripcion } : {})}
        alCerrar={cerrar}
        origen={origen}
      >
        {contenido?.cuerpo}
      </Dialogo>
    </>
  );
}
