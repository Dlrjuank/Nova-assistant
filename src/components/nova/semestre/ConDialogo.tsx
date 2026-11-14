'use client';

import { useRef, useState, type ReactNode } from 'react';
import { claseBoton, type VarianteBoton } from '@/components/ui/Boton';
import { Dialogo } from '@/components/ui/Dialogo';

/** Un botón que abre un diálogo; el contenido recibe `cerrar` para usarlo al terminar. */
export function ConDialogo({
  boton,
  titulo,
  descripcion,
  variante = 'secundario',
  etiqueta,
  className = '',
  children,
}: {
  boton: ReactNode;
  titulo: string;
  descripcion?: ReactNode;
  variante?: VarianteBoton;
  /** Nombre accesible del botón, si su texto no basta ("Editar" de qué). */
  etiqueta?: string | undefined;
  className?: string;
  children: (cerrar: () => void) => ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const origen = useRef<HTMLButtonElement>(null);
  const cerrar = () => setAbierto(false);
  return (
    <>
      <button ref={origen} type="button" aria-label={etiqueta} onClick={() => setAbierto(true)} className={`${claseBoton(variante)} ${className}`}>
        {boton}
      </button>
      <Dialogo abierto={abierto} titulo={titulo} descripcion={descripcion} alCerrar={cerrar} origen={origen}>
        {abierto && children(cerrar)}
      </Dialogo>
    </>
  );
}
