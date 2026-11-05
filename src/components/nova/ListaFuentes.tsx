import type { Fuente } from '@/lib/dataService';

export function ListaFuentes({ fuentes }: { fuentes: Fuente[] }) {
  if (fuentes.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-texto-suave">Fuentes</p>
      <ul className="flex flex-wrap gap-1.5">
        {fuentes.map((f) => (
          <li
            key={f.etiqueta}
            className="break-all rounded-full border border-borde bg-superficie px-2.5 py-0.5 text-xs text-texto-suave"
          >
            {f.etiqueta}
          </li>
        ))}
      </ul>
    </div>
  );
}
