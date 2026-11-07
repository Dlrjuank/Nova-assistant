import { NOMBRE_COLOR, PALETA_CATEGORIAS, type ColorCategoria } from '@/lib/reglas/categorias';
import { PUNTO_COLOR } from './InsigniaCategoria';

/**
 * E05 (RB-03): los 8 colores de la paleta como botones de opción nativos, cada uno con su nombre.
 * Se recorre con Tab y las flechas, como cualquier grupo de opciones.
 */
export function SelectorColor({
  nombre,
  valor,
  alCambiar,
  leyenda = 'Color',
}: {
  nombre: string;
  valor: ColorCategoria;
  alCambiar: (color: ColorCategoria) => void;
  leyenda?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-texto">{leyenda}</legend>
      <div className="flex flex-wrap gap-2">
        {PALETA_CATEGORIAS.map((color) => (
          <label
            key={color}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-borde bg-superficie px-3 py-1.5 text-sm text-texto transition-colors duration-150 hover:bg-superficie-2 has-[:checked]:border-acento has-[:checked]:bg-acento-suave has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-acento"
          >
            <input
              type="radio"
              name={nombre}
              value={color}
              checked={valor === color}
              onChange={() => alCambiar(color)}
              className="sr-only"
            />
            <span aria-hidden="true" className={`size-3.5 rounded-full ${PUNTO_COLOR[color]}`} />
            {NOMBRE_COLOR[color]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
