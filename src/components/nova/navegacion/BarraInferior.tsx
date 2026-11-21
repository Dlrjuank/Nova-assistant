'use client';

import { Ellipsis, LogOut, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EstrellaNova } from '@/components/nova/marca/EstrellaNova';
import { Boton, CLASE_FOCO } from '@/components/ui/Boton';
import { ATRIBUTO_PILDORA, estiloPildora, usePildora } from '@/components/ui/usePildora';
import { useAvisosNavegacion } from './AvisosNavegacion';
import { BARRA_INFERIOR, MENU_MAS, esActivo, type Seccion } from './secciones';
import { useCerrarSesion } from './useCerrarSesion';
import { useFocoAtrapado } from './useFocoAtrapado';

const ESTILO_ITEM = `relative z-10 flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium transition-colors duration-150 ${CLASE_FOCO}`;

function ItemBarra({ seccion, ruta, globo }: { seccion: Seccion; ruta: string; globo?: number | undefined }) {
  const { href, texto, icono: Icono } = seccion;
  const activo = esActivo(ruta, href);
  return (
    <li className="flex">
      <Link
        href={href}
        aria-current={activo ? 'page' : undefined}
        {...(activo ? { [ATRIBUTO_PILDORA]: '' } : {})}
        className={`${ESTILO_ITEM} ${activo ? 'font-semibold text-acento' : 'text-texto-suave hover:text-texto'}`}
      >
        <span className="relative">
          <Icono aria-hidden="true" className="size-[22px]" />
          {globo ? (
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-peligro px-1 font-mono text-[10px] leading-none font-semibold text-acento-texto"
            >
              {globo}
            </span>
          ) : null}
        </span>
        {texto}
        {/* El globo se ve sobre el ícono; para lectores de pantalla va después del nombre. */}
        {globo ? <span className="sr-only">{globo === 1 ? ' 1 tarea vencida' : ` ${globo} tareas vencidas`}</span> : null}
      </Link>
    </li>
  );
}

/**
 * Teléfono y tableta (< 1024 px). E20b: barra flotante de cristal con Inicio, Calendario, el Asistente al centro
 * (redondo, con el halo de la estrella), Tareas (con un globo si hay vencidas) y "Más"; la opción activa lleva una
 * píldora que se desliza. "Más" abre un menú de cristal casi a pantalla completa, con letras grandes.
 */
