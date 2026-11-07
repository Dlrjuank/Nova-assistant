'use client';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boton, CLASE_FOCO } from '@/components/ui/Boton';
import { MENU_LATERAL, esActivo } from './secciones';
import { useCerrarSesion } from './useCerrarSesion';

/** Computador (≥ 1024 px): barra lateral fija con la marca, las secciones, el correo y "Cerrar sesión". */
export function BarraLateral({ email }: { email: string }) {
  const ruta = usePathname();
  const { cerrarSesion, error, saliendo } = useCerrarSesion();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-borde bg-superficie-2 px-4 py-6 lg:flex">
      <Link href="/nova" className={`mb-8 self-start rounded-lg px-3 text-2xl font-bold tracking-tight text-acento ${CLASE_FOCO}`}>
        Nova
      </Link>
      <nav aria-label="Principal" className="flex-1">
        <ul className="flex flex-col gap-1">
          {MENU_LATERAL.map(({ href, texto, icono: Icono }) => {
            const activo = esActivo(ruta, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={activo ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${CLASE_FOCO} ${
                    activo ? 'bg-acento-suave text-acento' : 'text-texto-suave hover:bg-superficie hover:text-texto'
                  }`}
                >
                  <Icono aria-hidden="true" className="size-5 shrink-0" />
                  {texto}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex flex-col gap-2 border-t border-borde pt-4">
        <span className="truncate px-3 text-sm text-texto-suave" title={email}>
          {email}
        </span>
        <Boton variante="fantasma" cargando={saliendo} onClick={() => void cerrarSesion()} className="justify-start">
          <LogOut aria-hidden="true" className="size-4" />
          Cerrar sesión
        </Boton>
        {error && (
          <p role="alert" className="px-3 text-xs font-medium text-peligro">
            {error}
          </p>
        )}
      </div>
    </aside>
  );
}
