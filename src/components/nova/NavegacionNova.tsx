'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Boton, CLASE_FOCO } from '@/components/ui/Boton';

const ENLACES = [
  { href: '/nova', texto: 'Asistente' },
  { href: '/nova/tareas', texto: 'Tareas' },
  { href: '/nova/documentos', texto: 'Documentos' },
  { href: '/nova/productividad', texto: 'Productividad' },
  { href: '/nova/web', texto: 'Web' },
];

function esActivo(ruta: string, href: string): boolean {
  return href === '/nova' ? ruta === '/nova' : ruta === href || ruta.startsWith(`${href}/`);
}

export function NavegacionNova({ email }: { email: string }) {
  const ruta = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');
  const [saliendo, setSaliendo] = useState(false);

  async function cerrarSesion() {
    setError('');
    setSaliendo(true);
    try {
      const respuesta = await fetch('/api/auth/logout', { method: 'POST' });
      if (!respuesta.ok) {
        setError('No se pudo cerrar la sesión.');
        return;
      }
      router.replace('/login');
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setSaliendo(false);
    }
  }

  return (
    <header className="border-b border-borde bg-superficie text-texto">
      <nav aria-label="Principal" className="mx-auto flex max-w-[1000px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/nova" className={`rounded-lg text-lg font-bold tracking-tight text-acento ${CLASE_FOCO}`}>
          Nova
        </Link>

        <button
          type="button"
          className={`ml-auto rounded-xl border border-borde px-3 py-1.5 text-sm font-medium hover:bg-superficie-2 sm:hidden ${CLASE_FOCO}`}
          aria-expanded={abierto}
          aria-controls="menu-nova"
          onClick={() => setAbierto((v) => !v)}
        >
          {abierto ? 'Cerrar menú' : 'Menú'}
        </button>

        <div
          id="menu-nova"
          className={`${abierto ? 'flex' : 'hidden'} w-full flex-col gap-3 sm:ml-0 sm:flex sm:w-auto sm:flex-1 sm:flex-row sm:items-center`}
        >
          <ul className="flex flex-col gap-1 sm:flex-row sm:gap-2">
            {ENLACES.map(({ href, texto }) => {
              const activo = esActivo(ruta, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={activo ? 'page' : undefined}
                    onClick={() => setAbierto(false)}
                    className={`block rounded-xl px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${CLASE_FOCO} ${activo ? 'bg-acento-suave text-acento' : 'text-texto-suave hover:bg-superficie-2 hover:text-texto'}`}
                  >
                    {texto}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center sm:gap-3">
            <span className="truncate text-sm text-texto-suave" title={email}>
              {email}
            </span>
            <Boton variante="secundario" cargando={saliendo} onClick={cerrarSesion} className="min-h-9 py-1.5">
              Cerrar sesión
            </Boton>
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-peligro">
              {error}
            </p>
          )}
        </div>
      </nav>
    </header>
  );
}
