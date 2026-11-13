'use client';

import { Ellipsis, LogOut, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Boton, CLASE_FOCO } from '@/components/ui/Boton';
import { BARRA_INFERIOR, MENU_MAS, esActivo, type Seccion } from './secciones';
import { useCerrarSesion } from './useCerrarSesion';
import { useFocoAtrapado } from './useFocoAtrapado';

function ItemBarra({ seccion, ruta }: { seccion: Seccion; ruta: string }) {
  const { href, texto, icono: Icono } = seccion;
  const activo = esActivo(ruta, href);
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={activo ? 'page' : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium transition-colors duration-150 ${CLASE_FOCO} ${
          activo ? 'text-acento' : 'text-texto-suave hover:text-texto'
        }`}
      >
        <Icono aria-hidden="true" className="size-5" />
        {texto}
      </Link>
    </li>
  );
}

/**
 * Teléfono y tableta (< 1024 px): barra inferior fija con Inicio, [Calendario], Asistente al centro y
 * destacado, Tareas y "Más". "Más" abre una hoja inferior con el resto de secciones y "Cerrar sesión".
 */
export function BarraInferior({ email }: { email: string }) {
  const ruta = usePathname();
  const [abierta, setAbierta] = useState(false);
  const hoja = useRef<HTMLDivElement>(null);
  const botonMas = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback(() => setAbierta(false), []);
  const { cerrarSesion, error, saliendo } = useCerrarSesion();
  useFocoAtrapado(abierta, hoja, botonMas, cerrar);

  // Con la hoja abierta, la página de fondo no se desplaza.
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

  return (
    <>
      <nav
        aria-label="Principal"
        data-barra-inferior
        className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-superficie pb-[var(--nova-seguro-abajo)] lg:hidden"
      >
        <ul className="mx-auto flex max-w-xl items-end gap-1 px-2 pt-1 pb-1">
          {BARRA_INFERIOR.izquierda.map((s) => (
            <ItemBarra key={s.href} seccion={s} ruta={ruta} />
          ))}
          <li className="flex-1">
            <Link
              href={centro.href}
              aria-current={centroActivo ? 'page' : undefined}
              className={`-mt-5 flex flex-col items-center gap-0.5 rounded-xl text-xs font-semibold ${CLASE_FOCO} ${centroActivo ? 'text-acento' : 'text-texto'}`}
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-acento text-acento-texto shadow-suave ring-4 ring-superficie">
                <CentroIcono aria-hidden="true" className="size-6" />
              </span>
              {centro.texto}
            </Link>
          </li>
          {BARRA_INFERIOR.derecha.map((s) => (
            <ItemBarra key={s.href} seccion={s} ruta={ruta} />
          ))}
          <li className="flex-1">
            <button
              ref={botonMas}
              type="button"
              data-sin-conexion="permitido" // E11b: la hoja "Más" también se abre sin conexión
              aria-haspopup="dialog"
              aria-expanded={abierta}
              aria-controls="hoja-mas"
              // La sección actual está dentro de "Más" (Web o Productividad): se dice también sin color.
              aria-current={masActivo ? 'true' : undefined}
              onClick={() => setAbierta(true)}
              className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium transition-colors duration-150 ${CLASE_FOCO} ${
                masActivo ? 'text-acento' : 'text-texto-suave hover:text-texto'
              }`}
            >
              <Ellipsis aria-hidden="true" className="size-5" />
              Más
            </button>
          </li>
        </ul>
      </nav>

      {abierta && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Tocar fuera cierra la hoja. Es un div sin rol: el teclado usa Escape o el botón "Cerrar". */}
          <div data-testid="fondo-hoja" className="absolute inset-0 bg-texto/40" onClick={cerrar} />
          <div
            ref={hoja}
            id="hoja-mas"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-hoja-mas"
            className="absolute inset-x-0 bottom-0 flex flex-col gap-4 rounded-t-2xl bg-superficie px-4 pt-4 pb-[calc(1rem+var(--nova-seguro-abajo))] shadow-suave"
          >
            <div className="flex items-center justify-between">
              <h2 id="titulo-hoja-mas" className="text-base font-semibold text-texto">
                Más secciones
              </h2>
              <Boton variante="fantasma" data-sin-conexion="permitido" onClick={cerrar} className="min-h-9 py-1.5">
                <X aria-hidden="true" className="size-4" />
                Cerrar
              </Boton>
            </div>
            <ul className="flex flex-col gap-1">
              {MENU_MAS.map(({ href, texto, icono: Icono }) => {
                const activo = esActivo(ruta, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={cerrar}
                      aria-current={activo ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${CLASE_FOCO} ${
                        activo ? 'bg-acento-suave text-acento' : 'text-texto hover:bg-superficie-2'
                      }`}
                    >
                      <Icono aria-hidden="true" className="size-5" />
                      {texto}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-col gap-2 border-t border-borde pt-3">
              <span className="truncate px-3 text-sm text-texto-suave" title={email}>
                {email}
              </span>
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
