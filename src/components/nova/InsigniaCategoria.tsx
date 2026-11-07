import { esColorCategoria, type ColorCategoria } from '@/lib/reglas/categorias';

/** Clases escritas completas para que Tailwind las genere (tokens --color-cat-* de globals.css). */
export const PUNTO_COLOR: Record<ColorCategoria, string> = {
  terracota: 'bg-cat-terracota',
  ambar: 'bg-cat-ambar',
  oliva: 'bg-cat-oliva',
  verde: 'bg-cat-verde',
  azul: 'bg-cat-azul',
  violeta: 'bg-cat-violeta',
  rosa: 'bg-cat-rosa',
  gris: 'bg-cat-gris',
};

/** Punto de color de una categoría; decorativo: el nombre siempre va en texto al lado. */
export function PuntoCategoria({ color, className = '' }: { color: string; className?: string }) {
  const clase = PUNTO_COLOR[esColorCategoria(color) ? color : 'gris'];
  return <span aria-hidden="true" className={`inline-block size-2.5 shrink-0 rounded-full ${clase} ${className}`} />;
}

/**
 * E05: categoría con su punto de color y su nombre (el significado nunca va solo en el color).
 * Nunca más ancha que su contenedor: un nombre largo se corta con "…" y se ve completo en `title`.
 */
export function InsigniaCategoria({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span
      title={nombre}
      className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full bg-superficie-2 px-2.5 py-0.5 text-xs font-semibold text-texto"
    >
      <PuntoCategoria color={color} />
      <span className="truncate">{nombre}</span>
    </span>
  );
}
