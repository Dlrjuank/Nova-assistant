'use client';

import { Check, Plus } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { PuntoCategoria } from '@/components/nova/InsigniaCategoria';
import { CLASE_CONTROL } from '@/components/ui/Campo';
import { NOMBRE_MAXIMO_CATEGORIA } from '@/lib/reglas/categorias';

type Opcion = { tipo: 'existente'; nombre: string; color: string } | { tipo: 'nueva'; nombre: string };

/** Igual que el servidor (RB-33): recorta y une espacios; se compara sin mayúsculas. */
const limpiarCategoria =(texto: string) => texto.trim().replace(/\s+/g, ' ');

/**
 * E08 (PLAN_AMPLIACION 5.4, RB-33): campo de categoría con lista (patrón combobox de ARIA). Muestra las
 * categorías del usuario con su color, se filtra al escribir y ofrece `Crear "X"` si no existe ninguna con
 * ese nombre (sin distinguir mayúsculas ni espacios). No crea nada: la categoría nueva la crea el servidor
 * al guardar la tarea (`resolverCategoria`), así que escribir " universidad " guarda "Universidad".
 */
export function SelectorCategoria({
  id,
  etiqueta,
  valor,
  onCambio,
  categorias,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  categorias: ReadonlyArray<{ nombre: string; color: string }>;
}) {
  const base = useId();
  const idLista = `${base}-lista`;
  const idAyuda = `${base}-ayuda`;
  const [abierta, setAbierta] = useState(false);
  // Al abrir se ven todas; la lista se filtra solo después de escribir.
  const [filtrando, setFiltrando] = useState(false);
  const [activa, setActiva] = useState(-1);
  const campo = useRef<HTMLInputElement>(null);

  const limpio = limpiarCategoria(valor);
  const clave = limpio.toLowerCase();
  const exacta = categorias.find((c) => c.nombre.toLowerCase() === clave);
  const opciones: Opcion[] = [
    ...categorias
      .filter((c) => !filtrando || c.nombre.toLowerCase().includes(clave))
      .map((c) => ({ tipo: 'existente' as const, nombre: c.nombre, color: c.color })),
    ...(limpio && !exacta ? [{ tipo: 'nueva' as const, nombre: limpio }] : []),
  ];

  const abrir = () => {
    setAbierta(true);
    setActiva(Math.max(0, opciones.findIndex((o) => o.nombre.toLowerCase() === clave)));
  };
  const cerrar = () => {
    setAbierta(false);
    setFiltrando(false);
    setActiva(-1);
  };
  // Al elegir, el foco vuelve al campo sin volver a abrir la lista.
  const sinAbrir = useRef(false);
  const elegir = (o: Opcion) => {
    onCambio(o.nombre);
    cerrar();
    if (campo.current && document.activeElement !== campo.current) {
      sinAbrir.current = true;
      campo.current.focus();
      sinAbrir.current = false;
    }
  };

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!abierta) return abrir();
      if (opciones.length === 0) return;
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      setActiva((a) => (a + paso + opciones.length) % opciones.length);
    } else if (e.key === 'Enter' && abierta && opciones[activa]) {
      e.preventDefault(); // elige en vez de enviar el formulario
      elegir(opciones[activa]);
    } else if (e.key === 'Escape' && abierta) {
      e.preventDefault();
      e.stopPropagation();
      cerrar();
    }
  }

  const visible = abierta && opciones.length > 0;
  const idOpcion = (i: number) => `${base}-opcion-${i}`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-texto">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          ref={campo}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={visible}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={visible && activa >= 0 ? idOpcion(activa) : undefined}
          aria-describedby={idAyuda}
          value={valor}
          maxLength={NOMBRE_MAXIMO_CATEGORIA}
          autoComplete="off"
          placeholder="Escribe o elige una categoría"
          onChange={(e) => {
            onCambio(e.target.value);
            setFiltrando(true);
            setAbierta(true);
            setActiva(0);
          }}
          onFocus={() => !sinAbrir.current && abrir()}
          onClick={() => !abierta && abrir()}
          onBlur={cerrar}
          onKeyDown={teclas}
          className={`${CLASE_CONTROL} border-borde`}
        />
        <ul
          id={idLista}
          role="listbox"
          aria-label="Categorías disponibles"
          hidden={!visible}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-borde bg-superficie p-1 shadow-suave"
        >
          {opciones.map((o, i) => {
            const elegida = o.tipo === 'existente' && o.nombre.toLowerCase() === clave;
            return (
              <li
                key={`${o.tipo}-${o.nombre}`}
                id={idOpcion(i)}
                role="option"
                aria-selected={i === activa}
                // mousedown evita que el campo pierda el foco (y cierre la lista) antes del clic.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(o)}
                onMouseMove={() => setActiva(i)}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  i === activa ? 'bg-superficie-2 text-texto' : 'text-texto'
                }`}
              >
                {o.tipo === 'existente' ? (
                  <>
                    <PuntoCategoria color={o.color} />
                    <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
                    {elegida && <Check aria-hidden="true" className="size-4 shrink-0 text-acento" />}
                  </>
                ) : (
                  <>
                    <Plus aria-hidden="true" className="size-4 shrink-0 text-acento" />
                    <span className="min-w-0 flex-1 truncate">
                      Crear “{o.nombre}”
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <p id={idAyuda} className="text-xs text-texto-suave">
        {limpio && !exacta
          ? `Se creará la categoría «${limpio}» al guardar la tarea.`
          : 'Elige una de tus categorías o escribe una nueva. Vacía: General.'}
      </p>
    </div>
  );
}
