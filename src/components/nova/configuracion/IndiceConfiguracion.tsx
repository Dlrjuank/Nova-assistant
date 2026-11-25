'use client';

import { useEffect, useState } from 'react';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { SECCIONES_CONFIGURACION } from './TituloBloque';

/**
 * E20b (commit 9): en pantalla ancha (desde 1280 px), el índice de Configuración queda fijo al lado y marca la
 * sección que se está viendo. Los enlaces solo desplazan la página: funcionan también sin conexión.
 */
export function IndiceConfiguracion() {
  const [actual, setActual] = useState<string>(SECCIONES_CONFIGURACION[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visibles = new Map<string, boolean>();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) visibles.set(e.target.id, e.isIntersecting);
        const primera = SECCIONES_CONFIGURACION.find((s) => visibles.get(s.id));
        if (primera) setActual(primera.id);
      },
      { rootMargin: '-15% 0px -55% 0px' },
    );
    for (const s of SECCIONES_CONFIGURACION) {
      const el = document.getElementById(s.id);
      if (el) observador.observe(el);
    }
    return () => observador.disconnect();
  }, []);

  return (
    <nav aria-label="Secciones de Configuración" className="sticky top-6 hidden self-start xl:block" data-indice-configuracion>
      <ul className="flex flex-col gap-0.5 border-l border-borde">
        {SECCIONES_CONFIGURACION.map((s) => {
          const activa = actual === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                data-sin-conexion="permitido"
                aria-current={activa ? 'true' : undefined}
                onClick={() => setActual(s.id)}
                className={`-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-colors duration-150 ${CLASE_FOCO} ${
                  activa ? 'border-acento font-semibold text-acento' : 'border-transparent text-texto-suave hover:text-texto'
                }`}
              >
                {s.texto}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
