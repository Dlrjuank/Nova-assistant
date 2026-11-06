import Link from 'next/link';
import { CLASE_FOCO } from './Boton';

export interface Pestana {
  href: string; // la pestaña va en la URL (?vista=..., ?estado=...), así se puede compartir y volver
  texto: string;
  activa: boolean;
}

/** Pestañas en píldora (PLAN_AMPLIACION 3.2). Son enlaces: la activa lleva aria-current. */
export function Pestanas({ etiqueta, pestanas }: { etiqueta: string; pestanas: Pestana[] }) {
  return (
    <nav aria-label={etiqueta} className="flex flex-wrap gap-1 self-start rounded-full bg-superficie-2 p-1">
      {pestanas.map(({ href, texto, activa }) => (
        <Link
          key={href}
          href={href}
          aria-current={activa ? 'page' : undefined}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150 ${CLASE_FOCO} ${
            activa ? 'bg-superficie text-acento shadow-suave' : 'text-texto-suave hover:text-texto'
          }`}
        >
          {texto}
        </Link>
      ))}
    </nav>
  );
}
