'use client';

import { FileUp, ListPlus, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { esActivo } from './secciones';

/** Lo que ofrece el botón "+". "Subir documento" pasa a Fuentes (pestaña PDF) en E10. */
export const ACCIONES_AGREGAR = [
  { href: '/nova/tareas/nueva', texto: 'Nueva tarea', icono: ListPlus },
  { href: '/nova/fuentes?pestana=pdf', texto: 'Subir documento', icono: FileUp },
];

/**
 * Teléfono (< 1024 px): botón flotante "+" sobre la barra inferior. No aparece en el Asistente, para no
 * tapar el campo de la pregunta (PLAN_AMPLIACION 4.3). Se cierra con Escape, tocando fuera o al elegir.
 */
export function BotonAgregar() {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const zona = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback(() => setAbierto(false), []);

  useEffect(() => {
    if (!abierto) return;
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        cerrar();
        boton.current?.focus();
      }
    }
    function alTocar(evento: PointerEvent) {
      if (!zona.current?.contains(evento.target as Node)) cerrar();
    }
    document.addEventListener('keydown', alPresionar);
    document.addEventListener('pointerdown', alTocar);
    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.removeEventListener('pointerdown', alTocar);
    };
  }, [abierto, cerrar]);

  if (esActivo(ruta, '/nova/asistente')) return null;

  return (
    <div
      ref={zona}
      className="fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(5.5rem+var(--nova-seguro-abajo))] z-30 flex flex-col items-end gap-3 lg:hidden"
    >
      {abierto && (
        <ul id="menu-agregar" className="flex flex-col gap-2 rounded-2xl border border-borde bg-superficie p-2 shadow-suave">
          {ACCIONES_AGREGAR.map(({ href, texto, icono: Icono }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={cerrar}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-texto hover:bg-superficie-2 ${CLASE_FOCO}`}
              >
                <Icono aria-hidden="true" className="size-5 text-acento" />
                {texto}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button
        ref={boton}
        type="button"
        data-sin-conexion="permitido" // E11e: solo abre el menú; "Nueva tarea" funciona sin conexión
        aria-label={abierto ? 'Cerrar el menú Agregar' : 'Agregar'}
        aria-expanded={abierto}
        aria-controls="menu-agregar"
        onClick={() => setAbierto((v) => !v)}
        className={`flex size-14 items-center justify-center rounded-full bg-acento text-acento-texto shadow-suave transition-transform duration-150 ${CLASE_FOCO}`}
      >
        {abierto ? <X aria-hidden="true" className="size-6" /> : <Plus aria-hidden="true" className="size-6" />}
      </button>
    </div>
  );
}
