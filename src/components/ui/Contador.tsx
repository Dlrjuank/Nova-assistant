'use client';

import { useEffect, useState } from 'react';

/** Cuánto dura la cuenta, en milisegundos. E20b (tiempo de carga, pedido del usuario): antes 800. */
export const DURACION_MS = 450;

/** Décimas como nota: 39 → "3,9". */
const decimas = (n: number) => `${Math.trunc(n / 10)},${Math.abs(n % 10)}`;

/**
 * E20b (commit 2): un número que cuenta desde 0 hasta su valor al aparecer (0,45 s, frenando al final). El HTML
 * del servidor ya trae el valor final (la copia sin conexión y los lectores de pantalla lo ven entero); el
 * número que se mueve va oculto para lectores de pantalla y al lado va el valor en texto. Con "reducir
 * movimiento" no cuenta: muestra el valor de una vez.
 */
export function Contador({ valor, formato = 'entero' }: { valor: number; formato?: 'entero' | 'decimas' }) {
  const [mostrado, setMostrado] = useState(valor);
  const texto = (n: number) => (formato === 'decimas' ? decimas(n) : String(n));

  useEffect(() => {
    const quieto = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quieto || valor === 0) {
      setMostrado(valor);
      return;
    }
    let cuadro = 0;
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / DURACION_MS);
      const suave = 1 - (1 - t) ** 3;
      setMostrado(Math.round(valor * suave));
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    setMostrado(0);
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor]);

  return (
    <>
      <span aria-hidden="true" className="tabular-nums">
        {texto(mostrado)}
      </span>
      <span className="sr-only">{texto(valor)}</span>
    </>
  );
}