export function BarraInferior({ email }: { email: string }) {
  const ruta = usePathname();
  const avisos = useAvisosNavegacion();
  const [abierta, setAbierta] = useState(false);
  const hoja = useRef<HTMLDivElement>(null);
  const botonMas = useRef<HTMLButtonElement>(null);
  const fila = useRef<HTMLUListElement>(null);
  const cerrar = useCallback(() => setAbierta(false), []);
  const { cerrarSesion, error, saliendo } = useCerrarSesion();
  useFocoAtrapado(abierta, hoja, botonMas, cerrar);

  // Con el menú abierto, la página de fondo no se desplaza.
  useEffect(() => {
    if (!abierta) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [abierta]);

  const { centro } = BARRA_INFERIOR;
  const CentroIcono = centro.icono;
  const centroActivo = esActivo(ruta, centro.href);
  const masActivo = MENU_MAS.some((s) => esActivo(ruta, s.href));
  const activa = [...BARRA_INFERIOR.izquierda, ...BARRA_INFERIOR.derecha].find((s) => esActivo(ruta, s.href))?.href ?? (masActivo ? 'mas' : undefined);
  const pildora = usePildora(fila, 'inferior', activa);
  const vencidas = avisos?.vencidas ?? 0;
  const posicion = MENU_MAS.findIndex((s) => esActivo(ruta, s.href));

  return (
    <>
      <nav
        aria-label="Principal"
        data-barra-inferior
        className="fixed inset-x-3 bottom-[calc(0.75rem+var(--nova-seguro-abajo))] z-30 mx-auto max-w-xl rounded-[26px] border border-borde bg-cristal shadow-suave backdrop-blur-lg lg:hidden"
      >
        <ul ref={fila} className="relative grid grid-cols-5 items-center gap-1 p-1.5">
          {pildora && <li aria-hidden="true" className="pointer-events-none absolute top-0 left-0 rounded-2xl bg-acento-suave" style={estiloPildora(pildora)} />}
          {BARRA_INFERIOR.izquierda.map((s) => (
            <ItemBarra key={s.href} seccion={s} ruta={ruta} />
          ))}
          <li className="flex justify-center">
            <Link
              href={centro.href}
              aria-current={centroActivo ? 'page' : undefined}
              className={`relative z-10 -mt-7 flex flex-col items-center rounded-full ${CLASE_FOCO}`}
            >
              <span
                className={`nova-halo flex size-[3.75rem] items-center justify-center rounded-full bg-acento text-acento-texto shadow-suave ring-4 transition-transform duration-150 active:scale-95 ${
                  centroActivo ? 'ring-acento-suave' : 'ring-fondo'
                }`}
              >
                <CentroIcono aria-hidden="true" className="size-6" />
              </span>
              <span className="sr-only">{centro.texto}</span>
            </Link>
          </li>
          {BARRA_INFERIOR.derecha.map((s) => (
            <ItemBarra key={s.href} seccion={s} ruta={ruta} globo={s.href === '/nova/tareas' && vencidas > 0 ? vencidas : undefined} />
          ))}
          <li className="flex">
            <button
              ref={botonMas}
              type="button"
              data-sin-conexion="permitido" // E11b: el menú "Más" también se abre sin conexión
              aria-haspopup="dialog"
              aria-expanded={abierta}
              aria-controls="hoja-mas"
              // La sección actual está dentro de "Más": se dice también sin color.
              aria-current={masActivo ? 'true' : undefined}
              {...(masActivo ? { [ATRIBUTO_PILDORA]: '' } : {})}
              onClick={() => setAbierta(true)}
              className={`${ESTILO_ITEM} ${masActivo ? 'font-semibold text-acento' : 'text-texto-suave hover:text-texto'}`}
            >
              <Ellipsis aria-hidden="true" className="size-[22px]" />
              Más
            </button>
          </li>
        </ul>
      </nav>

      {abierta && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Tocar fuera cierra el menú. Es un div sin rol: el teclado usa Escape o el botón "Cerrar". */}
          <div data-testid="fondo-hoja" className="nova-aparecer absolute inset-0 bg-texto/30" onClick={cerrar} />
          <div
            ref={hoja}
            id="hoja-mas"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-hoja-mas"
            className="nova-aparecer absolute inset-x-2 top-[calc(0.5rem+env(safe-area-inset-top,0px))] bottom-[calc(0.5rem+var(--nova-seguro-abajo))] flex flex-col gap-6 overflow-y-auto rounded-[28px] border border-borde bg-cristal px-6 pt-5 pb-5 shadow-suave backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2.5">
                <EstrellaNova halo className="size-8" />
                <span className="font-display text-xl font-extrabold tracking-tight text-texto">nova</span>
              </span>
              <Boton variante="secundario" data-sin-conexion="permitido" onClick={cerrar} className="min-h-9 py-1.5">
                <X aria-hidden="true" className="size-4" />
                Cerrar
              </Boton>
            </div>
            <h2 id="titulo-hoja-mas" className="font-mono text-xs font-semibold tracking-[0.14em] text-texto-suave uppercase">
              Más secciones
            </h2>
            <ul className="flex flex-col gap-1">
              {MENU_MAS.map(({ href, texto }, i) => {
                const activo = esActivo(ruta, href);
                return (
                  <li key={href} className="nova-subir" style={{ animationDelay: `${60 + i * 45}ms` }}>
                    <Link
                      href={href}
                      onClick={cerrar}
                      aria-current={activo ? 'page' : undefined}
                      className={`flex min-h-14 items-center gap-3 rounded-2xl px-2 font-display text-[2rem] leading-tight font-extrabold tracking-tight ${CLASE_FOCO} ${
                        activo
                          ? "text-acento before:h-[3px] before:w-5 before:rounded-full before:bg-acento before:content-[''] after:size-2 after:rounded-full after:bg-acento after:content-['']"
                          : 'text-texto hover:text-acento'
                      }`}
                    >
                      {texto}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-auto flex flex-col gap-3 border-t border-borde pt-4">
              <div className="flex items-center justify-between gap-3 font-mono text-xs text-texto-suave">
                <span className="tabular-nums" aria-hidden="true">
                  {posicion >= 0 ? `${String(posicion + 1).padStart(2, '0')} / ${String(MENU_MAS.length).padStart(2, '0')}` : `— / ${String(MENU_MAS.length).padStart(2, '0')}`}
                </span>
                <span className="truncate" title={email}>
                  {email}
                </span>
              </div>
              <Boton variante="secundario" cargando={saliendo} onClick={() => void cerrarSesion()}>
                <LogOut aria-hidden="true" className="size-4" />
                Cerrar sesión
              </Boton>
              {error && (
                <p role="alert" className="px-3 text-xs font-medium text-peligro">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
